import { NavLink, useLocation } from "react-router";
import { ExternalLink, Hexagon } from "lucide-react";

const links = [
  { to: "/", label: "Pages", end: true },
  { to: "/sources", label: "Sources" },
  { to: "/graph", label: "Graph" },
  { to: "/explorer", label: "Explorer", external: true },
];

export function NavBar() {
  const loc = useLocation();
  const isPagesActive = loc.pathname === "/" || (loc.pathname !== "/graph" && loc.pathname !== "/sources" && loc.pathname !== "/explorer");
  return (
    <header
      className="sticky top-0 z-50 relative overflow-hidden"
      style={{
        background: "rgba(7,7,11,0.78)",
        backdropFilter: "blur(14px) saturate(140%)",
        borderBottom: "1px solid var(--cx-border-subtle)",
        boxShadow: "0 1px 0 0 rgba(91,108,240,0.12), 0 10px 30px -10px rgba(0,0,0,0.6)",
      }}
    >
      {/* animated chain scanner */}
      <div className="absolute inset-x-0 bottom-0 h-px overflow-hidden" aria-hidden>
        <div
          className="cx-scan-x"
          style={{
            height: 1,
            width: "40%",
            background: "linear-gradient(90deg, transparent, var(--cx-accent), var(--cx-cyan), transparent)",
          }}
        />
      </div>

      <div className="max-w-[1200px] mx-auto px-6 h-14 flex items-center justify-between">
        <NavLink to="/" className="inline-flex items-center gap-2 tracking-tight cx-glow-text" style={{ color: "var(--cx-accent)", fontWeight: 700, fontSize: 20, letterSpacing: "0.14em" }}>
          <Hexagon size={18} className="cx-pulse" strokeWidth={2.2} />
          CORTEX
          <span className="ml-1" style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cx-text-tertiary)", letterSpacing: "0.2em" }}>
            // SUI · WALRUS
          </span>
        </NavLink>
        <nav className="flex items-center gap-6">
          {links.map((l) => {
            const active = l.to === "/" ? isPagesActive : loc.pathname.startsWith(l.to);
            return (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className="relative inline-flex items-center gap-1 py-1 transition-colors"
                style={{
                  color: active ? "var(--cx-accent)" : "var(--cx-text-secondary)",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                {l.label}
                {l.external && <ExternalLink size={12} />}
                {active && (
                  <span
                    className="absolute left-0 right-0 -bottom-[15px] h-[2px]"
                    style={{
                      background: "linear-gradient(90deg, transparent, var(--cx-accent), var(--cx-cyan), transparent)",
                      boxShadow: "0 0 12px rgba(91,108,240,0.7)",
                    }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
