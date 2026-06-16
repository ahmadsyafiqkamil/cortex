import { useState, useMemo } from "react";
import { Link } from "react-router";
import { ZoomIn, ZoomOut, Maximize, Filter } from "lucide-react";
import { clsx } from "clsx";
import { pages } from "../data/mock";

const W = 1200;
const H = 700;

export function GraphView() {
  const [zoom, setZoom] = useState(0.7);

  const nodes = useMemo(() =>
    pages.map((p) => ({
      id: p.slug,
      x: 100 + p.pos.x * (W - 200),
      y: 100 + p.pos.y * (H - 200),
      label: p.title,
      size: Math.min(p.links.length, 5) >= 4 ? "lg" : Math.min(p.links.length, 3) >= 2 ? "md" : "sm",
      active: p.disputes.length === 0,
      linkCount: p.links.length,
    })), []
  );

  const edges = useMemo(() => {
    const out: { from: string; to: string }[] = [];
    const seen = new Set<string>();
    for (const p of pages) {
      for (const l of p.links) {
        const key = [p.slug, l].sort().join("|");
        if (seen.has(key)) continue;
        if (!pages.find((x) => x.slug === l)) continue;
        seen.add(key);
        out.push({ from: p.slug, to: l });
      }
    }
    return out;
  }, []);

  return (
    <div className="flex-1 flex flex-col w-full h-full border-t border-zinc-800 bg-[#020202] overflow-hidden relative">

      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#020202] border-2 border-zinc-800 p-1 flex items-center hover:border-white transition-colors">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
              <ZoomIn className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors border-l-2 border-zinc-800" onClick={() => setZoom(z => Math.max(z - 0.2, 0.3))}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors border-l-2 border-zinc-800" onClick={() => setZoom(0.7)}>
              <Maximize className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#020202] border-2 border-zinc-800 flex items-center px-3 py-1.5 h-12 font-mono text-xs text-white uppercase font-bold">
            ZOOM: {Math.round(zoom * 100)}% · NODES: {nodes.length}
          </div>
        </div>

        <div className="bg-[#020202] border-2 border-white flex items-center px-4 py-1.5 h-12 font-mono text-xs text-white gap-2 pointer-events-auto cursor-pointer hover:bg-white hover:text-black transition-colors uppercase font-bold">
          <Filter className="w-4 h-4" />
          {pages.length} PAGES
        </div>
      </div>

      {/* Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.12] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #333 1px, transparent 1px), linear-gradient(to bottom, #333 1px, transparent 1px)`,
          backgroundSize: `${40 * zoom}px ${40 * zoom}px`
        }}
      />

      {/* Graph Area */}
      <div
        className="absolute inset-0 cursor-move transition-transform duration-200 origin-center"
        style={{ transform: `scale(${zoom})` }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="25" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffffff" />
            </marker>
          </defs>
          {edges.map((edge, i) => {
            const fromNode = nodes.find(n => n.id === edge.from);
            const toNode = nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <line
                key={i}
                x1={fromNode.x} y1={fromNode.y}
                x2={toNode.x} y2={toNode.y}
                stroke="#ffffff"
                strokeWidth="1.5"
                markerEnd="url(#arrow)"
                className="opacity-30"
              />
            );
          })}
        </svg>

        {nodes.map((node) => (
          <Link
            key={node.id}
            to={`/app/wiki/${node.id}`}
            className={clsx(
              "absolute -translate-x-1/2 -translate-y-1/2 border-2 px-3 py-1.5 font-mono text-xs transition-colors cursor-pointer group font-bold uppercase",
              node.active
                ? "bg-white border-white text-black shadow-none"
                : "bg-[#020202] border-zinc-800 text-zinc-400 hover:border-white hover:text-white"
            )}
            style={{
              left: node.x,
              top: node.y,
              fontSize: node.size === "lg" ? 11 : node.size === "md" ? 10 : 9,
            }}
          >
            {!node.active && (
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-500 border border-amber-500" />
            )}
            <div className="flex items-center gap-2">
              <span className={clsx("w-2 h-2", node.active ? "bg-black" : "bg-zinc-600")} />
              <span className="max-w-[140px] truncate">{node.label}</span>
            </div>

            <div className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#020202] border border-white p-2 text-[10px] whitespace-nowrap z-20 shadow-none pointer-events-none text-white font-bold uppercase">
              SLUG: {node.id}<br />
              LINKS: {node.linkCount}
            </div>
          </Link>
        ))}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="font-mono text-xs text-zinc-500 uppercase">NO_GRAPH_DATA</div>
          </div>
        )}
      </div>

    </div>
  );
}
