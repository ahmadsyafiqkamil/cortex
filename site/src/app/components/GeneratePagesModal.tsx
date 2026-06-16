import { useState, useEffect, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Play, X, Copy, Check, RefreshCw } from "lucide-react";

const API_BASE = "http://localhost:5001";

type IngestStatus = "idle" | "sending" | "running" | "done" | "error";

interface JobState {
  status: IngestStatus;
  jobId: string;
  pages: string[];
  error: string;
  log: string[];
}

interface GeneratePagesModalProps {
  blobId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

function LogView({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={ref}
      className="border border-zinc-800 bg-zinc-950 p-2 overflow-auto font-mono text-[10px] leading-relaxed max-h-64"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            line.includes("\u2713") ? "text-green-400" :
            line.includes("error") || line.includes("Error") ? "text-red-400" :
            line.includes("Warning") ? "text-amber-400" :
            line.startsWith("\u2500") ? "text-zinc-600" :
            "text-zinc-400"
          }
        >
          {line || "\u00A0"}
        </div>
      ))}
    </div>
  );
}

export function GeneratePagesModal({ blobId, title, open, onClose }: GeneratePagesModalProps) {
  const account = useCurrentAccount();
  const [job, setJob] = useState<JobState>({ status: "idle", jobId: "", pages: [], error: "", log: [] });
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setJob({ status: "idle", jobId: "", pages: [], error: "", log: [] });
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [open]);

  const pollJob = (jobId: string) => {
    pollRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/ingest/${jobId}`);
        const data = await resp.json();

        const currentLog = data.log || [];
        setJob((prev) => ({ ...prev, log: currentLog }));

        if (data.status === "done") {
          setJob((prev) => ({ ...prev, status: "done", pages: data.pages || [], log: currentLog }));
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } else if (data.status === "error") {
          setJob((prev) => ({ ...prev, status: "error", error: data.error || "Unknown error", log: currentLog }));
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch {
        // keep polling
      }
    }, 1500);
  };

  const handleStart = async () => {
    if (!account) return;
    setJob({ status: "sending", jobId: "", pages: [], error: "", log: [] });

    try {
      const resp = await fetch(`${API_BASE}/api/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blob_id: blobId,
          title,
          address: account.address,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setJob({ status: "error", jobId: "", pages: [], error: data.error || `HTTP ${resp.status}`, log: [] });
        return;
      }

      setJob({ status: "running", jobId: data.job_id, pages: [], error: "", log: [] });
      pollJob(data.job_id);
    } catch (err: any) {
      setJob({ status: "error", jobId: "", pages: [], error: err?.message ?? "Network error. Is the API server running?", log: [] });
    }
  };

  const handleCopyCommand = () => {
    const cmd = `python -m cortex_cli ingest --blob-id ${blobId} --title "${title}" --address ${account?.address ?? ""}`;
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  const isBusy = job.status === "sending" || job.status === "running";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70">
      <div className="border border-green-800 bg-black w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="font-mono text-xs uppercase tracking-wider text-green-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isBusy ? "animate-pulse bg-green-500" : job.status === "done" ? "bg-green-500" : job.status === "error" ? "bg-red-500" : "bg-green-500 animate-pulse"}`} />
            GENERATE_PAGES
          </h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase text-zinc-500">SOURCE</span>
            <span className="font-mono text-xs text-white">{title}</span>
            <span className="font-mono text-[10px] text-zinc-600 truncate">blob: {blobId}</span>
          </div>

          {job.status === "idle" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-zinc-400">
                This will run the LLM ingestion pipeline to generate wiki pages from
                the registered source. The process may take 1-5 minutes depending on
                source size and LLM response time.
              </p>
              <p className="font-mono text-xs text-zinc-500">
                Make sure the API server is running:
                <code className="block mt-1 text-zinc-400 bg-zinc-900 px-2 py-1">
                  python agent/api_server.py
                </code>
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleStart}
                  disabled={!account}
                  className="font-mono text-xs uppercase tracking-wider border border-green-700 text-green-400
                             px-4 py-1.5 hover:bg-green-950 disabled:border-zinc-700 disabled:text-zinc-600"
                >
                  <Play className="w-3.5 h-3.5 inline mr-1.5" />
                  START_INGEST
                </button>
                <button
                  onClick={handleCopyCommand}
                  className="font-mono text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-400
                             px-3 py-1.5 hover:border-zinc-500 hover:text-zinc-300 flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copied ? "COPIED" : "COPY_CLI_CMD"}
                </button>
              </div>
            </div>
          )}

          {isBusy && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-green-400 animate-spin" />
                <p className="font-mono text-xs text-green-400 animate-pulse uppercase">
                  {job.status === "sending" ? "STARTING_INGEST..." : "GENERATING_PAGES..."}
                </p>
              </div>
              <LogView lines={job.log} />
            </div>
          )}

          {job.status === "done" && (
            <div className="space-y-3">
              <div className="border border-green-900 p-3 bg-green-950/30">
                <p className="font-mono text-[10px] text-green-400 uppercase mb-2">
                  INGEST_COMPLETE · {job.pages.length} PAGES
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.pages.map((slug) => (
                    <span
                      key={slug}
                      className="font-mono text-[9px] text-green-400 border border-green-800 px-2 py-0.5"
                    >
                      {slug}
                    </span>
                  ))}
                </div>
              </div>
              <LogView lines={job.log} />
              <p className="font-mono text-xs text-zinc-500">
                Pages are now on-chain. Rebuild the site to see them:
                <code className="block mt-1 text-zinc-400 bg-zinc-900 px-2 py-1">
                  cd site && npm run prebuild && npm run build
                </code>
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setJob({ status: "idle", jobId: "", pages: [], error: "", log: [] })}
                  className="font-mono text-[10px] uppercase tracking-wider border border-green-700 text-green-400
                             px-3 py-1.5 hover:bg-green-950"
                >
                  GENERATE_AGAIN
                </button>
                <button
                  onClick={onClose}
                  className="font-mono text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-400
                             px-3 py-1.5 hover:border-white hover:text-white"
                >
                  CLOSE
                </button>
              </div>
            </div>
          )}

          {job.status === "error" && (
            <div className="space-y-3">
              <div className="border border-red-900 p-3 bg-red-950/20">
                <p className="font-mono text-[10px] text-red-400 uppercase mb-1">INGEST_FAILED</p>
                <p className="font-mono text-xs text-red-300 break-all whitespace-pre-wrap">{job.error}</p>
              </div>
              <LogView lines={job.log.length > 0 ? job.log : job.error.split("\n")} />
              <div className="flex gap-3">
                <button
                  onClick={() => setJob({ status: "idle", jobId: "", pages: [], error: "", log: [] })}
                  className="font-mono text-[10px] uppercase tracking-wider border border-red-700 text-red-400
                             px-3 py-1.5 hover:bg-red-950"
                >
                  RETRY
                </button>
                <button
                  onClick={handleCopyCommand}
                  className="font-mono text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-400
                             px-3 py-1.5 hover:border-zinc-500"
                >
                  COPY_CLI_CMD
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
