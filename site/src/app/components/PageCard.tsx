import { Link } from "react-router";
import { TagPill } from "./TagPill";
import type { Page } from "../data/mock";

function relTime(ts: string) {
  const d = new Date(ts.replace(" UTC", "Z").replace(" ", "T"));
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3.6e6);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days}d ago`;
}

export function PageCard({ page }: { page: Page }) {
  return (
    <Link
      to={`/${page.slug}`}
      className="cx-gradient-border group relative block p-5 rounded-lg transition-all hover:-translate-y-px overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, rgba(91,108,240,0.04), transparent 60%), var(--cx-bg-surface)",
        border: "1px solid var(--cx-border-subtle)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 1px rgba(91,108,240,0.25), 0 10px 40px -10px rgba(91,108,240,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* block hash strip */}
      <div className="absolute top-0 right-0 px-2 py-0.5 rounded-bl-md" style={{
        background: "var(--cx-bg-elevated)",
        borderLeft: "1px solid var(--cx-border-subtle)",
        borderBottom: "1px solid var(--cx-border-subtle)",
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--cx-text-tertiary)",
        letterSpacing: "0.08em",
      }}>
        BLK·{page.versions[0].blob.slice(2, 8)}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--cx-accent)",
          fontSize: 16,
        }}
      >
        [[{page.slug}]]
      </div>
      <div className="mt-2" style={{ color: "var(--cx-text-secondary)", fontSize: 12 }}>
        {page.claims.length} claims · {page.sourceIds.length} sources
      </div>
      <div className="mt-1" style={{ color: "var(--cx-text-tertiary)", fontSize: 12 }}>
        Updated {relTime(page.updatedAt)}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {page.tags.map((t) => (
          <TagPill key={t}>{t}</TagPill>
        ))}
        {page.disputes.some((d) => d.status === "open") && <TagPill tone="warning">open dispute</TagPill>}
      </div>
    </Link>
  );
}
