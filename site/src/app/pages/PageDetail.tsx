import { useParams, Link } from "react-router";
import { GitCommit, ShieldCheck, History, Edit3, Share2, Tag, Copy } from "lucide-react";
import { format } from "date-fns";

const MOCK_WIKI = {
  "sui-consensus": {
    title: "Sui Consensus Engine",
    content: `
The Sui Consensus Engine represents a paradigm shift in decentralized state replication. Unlike traditional blockchain architectures that rely on global consensus for all transactions, Sui introduces an object-centric model.

### Object-Centric Architecture

At the core of Sui's design is the concept of independent objects. Transactions that do not have overlapping objects can be processed entirely in parallel. This bypasses the traditional mempool and consensus bottleneck, allowing for unbounded horizontal scaling.

When a transaction only involves owned objects (e.g., a simple token transfer), it uses a fast-path mechanism based on Byzantine Consistent Broadcast (FastPay). This allows the transaction to complete in milliseconds.

### Bullshark and Narwhal

For complex transactions involving shared objects (e.g., interacting with a decentralized exchange smart contract), Sui employs a Directed Acyclic Graph (DAG) based mempool (Narwhal) and a consensus protocol (Bullshark).

Narwhal ensures the availability of data, while Bullshark orders the data to achieve consensus. This separation of concerns significantly increases throughput compared to monolithic consensus engines.

### Cryptographic Provenance

Every state transition in the Sui network is cryptographically signed and stored immutably. In the context of the Cortex knowledge base, this ensures that every edit, revision, and addition to a document can be independently verified against the on-chain history.

The Walrus storage layer handles the heavy lifting of storing the blob data for the document's content, while the Sui blockchain maintains the pointers and the chronological, verifiable history of the document's evolution.
    `,
    tags: ["consensus", "architecture", "sui-core"],
    versions: [
      { hash: "0x8a7b...1f2c", date: new Date(Date.now() - 1000 * 60 * 5), author: "0x7F...3B", message: "Update Bullshark details" },
      { hash: "0x5c4d...9e0a", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), author: "0x1A...9C", message: "Add FastPay references" },
      { hash: "0x2b1a...8d7e", date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), author: "0x99...2A", message: "Initial document creation" },
    ],
    blobId: "blob_5R9...xY2",
    objectId: "0x1122...aabb",
  }
};

export function PageDetail() {
  const { id } = useParams();
  const page = MOCK_WIKI[id as keyof typeof MOCK_WIKI] || MOCK_WIKI["sui-consensus"];

  return (
    <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto border-l border-r border-zinc-800">
      
      {/* Main Content */}
      <div className="flex-[3] flex flex-col border-r border-zinc-800 min-h-0 bg-[#050505]">
        
        {/* Document Header */}
        <div className="border-b border-zinc-800 p-8 lg:p-12 pb-8 bg-[#020202]">
          <div className="flex items-center gap-3 mb-6">
            {page.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 font-mono text-[10px] uppercase text-black border border-white px-2 py-1 bg-white font-bold">
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
          
          <h1 className="text-4xl lg:text-6xl font-bold text-white tracking-tighter mb-4 font-sans">
            {page.title}
          </h1>
          
          <div className="flex items-center gap-6 font-mono text-xs text-zinc-500 mt-8 uppercase font-bold">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span className="text-white">ON-CHAIN VERIFIED</span>
            </div>
            <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
              <span>OBJECT:</span>
              <span className="text-zinc-300">{page.objectId}</span>
              <button className="hover:text-white transition-colors"><Copy className="w-3 h-3" /></button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b border-zinc-800 px-8 py-3 flex items-center justify-between bg-[#020202] sticky top-0 backdrop-blur-none z-10">
          <div className="flex items-center gap-4 text-sm font-mono uppercase font-bold">
            <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <Edit3 className="w-4 h-4" />
              PROPOSE_EDIT
            </button>
            <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
              <Share2 className="w-4 h-4" />
              SHARE
            </button>
          </div>
          <div className="font-mono text-[10px] text-zinc-500 uppercase">
            BLOB_ID: {page.blobId}
          </div>
        </div>

        {/* Article Body */}
        <div className="p-8 lg:p-12 prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-zinc-300 prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-a:text-white prose-a:underline prose-a:underline-offset-4 prose-a:decoration-zinc-700 hover:prose-a:decoration-white font-sans bg-[#020202]">
          {page.content.split('\n\n').map((paragraph, idx) => {
            if (paragraph.startsWith('###')) {
              return <h3 key={idx} className="text-2xl mt-12 mb-6 border-b-2 border-white pb-2 inline-block uppercase tracking-tight">{paragraph.replace('### ', '')}</h3>;
            }
            return <p key={idx} className="mb-6 text-lg">{paragraph}</p>;
          })}
        </div>
      </div>

      {/* Sidebar: Provenance & History */}
      <div className="flex-1 flex flex-col bg-[#020202] min-w-[320px] border-l border-zinc-800">
        
        <div className="border-b border-zinc-800 p-4 bg-zinc-900/50">
          <h3 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
            <History className="w-4 h-4 text-white" />
            PROVENANCE_LOG
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
          <div className="relative">
            <div className="absolute top-2 bottom-2 left-[11px] w-px bg-zinc-800" />
            
            {page.versions.map((v, i) => (
              <div key={v.hash} className="relative pl-8 pb-6 last:pb-0 group">
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-none flex items-center justify-center bg-[#020202] border transition-colors ${i === 0 ? 'border-white text-white' : 'border-zinc-800 text-zinc-600 group-hover:border-zinc-500 group-hover:text-white'}`}>
                  <GitCommit className="w-3 h-3" />
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-white font-bold">{v.hash}</span>
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">
                      {format(v.date, 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 mt-1 font-sans">
                    {v.message}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 mt-2 flex items-center gap-2 uppercase">
                    <span className="border border-zinc-800 px-1.5 py-0.5">AUTHOR: {v.author}</span>
                    {i === 0 && <span className="bg-white text-black font-bold px-1.5 py-0.5">LATEST</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 p-4 bg-zinc-900/50 flex flex-col gap-3">
          <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest">NETWORK_VALIDATION</h4>
          <div className="flex items-center justify-between text-xs font-mono uppercase">
            <span className="text-zinc-500">Sui Epoch:</span>
            <span className="text-white font-bold">512</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono uppercase">
            <span className="text-zinc-500">Walrus Replicas:</span>
            <span className="text-white font-bold">99/100</span>
          </div>
          <button className="w-full mt-4 py-3 border border-white hover:bg-white hover:text-black text-xs font-mono font-bold transition-colors text-white uppercase tracking-wider">
            VIEW_RAW_TRANSACTION
          </button>
        </div>
      </div>
      
    </div>
  );
}
