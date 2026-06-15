import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { pages } from "../data/mock";

export function GraphScreen() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);

  const W = 1200;
  const H = 640;

  const nodes = useMemo(
    () =>
      pages.map((p) => ({
        slug: p.slug,
        x: 60 + p.pos.x * (W - 120),
        y: 40 + p.pos.y * (H - 80),
        r: 8 + Math.min(16, p.claims.length * 4),
        disputed: p.disputes.some((d) => d.status === "open"),
      })),
    []
  );

  const edges = useMemo(() => {
    const out: { a: string; b: string }[] = [];
    const seen = new Set<string>();
    for (const p of pages) {
      for (const l of p.links) {
        const key = [p.slug, l].sort().join("|");
        if (seen.has(key)) continue;
        if (!pages.find((x) => x.slug === l)) continue;
        seen.add(key);
        out.push({ a: p.slug, b: l });
      }
    }
    return out;
  }, []);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return null;
    return new Set(pages.filter((p) => p.slug.includes(s) || p.title.toLowerCase().includes(s)).map((p) => p.slug));
  }, [q]);

  const posBy = (slug: string) => nodes.find((n) => n.slug === slug)!;

  return (
    <div className="relative" style={{ height: "calc(100vh - 56px)" }}>
      {/* Search */}
      <div className="absolute top-4 right-6 z-10 w-72">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md"
          style={{ background: "var(--cx-bg-elevated)", border: "1px solid var(--cx-border-subtle)" }}
        >
          <Search size={14} color="var(--cx-text-tertiary)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search node..."
            className="bg-transparent outline-none w-full"
            style={{ color: "var(--cx-text-primary)", fontSize: 13 }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 z-10 space-y-2" style={{ color: "var(--cx-text-secondary)", fontSize: 12 }}>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: "var(--cx-accent)" }} /> Page
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, background: "var(--cx-warning)" }} /> Disputed
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block" style={{ width: 14, height: 1, background: "var(--cx-border-visible)" }} /> Link
          </span>
        </div>
        <div style={{ color: "var(--cx-text-tertiary)" }}>Click a node to open page · Hover to reveal slug</div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="cx-node-accent" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7B8AF8" />
            <stop offset="100%" stopColor="#3B4AD0" />
          </radialGradient>
          <radialGradient id="cx-node-warn" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>
          <linearGradient id="cx-edge" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(91,108,240,0.4)" />
            <stop offset="100%" stopColor="rgba(77,217,255,0.2)" />
          </linearGradient>
          <filter id="cx-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern id="cx-bg-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="rgba(140,160,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#cx-bg-grid)" />
        {edges.map((e, i) => {
          const a = posBy(e.a);
          const b = posBy(e.b);
          const active = matches ? matches.has(e.a) && matches.has(e.b) : true;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#cx-edge)"
              strokeWidth={1.2}
              opacity={active ? 0.9 : 0.15}
            />
          );
        })}
        {nodes.map((n) => {
          const isMatch = !matches || matches.has(n.slug);
          const isHover = hover === n.slug;
          const fill = n.disputed ? "url(#cx-node-warn)" : "url(#cx-node-accent)";
          const stroke = n.disputed ? "var(--cx-warning)" : "var(--cx-accent)";
          return (
            <g
              key={n.slug}
              style={{ cursor: "pointer", opacity: isMatch ? 1 : 0.2 }}
              onClick={() => navigate(`/${n.slug}`)}
              onMouseEnter={() => setHover(n.slug)}
              onMouseLeave={() => setHover(null)}
            >
              <circle cx={n.x} cy={n.y} r={n.r + 8} fill={stroke} opacity={isHover ? 0.25 : 0.12} filter="url(#cx-glow)" />
              <circle cx={n.x} cy={n.y} r={n.r + (isHover ? 4 : 0)} fill={fill} stroke={stroke} strokeOpacity={0.6} />
              <circle cx={n.x} cy={n.y} r={n.r + 10} fill="none" stroke={stroke} strokeOpacity={isHover ? 0.5 : 0.15} strokeDasharray="2 4" />
              {(isHover || matches) && (
                <text
                  x={n.x}
                  y={n.y - n.r - 8}
                  textAnchor="middle"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--cx-text-primary)" }}
                >
                  {n.slug}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
