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
        body_without_frontmatter,
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
        body_without_frontmatter,
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
_CLAIM_RE = re.compile(r"\^\[blob:[A-Za-z0-9_\-]+\]")


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


# ── lint ──────────────────────────────────────────────────────────────────────

@app.command("lint")
def lint(
    output_format: str = typer.Option(
        "text", "--format", "-f", help="Output format: text (markdown report) or json."
    ),
) -> None:
    """Run quality checks on the wiki content.

    Detects: broken [[wikilinks]], orphan pages (no inbound links),
    claims without ^[blob:...] provenance markers, markers that point to
    wiki page blobs (anti-feedback-loop), and unregistered source blob IDs.

    Outputs a structured markdown report (or JSON).
    """
    walrus = WalrusClient()
    chain = ChainClient()

    console.rule("[bold cyan]Cortex Lint[/bold cyan]")

    # ── Enumerate pages ──────────────────────────────────────────────────────
    rprint("[dim]Fetching page list from chain…[/dim]")
    try:
        all_slugs = chain.list_pages()
    except ChainError as exc:
        rprint(f"[red]Chain error (list_pages):[/red] {exc}")
        raise typer.Exit(code=1)

    content_slugs = [s for s in all_slugs if s not in _SYSTEM_SLUGS]
    if not content_slugs:
        rprint("[yellow]No content pages found.[/yellow]")
        raise typer.Exit(code=0)

    rprint(f"[dim]{len(content_slugs)} content page(s) found.[/dim]")

    # ── Enumerate sources ────────────────────────────────────────────────────
    rprint("[dim]Fetching source registry from chain…[/dim]")
    registered_sources: set[str] = set()
    try:
        for src in chain.list_sources():
            registered_sources.add(src.get("blob", ""))
    except ChainError as exc:
        rprint(f"[yellow]Warning: could not fetch sources:[/yellow] {exc}")
    registered_sources.discard("")

    # ── Collect page blob IDs (for anti-feedback-loop check) ─────────────────
    page_blob_ids: set[str] = set()
    try:
        page_blob_ids = chain.get_all_page_blob_ids()
    except ChainError as exc:
        rprint(f"[yellow]Warning: could not fetch page blob IDs:[/yellow] {exc}")

    # ── Read all page content ────────────────────────────────────────────────
    rprint("[dim]Reading page content from Walrus…[/dim]")
    page_data: dict[str, dict] = {}  # slug -> {md, fm, wikilinks, markers, claims}
    for slug in content_slugs:
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
        fm = parse_frontmatter(md)
        page_data[slug] = {
            "md": md,
            "fm": fm,
            "wikilinks": extract_wikilinks(md),
            "markers": extract_markers(md),
            "claims": split_claims(md),
        }

    if not page_data:
        rprint("[yellow]Could not read any page content.[/yellow]")
        raise typer.Exit(code=0)

    # ── Run checks ───────────────────────────────────────────────────────────

    # Build the set of known slugs for wikilink validation.
    known_slugs = set(all_slugs)  # includes _index, _log

    # Build inbound link map: slug -> set of slugs that link to it.
    inbound: dict[str, set[str]] = {}
    for slug, data in page_data.items():
        for target in data["wikilinks"]:
            inbound.setdefault(target, set()).add(slug)

    broken_wikilinks: list[tuple[str, str]] = []  # (from_slug, target)
    orphan_pages: list[str] = []
    claims_without_markers: list[tuple[str, str]] = []  # (slug, claim_text)
    markers_to_wiki: list[tuple[str, str, str]] = []  # (slug, blob_id, page_title)
    unregistered_fm_sources: list[tuple[str, str]] = []  # (slug, blob_id)

    for slug, data in page_data.items():
        # --- Broken wikilinks ---
        for target in data["wikilinks"]:
            if target not in known_slugs:
                broken_wikilinks.append((slug, target))

        # --- Claims without markers ---
        body = body_without_frontmatter(data["md"])
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if not _CLAIM_RE.search(line) and len(line) > 20:
                claims_without_markers.append((slug, line[:120]))

        # --- Markers pointing to wiki pages ---
        for blob_id in data["markers"]:
            if blob_id in page_blob_ids:
                fm = data.get("fm", {})
                title = fm.get("title", slug)
                markers_to_wiki.append((slug, blob_id, title))

        # --- Unregistered sources in frontmatter ---
        fm_sources = data.get("fm", {}).get("sources", []) or []
        for src in fm_sources:
            if isinstance(src, dict):
                src_blob = src.get("blob", "")
                if src_blob and src_blob not in registered_sources:
                    unregistered_fm_sources.append((slug, src_blob))

    # --- Orphan pages ---
    for slug in content_slugs:
        if slug not in inbound or not inbound[slug]:
            orphan_pages.append(slug)

    # ── Render report ────────────────────────────────────────────────────────
    total_pages = len(page_data)
    total_wikilinks = sum(len(p["wikilinks"]) for p in page_data.values())
    total_markers = sum(len(p["markers"]) for p in page_data.values())

    if output_format == "json":
        report = {
            "summary": {
                "total_pages": total_pages,
                "total_wikilinks": total_wikilinks,
                "total_markers": total_markers,
                "broken_wikilinks": len(broken_wikilinks),
                "orphan_pages": len(orphan_pages),
                "claims_without_markers": len(claims_without_markers),
                "markers_to_wiki_pages": len(markers_to_wiki),
                "unregistered_sources": len(unregistered_fm_sources),
            },
            "errors": {
                "broken_wikilinks": [
                    {"from": f, "target": t} for f, t in broken_wikilinks
                ],
                "markers_to_wiki_pages": [
                    {"page": s, "blob_id": b, "title": t}
                    for s, b, t in markers_to_wiki
                ],
                "unregistered_sources": [
                    {"page": s, "blob_id": b} for s, b in unregistered_fm_sources
                ],
            },
            "warnings": {
                "orphan_pages": orphan_pages,
                "claims_without_markers": [
                    {"page": s, "text": c} for s, c in claims_without_markers
                ],
            },
        }
        rprint(json.dumps(report, indent=2))
        raise typer.Exit(code=0)

    lines: list[str] = []
    lines.append("# Cortex Lint Report")
    lines.append("")
    lines.append(
        f"Generated {datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}"
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"| Metric | Count |")
    lines.append(f"| --- | --- |")
    lines.append(f"| Total pages | {total_pages} |")
    lines.append(f"| Total wikilinks | {total_wikilinks} |")
    lines.append(f"| Total provenance markers | {total_markers} |")
    lines.append(
        f"| Broken wikilinks :small_red_triangle: | {len(broken_wikilinks)} |"
    )
    lines.append(
        f"| Orphan pages :warning: | {len(orphan_pages)} |"
    )
    lines.append(
        f"| Claims without markers :warning: | {len(claims_without_markers)} |"
    )
    lines.append(
        f"| Markers to wiki pages (ERROR) :x: | {len(markers_to_wiki)} |"
    )
    lines.append(
        f"| Unregistered sources (ERROR) :x: | {len(unregistered_fm_sources)} |"
    )
    lines.append("")

    # --- Errors section ---
    has_errors = broken_wikilinks or markers_to_wiki or unregistered_fm_sources
    if has_errors:
        lines.append("## Errors")
        lines.append("")

    if broken_wikilinks:
        lines.append("### Broken wikilinks")
        lines.append("")
        for from_slug, target in sorted(broken_wikilinks):
            lines.append(f"- `[[{from_slug}]]` links to `[[{target}]]` — page not found")
        lines.append("")

    if markers_to_wiki:
        lines.append("### Provenance markers pointing to wiki pages (anti-feedback-loop)")
        lines.append("")
        lines.append(
            "Markers MUST point to raw source blobs, never to other wiki page blobs. "
            "This is a defence against agent feedback loops."
        )
        lines.append("")
        for slug, blob_id, title in sorted(markers_to_wiki):
            lines.append(
                f"- `[[{slug}]]` ({title}): marker `^[blob:{blob_id}]` "
                f"points to a wiki page blob"
            )
        lines.append("")

    if unregistered_fm_sources:
        lines.append("### Unregistered sources in frontmatter")
        lines.append("")
        for slug, blob_id in sorted(unregistered_fm_sources):
            lines.append(
                f"- `[[{slug}]]`: `{blob_id}` is not registered via `source::register_source`"
            )
        lines.append("")

    # --- Warnings section ---
    has_warnings = orphan_pages or claims_without_markers
    if has_warnings:
        lines.append("## Warnings")
        lines.append("")

    if orphan_pages:
        lines.append("### Orphan pages (no inbound wikilinks)")
        lines.append("")
        for slug in sorted(orphan_pages):
            lines.append(f"- `[[{slug}]]`")
        lines.append("")

    if claims_without_markers:
        lines.append("### Claims without provenance markers")
        lines.append("")
        lines.append(
            "These lines appear to contain factual statements but have no "
            "`^[blob:...]` marker linking them to a raw source."
        )
        lines.append("")
        shown = 0
        for slug, text in sorted(claims_without_markers):
            if shown >= 20:
                lines.append(f"... and {len(claims_without_markers) - 20} more")
                break
            lines.append(f"- `[[{slug}]]`: _{text}_")
            shown += 1
        lines.append("")

    report = "\n".join(lines)
    console.print(report, markup=False)

    # ── Exit with non-zero if there are errors ───────────────────────────────
    if broken_wikilinks or markers_to_wiki or unregistered_fm_sources:
        rprint(
            f"\n[bold red]{len(broken_wikilinks) + len(markers_to_wiki) + len(unregistered_fm_sources)} error(s) found.[/bold red]"
        )
        raise typer.Exit(code=1)

    rprint("\n[bold green]:heavy_check_mark: No errors found.[/bold green]")


# ── dispute raise ──────────────────────────────────────────────────────────────

@app.command("dispute")
def dispute(
    page: str = typer.Option(
        ..., "--page", "-p", help="Slug of the disputed wiki page."
    ),
    counter_source: Path = typer.Option(
        ..., "--counter-source", "-c", help="Path to a text file containing the counter-source."
    ),
    title: str = typer.Option(
        "", "--title", "-t", help="Human-readable title for the counter-source."
    ),
    rationale: str = typer.Option(
        "", "--rationale", "-r", help="Text explaining why the claim is disputed."
    ),
) -> None:
    """Raise a dispute against a wiki page (Agent B keypair).

    Stores the counter-source on Walrus, registers it on-chain, optionally
    stores the rationale as a blob, then calls dispute::raise_dispute.

    The dispute is recorded as a shared DisputeRecord on Sui — it never
    modifies the page, only records the disagreement transparently.
    """
    counter_source = counter_source.resolve()
    if not counter_source.exists():
        rprint(f"[red]Counter-source file not found:[/red] {counter_source}")
        raise typer.Exit(code=1)

    if not title:
        title = counter_source.stem.replace("_", " ").replace("-", " ").title()

    walrus = WalrusClient()
    chain = ChainClient()

    console.rule("[bold cyan]Cortex Dispute[/bold cyan]")
    rprint(f"[bold]Page:[/bold]            {page}")
    rprint(f"[bold]Counter-source:[/bold] {counter_source}")
    rprint(f"[bold]Using:[/bold]           Agent B ({chain.config.agent_b.address})")

    # ── Verify page exists ───────────────────────────────────────────────────
    try:
        record = chain.get_page_record(page)
    except ChainError as exc:
        rprint(f"[red]Chain error:[/red] {exc}")
        raise typer.Exit(code=1)

    if not record:
        rprint(f"[red]Page '[cyan]{page}[/cyan]' not found on-chain.[/red]")
        raise typer.Exit(code=1)

    rprint(f"  [green]:heavy_check_mark:[/green] page '{page}' exists on-chain")

    # ── Step 1: Store counter-source on Walrus ───────────────────────────────
    rprint("\n[bold cyan]Step 1/3[/bold cyan] Storing counter-source on Walrus…")
    try:
        counter_blob = walrus.store(counter_source)
    except WalrusError as exc:
        rprint(f"[red]Walrus error:[/red] {exc}")
        raise typer.Exit(code=1)
    rprint(f"  [green]:heavy_check_mark:[/green] counter_source_blob = {counter_blob}")

    # ── Step 2: Register counter-source on-chain (Agent B) ───────────────────
    rprint("\n[bold cyan]Step 2/3[/bold cyan] Registering counter-source on-chain (Agent B)…")
    try:
        chain.register_source(blob=counter_blob, title=title, origin_url=str(counter_source), agent="b")
        rprint(f"  [green]:heavy_check_mark:[/green] source registered: {counter_blob}")
    except ChainError as exc:
        err = str(exc)
        if "dynamic_field::add" in err:
            rprint(f"  [yellow]source already registered — continuing[/yellow] ({counter_blob})")
        else:
            rprint(f"[red]Chain error (register_source):[/red] {exc}")
            raise typer.Exit(code=1)

    # ── Step 3: Store rationale + raise dispute ──────────────────────────────
    rprint("\n[bold cyan]Step 3/3[/bold cyan] Raising dispute on-chain (Agent B)…")
    rationale_blob = ""
    if rationale.strip():
        try:
            rationale_blob = walrus.store_text(rationale, name=f"dispute-{page}")
            rprint(f"  [dim]rationale blob: {rationale_blob}[/dim]")
        except WalrusError as exc:
            rprint(f"[yellow]Warning: could not store rationale blob:[/yellow] {exc}")

    try:
        result = chain.raise_dispute(
            page=page,
            reason_blob=rationale_blob,
            agent="b",
        )
        rprint(f"  [green]:heavy_check_mark:[/green] dispute raised against '[[{page}]]'")
    except ChainError as exc:
        rprint(f"[red]Chain error (raise_dispute):[/red] {exc}")
        raise typer.Exit(code=1)

    console.rule("[bold green]Dispute complete[/bold green]")
    rprint(f"[bold green]:heavy_check_mark:[/bold green] Dispute filed by Agent B")
    rprint(f"  Page:           [[{page}]]")
    rprint(f"  Counter-source: {counter_blob}")
    if rationale_blob:
        rprint(f"  Rationale:      {rationale_blob}")


# ── attest ────────────────────────────────────────────────────────────────────

@app.command("attest")
def attest(
    slug: str = typer.Argument(..., help="Wiki page slug to attest provenance for."),
    agent: str = typer.Option(
        "a", "--agent", "-a", help="Which agent keypair to use ('a' or 'b'). Default 'a'."
    ),
) -> None:
    """Attest that a wiki page's provenance is verified on-chain.

    Creates a ProvenanceAttestation object on Sui — open to any address,
    no ContributorCap required. The active Sui address signs the transaction.
    """
    chain = ChainClient()

    console.rule(f"[bold cyan]Cortex Attest — \\[{slug}][/bold cyan]")

    # ── Fetch page record ─────────────────────────────────────────────────────
    try:
        record = chain.get_page_record(slug)
    except ChainError as exc:
        rprint(f"[red]Chain error:[/red] {exc}")
        raise typer.Exit(code=1)

    if not record:
        rprint(f"[red]Page '[cyan]{slug}[/cyan]' not found on-chain.[/red]")
        raise typer.Exit(code=1)

    page_blob = record.get("latest_blob", "")
    if not page_blob:
        rprint(f"[red]Page '[cyan]{slug}[/cyan]' has no blob on-chain.[/red]")
        raise typer.Exit(code=1)

    rprint(f"[bold]Page:[/bold]      {slug}")
    rprint(f"[bold]Blob:[/bold]      [yellow]{page_blob}[/yellow]")
    rprint(f"[bold]Using:[/bold]     Agent {agent.upper()}")

    # ── Attest ────────────────────────────────────────────────────────────────
    rprint("\n[bold cyan]Attesting provenance on-chain…[/bold cyan]")
    try:
        result = chain.attest_provenance(
            page=slug,
            page_blob=page_blob,
            agent=agent,
        )
    except ChainError as exc:
        rprint(f"[red]Chain error (attest):[/red] {exc}")
        raise typer.Exit(code=1)

    console.rule("[bold green]Attestation complete[/bold green]")

    # Extract object ID and digest from result
    object_id = ""
    digest = result.get("digest", "") if isinstance(result, dict) else ""

    if isinstance(result, dict):
        for change in result.get("objectChanges", []):
            if change.get("type") == "created":
                object_id = change.get("objectId", "")
                break

    rprint(f"[bold green]:heavy_check_mark:[/bold green] Provenance attested for '[[{slug}]]'")
    if object_id:
        rprint(f"  Attestation ID:  {object_id}")
        rprint(f"  Explorer:        https://suiscan.xyz/testnet/object/{object_id}")
    if digest:
        rprint(f"  Tx digest:       {digest}")


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
