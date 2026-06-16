import { X, AlertTriangle, ExternalLink } from "lucide-react";
import { ResolveDisputeButton } from "./ResolveDisputeButton";

export interface Dispute {
  id: string;
  status: "open" | "resolved";
  raisedBy: string;
  counterSource: string;
  rationale: string;
}

interface DisputeDetailModalProps {
  disputes: Dispute[];
  open: boolean;
  onClose: () => void;
  onResolved: () => void;
}

export function DisputeDetailModal({ disputes, open, onClose, onResolved }: DisputeDetailModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div className="border border-amber-800 bg-black w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
          <h3 className="font-mono text-xs uppercase tracking-wider text-amber-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            {disputes.length} OPEN DISPUTE{disputes.length !== 1 ? "S" : ""}
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {disputes.map((d) => (
            <div key={d.id} className="border border-zinc-800 p-4 bg-zinc-900/30">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-amber-400 font-bold uppercase mb-1">
                    OPEN
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500 break-all">
                    ID: {d.id}
                  </div>
                </div>
                <ResolveDisputeButton
                  disputeId={d.id}
                  onResolved={() => {
                    onResolved();
                    onClose();
                  }}
                />
              </div>

              <div className="space-y-2">
                <div>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase">RAISED_BY</span>
                  <div className="font-mono text-[10px] text-zinc-300 break-all mt-0.5">{d.raisedBy}</div>
                </div>

                {d.counterSource && (
                  <div>
                    <span className="font-mono text-[9px] text-zinc-500 uppercase">COUNTER_SOURCE</span>
                    <a
                      href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${d.counterSource}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-zinc-400 hover:text-white break-all mt-0.5 flex items-center gap-1"
                    >
                      {d.counterSource}
                      <ExternalLink className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    </a>
                  </div>
                )}

                {d.rationale && (
                  <div>
                    <span className="font-mono text-[9px] text-zinc-500 uppercase">RATIONALE</span>
                    <a
                      href={`https://aggregator.walrus-testnet.walrus.space/v1/blobs/${d.rationale}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] text-zinc-400 hover:text-white break-all mt-0.5 flex items-center gap-1"
                    >
                      {d.rationale}
                      <ExternalLink className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-800 px-4 py-3 bg-zinc-900/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="font-mono text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-400
                       px-3 py-1.5 hover:border-white hover:text-white w-full"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
