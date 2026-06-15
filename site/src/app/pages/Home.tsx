import { Link } from "react-router";
import { ArrowRight, Clock, FileText, Activity, Hash, Layers } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const RECENT_PAGES = [
  { id: "sui-consensus", title: "Sui Consensus Engine", author: "0x7F...3B", timestamp: new Date(Date.now() - 1000 * 60 * 5) },
  { id: "walrus-storage", title: "Walrus Blob Storage Architecture", author: "0x1A...9C", timestamp: new Date(Date.now() - 1000 * 60 * 45) },
  { id: "move-patterns", title: "Move Language Design Patterns", author: "0x99...2A", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) },
  { id: "zero-knowledge", title: "ZK Proofs in Cortex", author: "0x4D...EF", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  { id: "tokenomics", title: "Ecosystem Tokenomics Draft", author: "0x2B...11", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) },
];

const SYSTEM_STATS = [
  { label: "TOTAL_NODES", value: "14,203", icon: <Layers className="w-4 h-4" /> },
  { label: "STORAGE_EPOCH", value: "E-492", icon: <Clock className="w-4 h-4" /> },
  { label: "BLOB_SIZE", value: "2.4 TB", icon: <FileText className="w-4 h-4" /> },
  { label: "TPS", value: "12,400", icon: <Activity className="w-4 h-4" /> },
];

export function Home() {
  return (
    <div className="flex-1 flex p-6 max-w-[1400px] mx-auto w-full gap-6">
      
      {/* Left Column: Recent Updates */}
      <div className="flex-[2] flex flex-col gap-6">
        <div className="border border-zinc-800 bg-[#020202] flex flex-col">
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-white" />
              LATEST_MUTATIONS
            </h2>
            <span className="font-mono text-[10px] text-zinc-500 uppercase">SORT: TIMESTAMP_DESC</span>
          </div>
          
          <div className="flex flex-col">
            {RECENT_PAGES.map((page, i) => (
              <Link 
                key={page.id} 
                to={`/app/wiki/${page.id}`}
                className={`group flex items-center justify-between px-4 py-4 hover:bg-white hover:text-black transition-colors ${i !== RECENT_PAGES.length - 1 ? 'border-b border-zinc-800' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="font-mono text-xs text-zinc-600 mt-0.5 group-hover:text-black transition-colors">
                    {(i + 1).toString().padStart(2, '0')}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-200 group-hover:text-black transition-colors text-lg tracking-tight">
                      {page.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-zinc-500 group-hover:text-black/70 transition-colors uppercase">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {page.author}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(page.timestamp)} ago
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-700 group-hover:text-black transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: System Status & Quick Links */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="border border-zinc-800 bg-[#020202]">
          <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-white animate-pulse" />
              SYSTEM_TELEMETRY
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-zinc-800">
            {SYSTEM_STATS.map((stat) => (
              <div key={stat.label} className="bg-[#020202] p-4 flex flex-col gap-2 hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 uppercase">
                  {stat.icon}
                  {stat.label}
                </div>
                <div className="font-mono text-xl text-white font-bold tracking-tight">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-zinc-800 bg-[#020202]">
          <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-zinc-600" />
              TERMINAL_ACCESS
            </h2>
          </div>
          <div className="p-4 font-mono text-xs text-zinc-400 flex flex-col gap-2">
            <p className="text-white">{'>'} initializing cortex client...</p>
            <p>{'>'} fetching walrus blob indices...</p>
            <p>{'>'} verifying sui signatures...</p>
            <p className="text-white">{'>'} connection established.</p>
            <div className="mt-4 flex items-center gap-2 border border-zinc-800 p-2 bg-black focus-within:border-white transition-colors">
              <span className="text-zinc-600">$</span>
              <input type="text" className="bg-transparent border-none outline-none w-full text-white" placeholder="_" />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
