import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { pages, sources } from "../data/mock";
import { PageCard } from "../components/PageCard";
import { MonoAddress } from "../components/MonoAddress";

export function HomeScreen() {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pages;
    return pages.filter(
      (p) =>
        p.slug.toLowerCase().includes(s) ||
        p.title.toLowerCase().includes(s) ||
        p.tags.some((t) => t.toLowerCase().includes(s))
    );
  }, [q]);

  return (
    <div className="px-6 pb-20">
      <section className="max-w-[720px] mx-auto pt-16 text-center relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{
          background: "var(--cx-accent-muted)",
          border: "1px solid rgba(91,108,240,0.25)",
          color: "var(--cx-accent-hover)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.15em",
        }}>
          <span className="inline-block rounded-full cx-pulse" style={{ width: 6, height: 6, background: "var(--cx-success)", boxShadow: "0 0 8px var(--cx-success)" }} />
          ONCHAIN · SUI MAINNET
        </div>
        <h1 className="cx-glow-text" style={{ fontSize: 48, fontWeight: 600, letterSpacing: "-0.03em", color: "var(--cx-text-primary)", lineHeight: 1.1 }}>
          Knowledge Base
        </h1>
        <p className="mt-4" style={{ color: "var(--cx-text-secondary)", fontSize: 14, maxWidth: 520, margin: "16px auto 0" }}>
          Decentralized wiki. Immutable blobs on Walrus, coordinated by Sui. Every claim traces to its raw source.
        </p>
        <p className="mt-5 inline-flex items-center gap-2" style={{ color: "var(--cx-text-secondary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
          <span>{pages.length} pages</span>
          <Dot />
          <span>{sources.length} sources</span>
          <Dot />
          <span>Updated 2h ago</span>
        </p>
      </section>

      <section className="max-w-[720px] mx-auto mt-10">
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
          style={{
            background: "var(--cx-bg-surface)",
            border: `1px solid ${focused ? "var(--cx-accent)" : "var(--cx-border-subtle)"}`,
          }}
        >
          <Search size={16} color="var(--cx-text-tertiary)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search pages..."
            className="bg-transparent outline-none w-full"
            style={{ color: "var(--cx-text-primary)", fontSize: 14 }}
          />
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((p) => (
          <PageCard key={p.slug} page={p} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16" style={{ color: "var(--cx-text-secondary)" }}>
            <div style={{ fontSize: 16 }}>No pages match "{q}"</div>
            <div className="mt-2" style={{ color: "var(--cx-text-tertiary)", fontSize: 14 }}>
              Try a different keyword or clear the search.
            </div>
          </div>
        )}
      </section>

      <footer className="max-w-[1200px] mx-auto mt-20 pt-8 flex items-center justify-between" style={{ borderTop: "1px solid var(--cx-border-subtle)" }}>
        <div style={{ color: "var(--cx-text-tertiary)", fontSize: 11 }}>
          Package ID: <MonoAddress value="0x823f0a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef012345" className="text-[11px]" />
        </div>
        <div style={{ color: "var(--cx-text-tertiary)", fontSize: 11 }}>
          Cortex — Verifiable provenance on Walrus & Sui
        </div>
      </footer>
    </div>
  );
}

function Dot() {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: 3, height: 3, background: "var(--cx-text-tertiary)" }}
    />
  );
}
