import { useParams, Link } from "react-router";
import { GitCommit, ShieldCheck, History, Edit3, Share2, Tag, Copy, AlertTriangle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { pages, pageBySlug } from "../data/mock";
import { AttestPanel } from "../components/AttestPanel";

const BLOB_URL = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

const INLINE_REGEX = /(\^\[blob:[^\]]+\])|(\[\[[^\]]+\]\])/g;

function parseInline(text: string) {
  const parts = text.split(INLINE_REGEX).filter(Boolean);
  return parts.map((part, i) => {
    const blobMatch = part.match(/^\^\[blob:([^\]]+)\]$/);
    if (blobMatch) {
      const blobId = blobMatch[1];
      return (
        <a
          key={i}
          href={`${BLOB_URL}/${blobId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-zinc-400 hover:text-white underline underline-offset-4 decoration-zinc-700 hover:decoration-white text-xs align-super no-underline hover:underline"
        >
          <span className="text-[10px] font-mono text-zinc-500">[blob:</span>
          <span className="text-[10px] font-mono">{blobId.slice(0, 8)}...</span>
          <span className="text-[10px] font-mono text-zinc-500">]</span>
          <ExternalLink className="w-3 h-3 text-zinc-600" />
        </a>
      );
    }
    const wikiMatch = part.match(/^\[\[([^\]]+)\]\]$/);
    if (wikiMatch) {
      const slug = wikiMatch[1].trim();
      const target = pageBySlug(slug);
      return (
        <Link
          key={i}
          to={`/app/wiki/${slug}`}
          className="text-white underline underline-offset-4 decoration-zinc-700 hover:decoration-white border-b border-zinc-700 hover:border-white"
        >
          {target?.title ?? slug.replace(/-/g, " ")}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PageDetail() {
  const { slug } = useParams();
  const page = slug ? pageBySlug(slug) : undefined;

  if (!page) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#020202]">
        <div className="text-center p-12">
          <div className="font-mono text-xs text-zinc-500 uppercase tracking-widest mb-4">404_PAGE_NOT_FOUND</div>
          <h2 className="text-2xl font-bold text-white mb-4 font-mono uppercase tracking-tighter">
            {(slug || "UNKNOWN").replace(/-/g, "_")}
          </h2>
          <Link to="/app" className="font-mono text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-white px-6 py-3 uppercase transition-colors inline-block">
            RETURN_TO_INDEX
          </Link>
        </div>
      </div>
    );
  }

  const hasOpenDispute = page.disputes.some((d) => d.status === "open");

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

          <div className="flex items-center gap-6 font-mono text-xs text-zinc-500 mt-8 uppercase font-bold flex-wrap">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span className="text-white">PROVENANCE_VERIFIED</span>
            </div>
            <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
              <span>BLOB:</span>
              <span className="text-zinc-300 truncate max-w-[160px]">{page.blobId.slice(0, 20)}...</span>
              <button className="hover:text-white transition-colors" onClick={() => navigator.clipboard.writeText(page.blobId)}><Copy className="w-3 h-3" /></button>
            </div>
            {page.objectId && (
              <div className="flex items-center gap-2 border-l border-zinc-800 pl-6">
                <span>OBJECT:</span>
                <span className="text-zinc-300 truncate max-w-[160px]">{page.objectId}</span>
              </div>
            )}
          </div>
        </div>

        {/* Dispute Banner */}
        {hasOpenDispute && (
          <div className="border-b border-amber-500/50 bg-amber-500/5 px-8 py-3 flex items-center gap-2 font-mono text-xs uppercase">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-amber-400 font-bold">{page.disputes.filter(d => d.status === "open").length} OPEN DISPUTE(S)</span>
            <a href="#disputes" className="text-amber-500 hover:text-amber-300 ml-auto">→ VIEW</a>
          </div>
        )}

        {/* Toolbar */}
        <div className="border-b border-zinc-800 px-8 py-3 flex items-center justify-between bg-[#020202] sticky top-0 z-10">
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
          <div className="font-mono text-[10px] text-zinc-500 uppercase hidden sm:block">
            BLOB_ID: {page.blobId.slice(0, 12)}...
          </div>
        </div>

        {/* Article Body */}
        <div className="p-8 lg:p-12 prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-zinc-300 prose-headings:text-white prose-headings:font-bold prose-headings:tracking-tight prose-a:text-white prose-a:underline prose-a:underline-offset-4 prose-a:decoration-zinc-700 hover:prose-a:decoration-white font-sans bg-[#020202]">
          {page.content ? page.content.split('\n\n').map((paragraph, idx) => {
            if (paragraph.startsWith('###')) {
              return <h3 key={idx} className="text-2xl mt-12 mb-6 border-b-2 border-white pb-2 inline-block uppercase tracking-tight">{paragraph.replace('### ', '')}</h3>;
            }
            if (paragraph.startsWith('##')) {
              return <h2 key={idx} className="text-3xl mt-14 mb-8 border-b-2 border-white pb-3 uppercase tracking-tighter font-bold">{paragraph.replace('## ', '')}</h2>;
            }
            if (paragraph.startsWith('# ')) {
              return <h2 key={idx} className="text-3xl mt-14 mb-8 border-b-2 border-white pb-3 uppercase tracking-tighter font-bold">{paragraph.replace('# ', '')}</h2>;
            }
            if (paragraph.startsWith('- ')) {
              const items = paragraph.split('\n').filter(l => l.startsWith('- '));
              return (
                <ul key={idx} className="list-disc list-inside mb-6 space-y-2">
                  {items.map((item, i2) => (
                    <li key={i2} className="text-lg text-zinc-300">{parseInline(item.replace('- ', ''))}</li>
                  ))}
                </ul>
              );
            }
            if (paragraph.startsWith('> ')) {
              return (
                <blockquote key={idx} className="border-l-2 border-white pl-4 py-2 mb-6 italic text-zinc-400">
                  {parseInline(paragraph.replace(/^> /gm, ''))}
                </blockquote>
              );
            }
            if (paragraph.startsWith('```')) {
              const lines = paragraph.split('\n');
              const code = lines.slice(1, -1).join('\n');
              return (
                <pre key={idx} className="border border-zinc-800 bg-black p-4 mb-6 overflow-x-auto font-mono text-xs text-zinc-300">
                  <code>{code}</code>
                </pre>
              );
            }
            if (paragraph.startsWith('[') && paragraph.includes(']: ')) {
              return null;
            }
            return <p key={idx} className="mb-6 text-lg">{parseInline(paragraph)}</p>;
          }) : (
            <div className="text-center p-12 font-mono text-xs text-zinc-500 uppercase">
              // NO_CONTENT
            </div>
          )}
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
                    <span className="font-mono text-xs text-white font-bold truncate max-w-[100px]">{v.hash.slice(0, 10)}...</span>
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">
                      {format(new Date(v.date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400 mt-1 font-sans">
                    {v.message}
                  </div>
                  {v.author && (
                    <div className="font-mono text-[10px] text-zinc-500 mt-2 flex items-center gap-2 uppercase">
                      <span className="border border-zinc-800 px-1.5 py-0.5 truncate max-w-[140px]">AUTHOR: {v.author}</span>
                      {i === 0 && <span className="bg-white text-black font-bold px-1.5 py-0.5">LATEST</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Disputes in sidebar */}
          {page.disputes.length > 0 && (
            <div id="disputes" className="border-t border-zinc-800 pt-4">
              <h4 className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-3">
                ACTIVE_DISPUTES
              </h4>
              {page.disputes.map(d => (
                <div key={d.id} className="border border-zinc-800 p-3 mb-2 bg-zinc-900/30">
                  <div className="font-mono text-xs text-white font-bold mb-1">
                    {d.status === "open" ? "OPEN" : "RESOLVED"}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-400 mb-2">
                    RAISED_BY: {d.raisedBy.slice(0, 16)}...
                  </div>
                  {d.counterSource && (
                    <div className="font-mono text-[10px] text-zinc-500 truncate">
                      COUNTER: {d.counterSource.slice(0, 16)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sources sidebar */}
        {page.sourceIds.length > 0 && (
          <div className="border-t border-zinc-800 p-4 bg-zinc-900/20 flex flex-col gap-2">
            <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest">SOURCES</h4>
            {page.sourceIds.map((sid, i) => (
              <a
                key={sid}
                href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${sid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
              >
                <span className="text-zinc-600">{String(i + 1).padStart(2, '0')}.</span>
                <span className="truncate max-w-[180px]">{sid}</span>
                <ExternalLink className="w-3 h-3 text-zinc-600 flex-shrink-0" />
              </a>
            ))}
          </div>
        )}

        <div className="border-t border-zinc-800 p-4 bg-zinc-900/50 flex flex-col gap-3">
          <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest">NETWORK_VALIDATION</h4>
          <div className="flex items-center justify-between text-xs font-mono uppercase">
            <span className="text-zinc-500">Sui Network:</span>
            <span className="text-white font-bold">TESTNET</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono uppercase">
            <span className="text-zinc-500">Versions:</span>
            <span className="text-white font-bold">{page.versions.length}</span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono uppercase">
            <span className="text-zinc-500">Sources:</span>
            <span className="text-white font-bold">{page.sourceIds.length}</span>
          </div>
          <button className="w-full mt-4 py-3 border border-white hover:bg-white hover:text-black text-xs font-mono font-bold transition-colors text-white uppercase tracking-wider">
            VIEW_BLOB_ON_WALRUS
          </button>
        </div>

        <AttestPanel
          pageSlug={page.slug}
          sourceCount={page.sourceIds.length}
          hasOpenDispute={hasOpenDispute}
        />
      </div>

    </div>
  );
}
