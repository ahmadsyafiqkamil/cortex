import { useState } from "react";
import { ZoomIn, ZoomOut, Maximize, Filter } from "lucide-react";
import { clsx } from "clsx";

const NODES = [
  { id: "sui-consensus", x: 400, y: 300, label: "Sui Consensus", size: "lg", active: true },
  { id: "narwhal", x: 250, y: 200, label: "Narwhal Mempool", size: "md" },
  { id: "bullshark", x: 550, y: 200, label: "Bullshark", size: "md" },
  { id: "walrus", x: 400, y: 500, label: "Walrus Storage", size: "lg" },
  { id: "redstuff", x: 250, y: 600, label: "Red Stuff Encoding", size: "sm" },
  { id: "sui-objects", x: 600, y: 400, label: "Object Model", size: "md" },
  { id: "move-vm", x: 750, y: 350, label: "Move VM", size: "md" },
];

const EDGES = [
  { from: "sui-consensus", to: "narwhal" },
  { from: "sui-consensus", to: "bullshark" },
  { from: "sui-consensus", to: "walrus" },
  { from: "walrus", to: "redstuff" },
  { from: "sui-consensus", to: "sui-objects" },
  { from: "sui-objects", to: "move-vm" },
];

export function GraphView() {
  const [zoom, setZoom] = useState(1);

  return (
    <div className="flex-1 flex flex-col w-full h-full border-t border-zinc-800 bg-[#020202] overflow-hidden relative">
      
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="bg-[#020202] border-2 border-zinc-800 p-1 flex items-center hover:border-white transition-colors">
            <button className="p-2 text-zinc-500 hover:text-white transition-colors" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
              <ZoomIn className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors border-l-2 border-zinc-800" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
              <ZoomOut className="w-4 h-4" />
            </button>
            <button className="p-2 text-zinc-500 hover:text-white transition-colors border-l-2 border-zinc-800" onClick={() => setZoom(1)}>
              <Maximize className="w-4 h-4" />
            </button>
          </div>
          
          <div className="bg-[#020202] border-2 border-zinc-800 flex items-center px-3 py-1.5 h-12 font-mono text-xs text-white uppercase font-bold">
            ZOOM: {Math.round(zoom * 100)}%
          </div>
        </div>
        
        <div className="bg-[#020202] border-2 border-white flex items-center px-4 py-1.5 h-12 font-mono text-xs text-white gap-2 pointer-events-auto cursor-pointer hover:bg-white hover:text-black transition-colors uppercase font-bold">
          <Filter className="w-4 h-4" />
          FILTER_NODES
        </div>
      </div>

      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
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
          {EDGES.map((edge, i) => {
            const fromNode = NODES.find(n => n.id === edge.from);
            const toNode = NODES.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;
            return (
              <line 
                key={i}
                x1={fromNode.x} y1={fromNode.y}
                x2={toNode.x} y2={toNode.y}
                stroke="#ffffff"
                strokeWidth="2"
                markerEnd="url(#arrow)"
                className="opacity-40"
              />
            );
          })}
        </svg>

        {NODES.map((node) => (
          <div
            key={node.id}
            className={clsx(
              "absolute -translate-x-1/2 -translate-y-1/2 border-2 px-4 py-2 font-mono text-xs transition-colors cursor-pointer group font-bold uppercase",
              node.active 
                ? "bg-white border-white text-black shadow-none" 
                : "bg-[#020202] border-zinc-800 text-zinc-400 hover:border-white hover:text-white"
            )}
            style={{ 
              left: node.x, 
              top: node.y,
            }}
          >
            {node.active && (
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-black border border-white" />
            )}
            <div className="flex items-center gap-2">
              <span className={clsx("w-2 h-2", node.active ? "bg-black" : "bg-zinc-600")} />
              {node.label}
            </div>
            
            <div className="absolute top-full left-0 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#020202] border border-white p-2 text-[10px] whitespace-nowrap z-20 shadow-none pointer-events-none text-white font-bold uppercase">
              ID: {node.id}<br/>
              EDGES: {EDGES.filter(e => e.from === node.id || e.to === node.id).length}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
