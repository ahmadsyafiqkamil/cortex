import { useParams, Link } from "react-router";
import { GitCommit, ShieldCheck, History, Edit3, Share2, Tag, Copy, AlertTriangle, ExternalLink, Loader, Save, X } from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  useSuiClient,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { pageBySlug } from "../data/mock";
import { AttestPanel } from "../components/AttestPanel";
import { DisputePanel } from "../components/DisputePanel";
import { EditPanel } from "../components/EditPanel";
import { ResolveDisputeButton } from "../components/ResolveDisputeButton";
import { DisputeDetailModal } from "../components/DisputeDetailModal";
import { DisputeNotice } from "../components/DisputeNotice";
import { PACKAGE_ID, WIKI_ID, PUBLISHER_URL } from "../lib/sui";

const BLOB_URL = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

function parseBlobIdFromResponse(text: string): string | null {
  try {
    const data = JSON.parse(text);
    return (
      data?.newlyCreated?.blobObject?.blobId
      || data?.alreadyExists?.blobId
      || data?.blobId
      || null
    );
  } catch {
    const m = text.match(/^blob_id=["']?([A-Za-z0-9_-]{10,})/m)
      || text.match(/"blobId"\s*:\s*"([^"]+)"/);
    if (m) return m[1];
    const trimmed = text.trim();
    if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
    return null;
  }
}

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
  const client = useSuiClient();
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  const [liveDisputesRaised, setLiveDisputesRaised] = useState<any[]>([]);
  const [resolvedDisputeIds, setResolvedDisputeIds] = useState<Set<string>>(new Set());
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editTxDigest, setEditTxDigest] = useState("");
  const [contributorCapId, setContributorCapId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchLiveDisputes = useCallback(async () => {
    if (!PACKAGE_ID || !slug) return;
    try {
      const [raisedResult, resolvedResult] = await Promise.all([
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::dispute::DisputeRaised` },
          limit: 100,
          order: "descending" as const,
        }),
        client.queryEvents({
          query: { MoveEventType: `${PACKAGE_ID}::dispute::DisputeResolved` },
          limit: 100,
          order: "descending" as const,
        }),
      ]);

      setLiveDisputesRaised(
        (raisedResult?.data ?? [])
          .map((e: any) => e.parsedJson)
          .filter((p: any) => p && p.page === slug)
      );

      const resolvedIds = new Set<string>();
      (resolvedResult?.data ?? [])
        .map((e: any) => e.parsedJson)
        .forEach((p: any) => {
          if (p.dispute_id) resolvedIds.add(p.dispute_id);
        });
      setResolvedDisputeIds(resolvedIds);
    } catch { /* keep prebuilt */ }
  }, [slug, client]);

  useEffect(() => { fetchLiveDisputes(); }, [fetchLiveDisputes]);

  const handleStartEdit = async (capId: string) => {
    if (!page) return;
    setContributorCapId(capId);
    setEditError("");
    setEditTxDigest("");
    setEditLoading(true);
    try {
      const resp = await fetch(`${BLOB_URL}/${page.blobId}`);
      if (!resp.ok) throw new Error(`Failed to fetch blob: ${resp.status}`);
      const rawMd = await resp.text();
      setEditContent(rawMd);
      setEditing(true);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to load page content");
    } finally {
      setEditLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !page) return;
    setSaving(true);
    setEditError("");

    try {
      const resp = await fetch(PUBLISHER_URL, {
        method: "PUT",
        body: editContent,
      });
      if (!resp.ok) throw new Error(`Walrus upload failed: ${resp.status}`);
      const respText = await resp.text();
      const newBlobId = parseBlobIdFromResponse(respText);
      if (!newBlobId) throw new Error("Could not extract blob_id from response");

      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::wiki::update_page`,
        arguments: [
          tx.object(contributorCapId),
          tx.object(WIKI_ID),
          tx.pure.string(slug!),
          tx.pure.string(newBlobId),
          tx.pure.vector("string", page.sourceIds ?? []),
          tx.object("0x6"),
        ],
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: (result) => {
            setEditTxDigest(result.digest);
            setEditing(false);
            setSaving(false);
            fetchLiveDisputes();
          },
          onError: (err) => {
            setEditError(err.message);
            setSaving(false);
          },
        }
      );
    } catch (err: any) {
      setEditError(err?.message ?? "Save failed");
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent("");
    setEditError("");
  };

  const startEditingFromToolbar = async () => {
    if (!page) return;
    setEditLoading(true);
    setEditError("");
    setEditTxDigest("");
    try {
      if (!account) {
        setEditError("Connect wallet to edit pages");
        setEditLoading(false);
        return;
      }
      const objs = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::wiki::ContributorCap` },
        options: { showType: true },
      });
      if ((objs.data?.length ?? 0) === 0) {
        setEditError("Requires ContributorCap to edit pages");
        setEditLoading(false);
        return;
      }
      setContributorCapId(objs.data![0].data?.objectId ?? "");
      const resp = await fetch(`${BLOB_URL}/${page.blobId}`);
      if (!resp.ok) throw new Error(`Failed to fetch blob: ${resp.status}`);
      setEditContent(await resp.text());
      setEditing(true);
    } catch (err: any) {
      setEditError(err?.message ?? "Failed to start editing");
    } finally {
      setEditLoading(false);
    }
  };

  const mergeDisputes = () => {
    const prebuilt = page?.disputes ?? [];
    const prebuiltIds = new Set(prebuilt.map((d: any) => d.id));
    const live = liveDisputesRaised
      .filter((lr: any) => !prebuiltIds.has(lr.dispute_id))
      .map((lr: any) => ({
        id: lr.dispute_id,
        status: resolvedDisputeIds.has(lr.dispute_id) ? "resolved" as const : "open" as const,
        raisedBy: lr.raised_by,
        counterSource: "",
        rationale: lr.reason_blob ?? "",
      }));
    return [...prebuilt, ...live];
  };

  const mergedDisputes = mergeDisputes();

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

  const hasOpenDispute = mergedDisputes.some((d) => d.status === "open");

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
            <span className="text-amber-400 font-bold">{mergedDisputes.filter(d => d.status === "open").length} OPEN DISPUTE(S)</span>
            <button onClick={() => setDisputeModalOpen(true)} className="text-amber-500 hover:text-amber-300 ml-auto">→ VIEW</button>
          </div>
        )}

        {/* Toolbar */}
        <div className="border-b border-zinc-800 px-8 py-3 flex items-center justify-between bg-[#020202] sticky top-0 z-10">
          <div className="flex items-center gap-4 text-sm font-mono uppercase font-bold">
            {editing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors disabled:text-zinc-600 disabled:cursor-not-allowed"
                >
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  SAVE
                </button>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                  CANCEL
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditingFromToolbar}
                  disabled={editLoading}
                  className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors disabled:text-zinc-600"
                >
                  {editLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                  PROPOSE_EDIT
                </button>
                <button className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                  SHARE
                </button>
              </>
            )}
          </div>
          <div className="font-mono text-[10px] text-zinc-500 uppercase hidden sm:block">
            {editing ? (
              <span className="text-amber-400">EDITING_MODE</span>
            ) : (
              <>BLOB_ID: {page.blobId.slice(0, 12)}...</>
            )}
          </div>
        </div>

        {/* Dispute Rationale */}
        {hasOpenDispute && (
          <DisputeNotice disputes={mergedDisputes.filter(d => d.status === "open")} />
        )}

        {/* Article Body */}
        {editing ? (
          <div className="p-8 lg:p-12 bg-[#020202] flex flex-col gap-4">
            {editError && (
              <div className="border border-red-800 bg-red-950/30 p-3 font-mono text-xs text-red-400 uppercase">
                ERROR: {editError}
              </div>
            )}
            {editTxDigest ? (
              <div className="border border-green-800 bg-green-950/30 p-3 font-mono text-xs text-green-400 flex flex-col gap-1">
                <span className="uppercase font-bold">PAGE_UPDATED</span>
                <span>TX: {editTxDigest}</span>
                <a
                  href={`https://suiscan.xyz/testnet/tx/${editTxDigest}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-500 hover:text-green-300 underline"
                >
                  VIEW_ON_SUISCAN
                </a>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={saving}
                className="w-full min-h-[500px] bg-black border border-zinc-700 text-zinc-300 font-mono text-sm p-6 resize-y focus:outline-none focus:border-white disabled:opacity-50 leading-relaxed"
                placeholder="Loading page content..."
                spellCheck={false}
              />
            )}
            {saving && (
              <p className="font-mono text-[10px] text-amber-400 animate-pulse uppercase">
                SAVING_TO_WALRUS_AND_UPDATING_ON_CHAIN...
              </p>
            )}
          </div>
        ) : (
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
        )}
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
          {mergedDisputes.length > 0 && (
            <div id="disputes" className="border-t border-zinc-800 pt-4">
              <h4 className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-3">
                ACTIVE_DISPUTES
              </h4>
              {mergedDisputes.map(d => (
                <div key={d.id} className="border border-zinc-800 p-3 mb-2 bg-zinc-900/30 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs font-bold uppercase mb-1">
                      {d.status === "open" ? (
                        <span className="text-amber-400">OPEN</span>
                      ) : (
                        <span className="text-green-400">RESOLVED</span>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-zinc-400 mb-1">
                      ID: {d.id.slice(0, 16)}...
                    </div>
                    <div className="font-mono text-[10px] text-zinc-500 mb-1">
                      RAISED_BY: {d.raisedBy.slice(0, 16)}...
                    </div>
                    {d.counterSource && (
                      <div className="font-mono text-[10px] text-zinc-500 truncate">
                        COUNTER: {d.counterSource.slice(0, 16)}...
                      </div>
                    )}
                    {d.rationale && (
                      <div className="font-mono text-[10px] text-zinc-500 truncate mt-1">
                        RATIONALE: {d.rationale.slice(0, 16)}...
                      </div>
                    )}
                  </div>
                  {d.status === "open" && (
                    <ResolveDisputeButton
                      disputeId={d.id}
                      onResolved={() => fetchLiveDisputes()}
                    />
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

        <EditPanel
          onEditStart={handleStartEdit}
          disabled={editing}
        />

        <AttestPanel
          pageSlug={page.slug}
          sourceCount={page.sourceIds.length}
          hasOpenDispute={hasOpenDispute}
        />

        <DisputePanel pageSlug={page.slug} />
      </div>

      <DisputeDetailModal
        disputes={mergedDisputes.filter(d => d.status === "open")}
        open={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        onResolved={() => fetchLiveDisputes()}
      />
    </div>
  );
}
