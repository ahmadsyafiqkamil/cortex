"""Cortex CLI entrypoint.

Run: `python -m cortex_cli --help`

Only `llm-smoke` is wired up for now — it verifies the provider-agnostic LLM layer
once `.env` (LLM_BASE_URL / LLM_API_KEY / LLM_MODEL) is filled in. The real commands
(ingest, query, lint, snapshot, dispute) are implemented in later days per docs/TASKS.md.
"""

from __future__ import annotations

import sys

import typer
from rich import print as rprint

# Allow running both as `python -m cortex_cli` (package) and from the agent/ dir.
try:
    from llm import LLMClient, LLMConfig, LLMConfigError, LLMResponseError
except ImportError:  # pragma: no cover - fallback when package layout differs
    from agent.llm import (  # type: ignore
        LLMClient,
        LLMConfig,
        LLMConfigError,
        LLMResponseError,
    )

app = typer.Typer(help="Cortex — decentralized knowledge base maintained by AI agents.")


@app.callback()
def _root() -> None:
    """Cortex CLI. Subcommands (ingest/query/lint/...) are added in later days."""
    # Forces Typer to keep named subcommands even while only one exists.


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


def main() -> None:
    app()


if __name__ == "__main__":
    sys.exit(main())
