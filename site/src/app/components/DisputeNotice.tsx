import { useState, useEffect } from "react";
import { AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import type { Dispute } from "./DisputeDetailModal";

const BLOB_URL = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

interface DisputeNoticeProps {
  disputes: Dispute[];
}

function RationaleText({ blobId }: { blobId: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${BLOB_URL}/${blobId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [blobId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-1.5">
        <div className="h-3 bg-amber-500/10 w-full" />
        <div className="h-3 bg-amber-500/10 w-3/4" />
      </div>
    );
  }

  if (error || !text) {
    return (
      <a
        href={`${BLOB_URL}/${blobId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 hover:text-amber-300"
      >
        VIEW_RATIONALE_BLOB <ExternalLink className="w-2.5 h-2.5" />
      </a>
    );
  }

  const snippet = text.slice(0, 600);
  const truncated = text.length > 600;

  return (
    <div>
      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
        {snippet}
        {truncated && "…"}
      </p>
      {truncated && (
        <a
          href={`${BLOB_URL}/${blobId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 hover:text-amber-300 mt-1"
        >
          READ_FULL_RATIONALE <ExternalLink className="w-2.5 h-2.5" />
        </a>
      )}
    </div>
  );
}

export function DisputeNotice({ disputes }: DisputeNoticeProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (disputes.length === 0) return null;

  const disputesWithRationale = disputes.filter((d) => d.rationale);

  return (
    <div className="border-b border-amber-500/50 bg-amber-500/[0.03]">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-8 py-3 flex items-center gap-2 font-mono text-xs uppercase hover:bg-amber-500/[0.04] transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-amber-400 font-bold">
          {disputes.length} DISPUTE{disputes.length !== 1 ? "S" : ""} — READ THE COUNTER-CLAIM{disputes.length !== 1 ? "S" : ""} BELOW
        </span>
        <span className="text-zinc-500 ml-auto">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-8 pb-4 space-y-5">
          {disputesWithRationale.length === 0 && (
            <p className="font-mono text-[10px] text-zinc-500 uppercase">
              NO_RATIONALE_TEXT_AVAILABLE._SEE_SIDEBAR_FOR_DETAILS.
            </p>
          )}

          {disputesWithRationale.map((d) => (
            <div key={d.id} className="border-l-2 border-amber-800/50 pl-5">
              <RationaleText blobId={d.rationale} />

              <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500 uppercase mt-3 flex-wrap">
                <span>
                  RAISED_BY:{" "}
                  <span className="text-zinc-400 font-bold">{d.raisedBy.slice(0, 10)}…{d.raisedBy.slice(-6)}</span>
                </span>
                {d.counterSource && (
                  <a
                    href={`${BLOB_URL}/${d.counterSource}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300"
                  >
                    VIEW_COUNTER_SOURCE <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
