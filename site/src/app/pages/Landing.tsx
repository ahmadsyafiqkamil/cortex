import { Link } from "react-router";
import { Hexagon, ArrowRight, Database, ShieldCheck, Network, Terminal } from "lucide-react";

export function Landing() {
  return (
    <div className="min-h-screen bg-[#020202] text-zinc-300 font-sans selection:bg-white selection:text-black flex flex-col">
      {/* Navbar */}
      <header className="border-b-2 border-zinc-100 bg-[#020202] sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 h-16 max-w-[1600px] mx-auto w-full">
          <div className="flex items-center gap-3">
            <Hexagon className="w-6 h-6 text-white fill-white" />
            <span className="font-mono font-bold tracking-widest text-lg uppercase text-white">Cortex_</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs uppercase font-bold tracking-wider">
            <a href="#architecture" className="hidden md:block text-zinc-400 hover:text-white transition-colors">Architecture</a>
            <a href="#provenance" className="hidden md:block text-zinc-400 hover:text-white transition-colors">Provenance</a>
            <Link 
              to="/app" 
              className="bg-white text-black px-6 py-2 border-2 border-white hover:bg-transparent hover:text-white transition-colors flex items-center gap-2"
            >
              Enter_App <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full max-w-[1600px] mx-auto border-l-2 border-r-2 border-zinc-800">
        
        {/* Hero Section */}
        <section className="flex flex-col lg:flex-row border-b-2 border-zinc-800 min-h-[70vh]">
          <div className="flex-1 p-8 lg:p-16 flex flex-col justify-center border-b-2 lg:border-b-0 lg:border-r-2 border-zinc-800">
            <div className="inline-block border-2 border-white px-3 py-1 font-mono text-xs font-bold uppercase text-white w-fit mb-8">
              v1.0.0-beta / Sui Mainnet
            </div>
            <h1 className="text-6xl lg:text-8xl xl:text-[10rem] font-bold text-white tracking-tighter leading-none mb-8">
              KNOWLEDGE<br />
              <span className="text-zinc-600">IMMUTABLE.</span>
            </h1>
            <p className="text-xl lg:text-2xl text-zinc-400 max-w-2xl font-medium leading-relaxed mb-12">
              A decentralized, censorship-resistant wiki powered by Walrus storage and the Sui consensus engine. Zero single points of failure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 font-mono font-bold uppercase">
              <Link 
                to="/app" 
                className="bg-white text-black px-8 py-4 border-2 border-white hover:bg-transparent hover:text-white transition-colors text-center flex items-center justify-center gap-2 text-sm"
              >
                Launch_Client <ArrowRight className="w-4 h-4" />
              </Link>
              <button className="bg-transparent text-white px-8 py-4 border-2 border-zinc-700 hover:border-white transition-colors text-center flex items-center justify-center gap-2 text-sm">
                <Terminal className="w-4 h-4" /> View_Docs
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-zinc-900/20 p-8 lg:p-16 flex flex-col justify-center relative overflow-hidden">
            {/* Decorative Grid */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
                backgroundSize: `40px 40px`
              }}
            />
            
            {/* Terminal Mockup */}
            <div className="relative z-10 border-2 border-white bg-[#020202] shadow-2xl">
              <div className="border-b-2 border-white px-4 py-2 flex items-center gap-2 bg-white text-black font-mono text-xs font-bold uppercase">
                <Terminal className="w-4 h-4" />
                cortex-daemon
              </div>
              <div className="p-6 font-mono text-sm text-zinc-400 flex flex-col gap-2 h-[300px] overflow-hidden">
                <p><span className="text-white">$</span> cortex init --network sui-mainnet</p>
                <p className="text-zinc-500">Initializing node connection...</p>
                <p className="text-white">✓ Connected to Sui RPC (34ms)</p>
                <p><span className="text-white">$</span> cortex sync walrus --epoch 512</p>
                <p className="text-zinc-500">Fetching blob indices...</p>
                <p className="text-white">✓ Synchronized 14,203 blobs</p>
                <p><span className="text-white">$</span> cortex verify --hash 0x8a7b...1f2c</p>
                <p className="text-zinc-500">Verifying cryptographic signatures...</p>
                <p className="text-white border-l-2 border-white pl-3 py-1 my-2 bg-zinc-900">
                  STATUS: VALID<br/>
                  PROVENANCE: CONFIRMED
                </p>
                <p className="animate-pulse">_</p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="architecture" className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-zinc-800">
          <div className="p-8 lg:p-12 border-b-2 md:border-b-0 md:border-r-2 border-zinc-800 hover:bg-zinc-900/30 transition-colors">
            <Database className="w-10 h-10 text-white mb-6" />
            <h3 className="text-2xl font-bold text-white mb-4 uppercase tracking-tight">Walrus Storage</h3>
            <p className="text-zinc-400 leading-relaxed">
              Heavy binary payloads and document blobs are encoded and distributed across the Walrus decentralized storage network, ensuring permanent availability without bloat.
            </p>
          </div>
          <div className="p-8 lg:p-12 border-b-2 md:border-b-0 md:border-r-2 border-zinc-800 hover:bg-zinc-900/30 transition-colors">
            <ShieldCheck className="w-10 h-10 text-white mb-6" />
            <h3 className="text-2xl font-bold text-white mb-4 uppercase tracking-tight">On-Chain Provenance</h3>
            <p className="text-zinc-400 leading-relaxed">
              Every edit, revision, and metadata change is signed and anchored to a Sui Object. The history of knowledge is transparent, verifiable, and immutable.
            </p>
          </div>
          <div className="p-8 lg:p-12 hover:bg-zinc-900/30 transition-colors">
            <Network className="w-10 h-10 text-white mb-6" />
            <h3 className="text-2xl font-bold text-white mb-4 uppercase tracking-tight">Graph Topology</h3>
            <p className="text-zinc-400 leading-relaxed">
              Knowledge isn't linear. Cortex maps relationships between documents automatically, allowing you to visualize and traverse interconnected concepts seamlessly.
            </p>
          </div>
        </section>

      </main>

      <footer className="border-t-2 border-zinc-800 py-8 text-center font-mono text-xs text-zinc-500 uppercase font-bold bg-[#020202]">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between px-6">
          <span>© 2026 Cortex_ Network</span>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">GitHub</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
