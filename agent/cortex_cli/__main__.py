"""Cortex CLI entrypoint.

Run: `python -m cortex_cli --help`

Commands:
  llm-smoke  -- Verify LLM config (.env) is working.
  ingest     -- Run the 7-step ingest pipeline on a raw source file.
  query      -- Ask a question and get an answer with provenance citations.
  trace      -- Trace a claim on a wiki page back to its raw source blob.
"""

from __future__ import annotations

import datetime
import json
import re
import sys
from pathlib import Path

import typer
from rich import print as rprint
from rich.console import Console

# Load .env from the agent/ directory so LLM_* vars are available.
try:
    from dotenv import load_dotenv
    _AGENT_DIR = Path(__file__).parent.parent
    load_dotenv(_AGENT_DIR / ".env", override=False)
except ImportError:
    pass  # dotenv optional; vars may already be set in the environment

# Allow running both as `python -m cortex_cli` (package) and from the agent/ dir.
try:
    from chain import ChainClient, ChainError
    from cortex_cli.pageformat import (
        extract_markers,
        extract_wikilinks,
        keyword_score,
        parse_frontmatter,
        resolve_source_title,
        split_claims,
    )
    from llm import LLMClient, LLMConfig, LLMConfigError, LLMResponseError
    from walrus import WalrusClient, WalrusError
except ImportError:
    from agent.chain import ChainClient, ChainError  # type: ignore
    from agent.cortex_cli.pageformat import (  # type: ignore
        extract_markers,
        extract_wikilinks,
        keyword_score,
        parse_frontmatter,
        resolve_source_title,
        split_claims,
    )
    from agent.llm import LLMClient, LLMConfig, LLMConfigError, LLMResponseError  # type: ignore
    from agent.walrus import WalrusClient, WalrusError  # type: ignore

console = Console()
app = typer.Typer(help="Cortex — decentralized knowledge base maintained by AI agents.")

# Path to prompt templates relative to this file's package root.
_PROMPTS_DIR = Path(__file__).parent.parent / "llm" / "prompts"


@app.callback()
def _root() -> None:
    """Cortex CLI."""


# ── llm-smoke ─────────────────────────────────────────────────────────────────

@app.command("llm-smoke")
def llm_smoke(
    prompt: str = typer.Option(
        "Reply with exactly: cortex llm ok", "--prompt", "-p", help="Prompt to send."
    ),
) -> None:
    """Send one prompt to the configured LLM and print the reply (verifies .env + provider)."""
    try:
        config = LLMConfig.from_env()
    except LLMConfigError as exc:
        rprint(f"[red]Config error:[/red] {exc}")
        raise typer.Exit(code=1)

    rprint(f"[dim]provider base_url=[/dim]{config.base_url}  [dim]model=[/dim]{config.model}")
    try:
        reply = LLMClient(config).complete(prompt)
    except LLMResponseError as exc:
        rprint(f"[red]LLM error:[/red] {exc}")
        raise typer.Exit(code=1)

    rprint("[green]LLM reply:[/green]")
    rprint(reply)


# ── ingest ────────────────────────────────────────────────────────────────────

@app.command("ingest")
def ingest(
    source_file: Path = typer.Argument(..., help="Path to the raw source text file."),
    title: str = typer.Option("", "--title", "-t", help="Human-readable title for this source."),
    url: str = typer.Option("", "--url", "-u", help="Origin URL (empty for local files)."),
) -> None:
    """Ingest a raw source file into Cortex.

    7-step pipeline: store raw blob → register source on-chain → LLM extract
    concepts → write wiki pages → store page blobs → record pages on-chain →
    emit links → update _index and _log system pages.
    """
    source_file = source_file.resolve()
    if not source_file.exists():
        rprint(f"[red]Source file not found:[/red] {source_file}")
        raise typer.Exit(code=1)

    if not title:
        title = source_file.stem.replace("_", " ").replace("-", " ").title()

    # ── Init clients ──────────────────────────────────────────────────────────
    try:
        llm_config = LLMConfig.from_env()
    except LLMConfigError as exc:
        rprint(f"[red]LLM config error:[/red] {exc}")
        raise typer.Exit(code=1)

    llm = LLMClient(llm_config)
    walrus = WalrusClient()
    chain = ChainClient()

    console.rule("[bold cyan]Cortex Ingest Pipeline[/bold cyan]")
    rprint(f"[bold]Source:[/bold] {source_file}")
    rprint(f"[bold]Title:[/bold]  {title}")

    # ─── Step 1: Store raw source on Walrus ──────────────────────────────────
    rprint("\n[bold cyan]Step 1/7[/bold cyan] Storing raw source on Walrus…")
    try:
        raw_blob_id = walrus.store(source_file)
    except WalrusError as exc:
        rprint(f"[red]Walrus error:[/red] {exc}")
        raise typer.Exit(code=1)
    rprint(f"  [green]✓[/green] raw_blob_id = {raw_blob_id}")

    # ─── Step 2: Register source on-chain ────────────────────────────────────
    rprint("\n[bold cyan]Step 2/7[/bold cyan] Registering source on-chain…")
    try:
        chain.register_source(blob=raw_blob_id, title=title, origin_url=url)
        rprint(f"  [green]✓[/green] source registered: {raw_blob_id}")
    except ChainError as exc:
        err = str(exc)
        if "dynamic_field::add" in err and "code 0" in err:
            rprint(f"  [yellow]source already registered — continuing[/yellow] ({raw_blob_id})")
        else:
            rprint(f"[red]Chain error (register_source):[/red] {exc}")
            raise typer.Exit(code=1)

    # ─── Step 3: LLM extract concepts ────────────────────────────────────────
    rprint("\n[bold cyan]Step 3/7[/bold cyan] Extracting concepts via LLM…")
    raw_text = source_file.read_text(encoding="utf-8")
    extract_prompt_tmpl = (_PROMPTS_DIR / "extract.md").read_text(encoding="utf-8")
    extract_prompt = _parse_prompt(extract_prompt_tmpl, {"RAW_TEXT": raw_text})

    try:
        extraction = _llm_complete_json_with_retry(llm, **extract_prompt)
    except LLMResponseError as exc:
        rprint(f"[red]LLM extraction error:[/red] {exc}")
        raise typer.Exit(code=1)

    pages = extraction.get("pages", [])
    if not pages:
        rprint("[yellow]Warning:[/yellow] LLM returned no pages. Exiting.")
        raise typer.Exit(code=0)
    rprint(f"  [green]✓[/green] extracted {len(pages)} page(s): {[p['slug'] for p in pages]}")

    # ─── Steps 4–6: Per-page: write, store, record, link ─────────────────────
    today = datetime.date.today().isoformat()
    write_prompt_tmpl = (_PROMPTS_DIR / "write_page.md").read_text(encoding="utf-8")
    page_blobs: dict[str, str] = {}  # slug -> page_blob_id

    for page_data in pages:
        slug = page_data["slug"]
        page_title = page_data["title"]
        links = page_data.get("links", [])
        claims = page_data.get("claims", [])
        links_str = ", ".join(f"[[{s}]]" for s in links) if links else "none"

        # ── Step 4: Write page with LLM ──────────────────────────────────────
        rprint(f"\n[bold cyan]Step 4/7[/bold cyan] Writing page '[cyan]{slug}[/cyan]'…")
        write_vars = {
            "SLUG": slug,
            "TITLE": page_title,
            "SRC": "{{SRC}}",  # literal placeholder; Python replaces after LLM call
            "DATE": today,
            "LINKS": links_str,
            "CLAIMS_JSON": json.dumps(claims, ensure_ascii=False, indent=2),
        }
        write_prompt = _parse_prompt(write_prompt_tmpl, write_vars)

        try:
            page_md = _llm_complete_with_retry(llm, **write_prompt)
        except LLMResponseError as exc:
            rprint(f"[red]LLM write_page error for '{slug}':[/red] {exc}")
            raise typer.Exit(code=1)

        # Inject actual blob ID — LLM only ever sees {{SRC}} placeholder
        page_md = page_md.replace("{{SRC}}", raw_blob_id)
        rprint(f"  [green]✓[/green] page content generated ({len(page_md)} chars)")

        # Store page blob on Walrus
        rprint(f"  Storing page blob for '[cyan]{slug}[/cyan]'…")
        try:
            page_blob_id = walrus.store_text(page_md, name=slug)
        except WalrusError as exc:
            rprint(f"[red]Walrus error storing page '{slug}':[/red] {exc}")
            raise typer.Exit(code=1)
        page_blobs[slug] = page_blob_id
        rprint(f"  [green]✓[/green] page_blob_id = {page_blob_id}")

        # ── Step 5: Record page on-chain ──────────────────────────────────────
        rprint(f"\n[bold cyan]Step 5/7[/bold cyan] Recording page '[cyan]{slug}[/cyan]' on-chain…")
        try:
            chain.add_page(
                slug=slug,
                blob_id=page_blob_id,
                sources_list=[raw_blob_id],
            )
            rprint(f"  [green]✓[/green] page '{slug}' recorded on-chain")
        except ChainError as exc:
            err = str(exc)
            if "add_page" in err and "code 1" in err:
                rprint(f"  [yellow]page '{slug}' exists — updating on-chain[/yellow]")
                try:
                    chain.update_page(
                        slug=slug,
                        new_blob_id=page_blob_id,
                        sources_list=[raw_blob_id],
                    )
                except ChainError as update_exc:
                    rprint(f"[red]Chain error (update_page '{slug}'):[/red] {update_exc}")
                    raise typer.Exit(code=1)
                rprint(f"  [green]✓[/green] page '{slug}' updated on-chain")
            else:
                rprint(f"[red]Chain error (add_page '{slug}'):[/red] {exc}")
                raise typer.Exit(code=1)

        # ── Step 6: Emit links ────────────────────────────────────────────────
        if links:
            rprint(
                f"\n[bold cyan]Step 6/7[/bold cyan] Emitting {len(links)} link(s) "
                f"for '[cyan]{slug}[/cyan]'…"
            )
            for to_slug in links:
                try:
                    chain.add_link(from_slug=slug, to_slug=to_slug)
                    rprint(f"  [green]✓[/green] link: {slug} → {to_slug}")
                except ChainError as exc:
                    rprint(f"[yellow]Warning:[/yellow] add_link {slug}→{to_slug} failed: {exc}")

    # ─── Step 7: Update _index and _log system pages ─────────────────────────
    rprint("\n[bold cyan]Step 7/7[/bold cyan] Updating system pages (_index, _log)…")
    _update_system_pages(walrus, chain, page_blobs, title, raw_blob_id, today)

    console.rule("[bold green]Ingest complete[/bold green]")
    rprint(f"[bold green]✓[/bold green] Ingested {len(pages)} page(s) from [cyan]{source_file.name}[/cyan]")
    rprint(f"  Raw blob:  {raw_blob_id}")
    for slug, blob in page_blobs.items():
        rprint(f"  [{slug}]: {blob}")


# ── query ─────────────────────────────────────────────────────────────────────

_SYSTEM_SLUGS = frozenset({"_index", "_log"})


@app.command("query")
def query(
    question: str = typer.Argument(..., help="Question to ask the wiki."),
    top_k: int = typer.Option(4, "--top-k", "-k", help="Number of most relevant pages to use."),
) -> None:
    """Ask a question and get an answer with provenance citations.

    Reads page content from Walrus (cache-first), scores pages by keyword
    overlap, then asks the LLM to synthesise an answer. Citations (slug →
    raw source blob) are injected by code — the LLM never produces blob IDs.
    """
    try:
        llm_config = LLMConfig.from_env()
    except LLMConfigError as exc:
        rprint(f"[red]LLM config error:[/red] {exc}")
        raise typer.Exit(code=1)

    llm = LLMClient(llm_config)
    walrus = WalrusClient()
    chain = ChainClient()

    console.rule("[bold cyan]Cortex Query[/bold cyan]")
    rprint(f"[bold]Question:[/bold] {question}\n")

    # ── Enumerate pages ───────────────────────────────────────────────────────
    rprint("[dim]Fetching page list from chain…[/dim]")
    try:
        all_slugs = [s for s in chain.list_pages() if s not in _SYSTEM_SLUGS]
    except ChainError as exc:
        rprint(f"[red]Chain error (list_pages):[/red] {exc}")
        raise typer.Exit(code=1)

    if not all_slugs:
        rprint("[yellow]No pages found in the wiki.[/yellow]")
        raise typer.Exit(code=0)

    rprint(f"[dim]{len(all_slugs)} content page(s) found.[/dim]")

    # ── Fetch page content and score by keyword relevance ─────────────────────
    page_content: dict[str, str] = {}  # slug -> markdown
    page_records: dict[str, dict] = {}  # slug -> chain PageRecord

    for slug in all_slugs:
        record = chain.get_page_record(slug)
        if not record or record.get("deleted"):
            continue
        blob_id = record.get("latest_blob", "")
        if not blob_id:
            continue
        try:
            md = walrus.read(blob_id).decode("utf-8", errors="replace")
        except WalrusError:
            continue
        page_content[slug] = md
        page_records[slug] = record

    if not page_content:
        rprint("[yellow]Could not read any page content from Walrus.[/yellow]")
        raise typer.Exit(code=0)

    # Score and select top-k pages.
    scores = {
        slug: keyword_score(question, slug, md) for slug, md in page_content.items()
    }
    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
    selected = [slug for slug, _ in ranked[:top_k] if scores[slug] > 0]

    # If no page scored > 0, fall back to the top-k by count regardless.
    if not selected:
        selected = [slug for slug, _ in ranked[:top_k]]

    selected_display = ", ".join(f"[[{s}]]" for s in selected)
    rprint(f"[dim]Selected {len(selected)} page(s): {selected_display}[/dim]\n")

    # ── Build LLM prompt ──────────────────────────────────────────────────────
    pages_block_parts: list[str] = []
    for slug in selected:
        md = page_content[slug]
        fm = parse_frontmatter(md)
        title = fm.get("title", slug)
        pages_block_parts.append(f"### [{slug}] {title}\n\n{md}")
    pages_block = "\n\n---\n\n".join(pages_block_parts)

    answer_prompt_tmpl = (_PROMPTS_DIR / "answer.md").read_text(encoding="utf-8")
    answer_prompt = _parse_prompt(
        answer_prompt_tmpl, {"QUESTION": question, "PAGES": pages_block}
    )

    rprint("[dim]Generating answer…[/dim]\n")
    try:
        answer_text = _llm_complete_with_retry(llm, **answer_prompt)
    except LLMResponseError as exc:
        rprint(f"[red]LLM error:[/red] {exc}")
        raise typer.Exit(code=1)

    # ── Render answer ─────────────────────────────────────────────────────────
    console.rule("[bold green]Answer[/bold green]")
    # Disable markup interpretation so LLM [slug-ref] style isn't eaten as Rich tags.
    console.print(answer_text, markup=False)

    # ── Inject citations (code-derived, never from LLM) ───────────────────────
    all_citations: list[tuple[str, str, str]] = []  # (slug, blob_id, source_title)
    seen_blobs: set[str] = set()

    for slug in selected:
        md = page_content[slug]
        fm = parse_frontmatter(md)
        for blob_id in extract_markers(md):
            if blob_id not in seen_blobs:
                title = resolve_source_title(blob_id, fm)
                all_citations.append((slug, blob_id, title))
                seen_blobs.add(blob_id)

    if all_citations:
        console.rule("[bold]Sources[/bold]")
        for slug, blob_id, title in all_citations:
            rprint(f"  [cyan]{slug}[/cyan] → [dim]{title}[/dim]")
            rprint(f"    blob: [yellow]{blob_id}[/yellow]")


# ── trace ──────────────────────────────────────────────────────────────────────

@app.command("trace")
def trace(
    slug: str = typer.Argument(..., help="Wiki page slug to trace."),
    claim: str = typer.Argument(
        "",
        help="Substring of a claim to trace (empty = show all claims on the page).",
    ),
) -> None:
    """Trace a claim back through page blob → raw source blob → excerpt.

    Displays the provenance chain: claim → page → raw source → content excerpt.
    The endpoint is always a raw external source blob (never a wiki page blob).
    """
    walrus = WalrusClient()
    chain = ChainClient()

    console.rule(f"[bold cyan]Cortex Trace — \\[{slug}][/bold cyan]")

    # ── Fetch PageRecord ──────────────────────────────────────────────────────
    try:
        record = chain.get_page_record(slug)
    except ChainError as exc:
        rprint(f"[red]Chain error:[/red] {exc}")
        raise typer.Exit(code=1)

    if not record:
        rprint(f"[red]Page '[cyan]{slug}[/cyan]' not found on-chain.[/red]")
        raise typer.Exit(code=1)

    latest_blob = record.get("latest_blob", "")
    history = record.get("history", [])
    on_chain_sources = record.get("sources", [])

    rprint(f"[bold]Page:[/bold]    {slug}")
    rprint(f"[bold]Blob:[/bold]    [yellow]{latest_blob}[/yellow]")
    if history:
        rprint(f"[bold]History:[/bold] {len(history)} prior version(s)")
    rprint()

    # ── Read page markdown ────────────────────────────────────────────────────
    try:
        md = walrus.read(latest_blob).decode("utf-8", errors="replace")
    except WalrusError as exc:
        rprint(f"[red]Walrus error reading page blob:[/red] {exc}")
        raise typer.Exit(code=1)

    fm = parse_frontmatter(md)
    all_claims = split_claims(md)

    if not all_claims:
        rprint("[yellow]No provenance markers found in this page.[/yellow]")
        raise typer.Exit(code=0)

    # ── Filter claims ─────────────────────────────────────────────────────────
    if claim:
        matched = [c for c in all_claims if claim.lower() in c.text.lower()]
        if not matched:
            rprint(f"[yellow]No claims matching '[cyan]{claim}[/cyan]' found.[/yellow]")
            rprint(f"  Available claims ({len(all_claims)}):")
            for c in all_claims:
                rprint(f"    • {c.text[:80]}…")
            raise typer.Exit(code=0)
    else:
        matched = all_claims

    # ── Render provenance chain per claim ─────────────────────────────────────
    console.rule("[bold]Provenance Chain[/bold]")

    for i, c in enumerate(matched, 1):
        console.print(f"\n[bold cyan]Claim {i}:[/bold cyan] {c.text}")
        rprint(f"  [dim]Page:[/dim]  [cyan]{slug}[/cyan]")
        rprint(f"  [dim]Blob:[/dim]  [yellow]{latest_blob}[/yellow]")

        for blob_id in c.blobs:
            source_title = resolve_source_title(blob_id, fm)
            rprint(f"\n  [bold]Raw source:[/bold] [dim]{source_title}[/dim]")
            rprint(f"  [bold]Blob ID:[/bold]    [yellow]{blob_id}[/yellow]")

            # Fetch excerpt from raw source blob (cache-first).
            try:
                raw_bytes = walrus.read(blob_id)
                excerpt = raw_bytes.decode("utf-8", errors="replace")[:400].strip()
                # Truncate at the last sentence boundary if possible.
                last_period = max(excerpt.rfind(". "), excerpt.rfind(".\n"))
                if last_period > 200:
                    excerpt = excerpt[: last_period + 1]
                rprint(f"  [bold]Excerpt:[/bold]")
                rprint(f"    [italic]{excerpt}[/italic]")
            except WalrusError as exc:
                rprint(f"  [yellow]Could not fetch raw blob:[/yellow] {exc}")

        rprint()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _parse_prompt(template: str, variables: dict[str, str]) -> dict:
    """Split a '# system / # user' markdown prompt template and substitute variables.

    Returns a dict with keys 'prompt' (str) and 'system' (str or None).
    """
    for key, value in variables.items():
        template = template.replace("{{" + key + "}}", value)

    system = None
    user = template

    parts = re.split(r"^#\s*(system|user)\s*$", template, flags=re.MULTILINE | re.IGNORECASE)
    section: dict[str, str] = {}
    i = 1
    while i + 1 < len(parts):
        label = parts[i].strip().lower()
        content = parts[i + 1].strip()
        section[label] = content
        i += 2

    if "system" in section:
        system = section["system"]
    if "user" in section:
        user = section["user"]

    return {"prompt": user, "system": system}


def _llm_complete_json_with_retry(
    llm: LLMClient,
    prompt: str,
    system: "str | None" = None,
    temperature: float = 0.0,
) -> dict:
    """Call LLMClient.complete_json(), retrying once on failure."""
    try:
        return llm.complete_json(prompt, system=system, temperature=temperature)
    except LLMResponseError:
        return llm.complete_json(prompt, system=system, temperature=temperature)


def _llm_complete_with_retry(
    llm: LLMClient,
    prompt: str,
    system: "str | None" = None,
    temperature: float = 0.2,
) -> str:
    """Call LLMClient.complete(), retrying once on failure."""
    try:
        return llm.complete(prompt, system=system, temperature=temperature)
    except LLMResponseError:
        return llm.complete(prompt, system=system, temperature=temperature)


def _update_system_pages(
    walrus: WalrusClient,
    chain: ChainClient,
    page_blobs: dict,
    source_title: str,
    raw_blob_id: str,
    today: str,
) -> None:
    """Build _index and _log system pages, store on Walrus, record on-chain."""
    index_lines = ["# Cortex Index\n"]
    for slug, blob in page_blobs.items():
        index_lines.append(f"- [[{slug}]] — blob: `{blob}`")
    index_md = "\n".join(index_lines) + "\n"

    log_md = (
        f"## {today} — Ingest: {source_title}\n\n"
        f"- raw_blob: `{raw_blob_id}`\n"
        + "".join(f"- page [{slug}]: `{blob}`\n" for slug, blob in page_blobs.items())
        + "\n"
    )

    for system_slug, content in [("_index", index_md), ("_log", log_md)]:
        try:
            sys_blob_id = walrus.store_text(content, name=system_slug)
        except WalrusError as exc:
            rprint(f"[yellow]Warning:[/yellow] Could not store {system_slug} blob: {exc}")
            continue

        try:
            chain.add_page(
                slug=system_slug,
                blob_id=sys_blob_id,
                sources_list=[raw_blob_id],
            )
            rprint(f"  [green]✓[/green] {system_slug} recorded (blob: {sys_blob_id})")
        except ChainError as exc:
            err = str(exc)
            if "add_page" in err and "code 1" in err:
                try:
                    chain.update_page(
                        slug=system_slug,
                        new_blob_id=sys_blob_id,
                        sources_list=[raw_blob_id],
                    )
                    rprint(f"  [green]✓[/green] {system_slug} updated (blob: {sys_blob_id})")
                except ChainError as update_exc:
                    rprint(
                        f"[yellow]Warning:[/yellow] Could not update {system_slug} "
                        f"on-chain: {update_exc}"
                    )
            else:
                rprint(
                    f"[yellow]Warning:[/yellow] Could not record {system_slug} "
                    f"on-chain: {exc}"
                )


def main() -> None:
    app()


if __name__ == "__main__":
    sys.exit(main())
