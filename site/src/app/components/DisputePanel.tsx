import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { AlertTriangle, Upload, ExternalLink, Loader } from "lucide-react";
import { PACKAGE_ID, WIKI_ID, PUBLISHER_URL } from "../lib/sui";

type PanelStatus = "loading" | "no_wallet" | "non_contributor" | "ready";

interface DisputePanelProps {
  pageSlug: string;
}

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

export function DisputePanel({ pageSlug }: DisputePanelProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("loading");
  const [contributorCapId, setContributorCapId] = useState("");
  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [counterBlobId, setCounterBlobId] = useState("");
  const [reasonBlob, setReasonBlob] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [rationaleUploading, setRationaleUploading] = useState(false);

  const fetchContributorCap = useCallback(async () => {
    if (!account) {
      setPanelStatus("no_wallet");
      return;
    }
    try {
      const objs = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::wiki::ContributorCap` },
        options: { showType: true },
      });
      if ((objs.data?.length ?? 0) > 0) {
        setContributorCapId(objs.data![0].data?.objectId ?? "");
        setPanelStatus("ready");
      } else {
        setPanelStatus("non_contributor");
      }
    } catch {
      setPanelStatus("non_contributor");
    }
  }, [account, client]);

  useEffect(() => {
    setPanelStatus("loading");
    fetchContributorCap();
  }, [fetchContributorCap]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["txt", "md", "csv", "json"].includes(ext)) {
      setUploadError("Only .txt, .md, .csv, .json files are supported");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadedFileName("");

    try {
      const content = await file.text();
      const resp = await fetch(PUBLISHER_URL, {
        method: "PUT",
        body: content,
      });

      if (!resp.ok) {
        throw new Error(`Aggregator returned ${resp.status}`);
      }

      const respText = await resp.text();
      const parsedId = parseBlobIdFromResponse(respText);
      if (!parsedId) {
        throw new Error("Could not extract blob_id from response");
      }

      setCounterBlobId(parsedId);
      setUploadedFileName(file.name);
      if (!title) {
        setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]/g, " "));
      }
    } catch (err: any) {
      setUploadError(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRaiseDispute = async () => {
    if (!counterBlobId.trim() || !title.trim()) return;

    let finalReasonBlob = reasonBlob;

    if (rationale.trim() && !reasonBlob) {
      setRationaleUploading(true);
      try {
        const resp = await fetch(PUBLISHER_URL, {
          method: "PUT",
          body: rationale.trim(),
        });
        if (!resp.ok) {
          throw new Error(`Aggregator returned ${resp.status}`);
        }
        const respText = await resp.text();
        const parsedId = parseBlobIdFromResponse(respText);
        if (!parsedId) {
          throw new Error("Could not extract rationale blob_id");
        }
        finalReasonBlob = parsedId;
        setReasonBlob(parsedId);
      } catch (err: any) {
        setUploadError(err?.message ?? "Rationale upload failed");
        setRationaleUploading(false);
        return;
      }
      setRationaleUploading(false);
    }

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::source::register_source`,
      arguments: [
        tx.object(contributorCapId),
        tx.object(WIKI_ID),
        tx.pure.string(counterBlobId.trim()),
        tx.pure.string(title.trim()),
        tx.pure.string(uploadedFileName),
        tx.object("0x6"),
      ],
    });
    tx.moveCall({
      target: `${PACKAGE_ID}::dispute::raise_dispute`,
      arguments: [
        tx.object(contributorCapId),
        tx.object(WIKI_ID),
        tx.pure.string(pageSlug),
        tx.pure.string(finalReasonBlob),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          setTxDigest(result.digest);
        },
      }
    );
  };

  if (panelStatus === "loading") {
    return (
      <div className="border-t border-zinc-800 p-4 bg-zinc-900/30">
        <h4 className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          RAISE_DISPUTE
        </h4>
        <p className="font-mono text-[10px] text-zinc-500 animate-pulse">
          CHECKING_PERMISSIONS...
        </p>
      </div>
    );
  }

  if (panelStatus === "no_wallet") {
    return (
      <div className="border-t border-zinc-800 p-4 bg-zinc-900/30">
        <h4 className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" />
          RAISE_DISPUTE
        </h4>
        <p className="font-mono text-[10px] text-zinc-500 mb-3">
          CONNECT_WALLET_TO_DISPUTE
        </p>
        <ConnectButton
          connectText="CONNECT_WALLET"
          className="[&_button]:!w-full [&_button]:!py-2 [&_button]:!border [&_button]:!border-amber-700 [&_button]:!bg-transparent [&_button]:!text-amber-400 [&_button]:!font-mono [&_button]:!text-xs [&_button]:!font-bold [&_button]:!uppercase [&_button]:!tracking-wider [&_button]:!rounded-none hover:[&_button]:!bg-amber-950 hover:[&_button]:!text-amber-300 [&_button]:!transition-colors"
        />
      </div>
    );
  }

  if (panelStatus !== "ready") {
    return null;
  }

  return (
    <div className="border-t border-zinc-800 p-4 bg-zinc-900/30 flex flex-col gap-3">
      <h4 className="font-mono text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-2">
        <AlertTriangle className="w-3 h-3" />
        RAISE_DISPUTE
      </h4>

      {txDigest ? (
        <div className="flex flex-col gap-2">
          <div className="border border-amber-900 p-3 bg-amber-950/30">
            <p className="font-mono text-[10px] text-amber-400 uppercase mb-1">
              DISPUTE_RAISED
            </p>
            <p className="font-mono text-[10px] text-amber-500 break-all">
              TX: {txDigest}
            </p>
            <a
              href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-mono text-[10px] text-amber-500 hover:text-amber-300 mt-1"
            >
              VIEW_ON_SUISCAN <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={() => {
              setTxDigest("");
              setCounterBlobId("");
              setTitle("");
              setRationale("");
              setReasonBlob("");
              setUploadedFileName("");
              setUploadError("");
            }}
            className="w-full py-2 border border-amber-800 text-amber-400 hover:bg-amber-950 font-mono text-[10px] uppercase tracking-wider"
          >
            FILE_ANOTHER_DISPUTE
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              COUNTER-SOURCE (.txt, .md, .csv, .json)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="dispute-file-upload"
              />
              <label
                htmlFor="dispute-file-upload"
                className={`font-mono text-xs uppercase tracking-wider border px-4 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                  uploading
                    ? "border-zinc-700 text-zinc-600 cursor-not-allowed"
                    : "border-amber-800 text-amber-400 hover:border-amber-500 hover:text-amber-300"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "UPLOADING..." : "CHOOSE_FILE"}
              </label>
              {uploadedFileName && !uploading && (
                <span className="font-mono text-[10px] text-amber-400 truncate max-w-[180px]">
                  {uploadedFileName}
                </span>
              )}
              {uploading && (
                <span className="font-mono text-[10px] text-amber-500 animate-pulse">
                  STORING_ON_WALRUS...
                </span>
              )}
            </div>
            {uploadError && (
              <p className="mt-2 font-mono text-[10px] text-red-400">{uploadError}</p>
            )}
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              COUNTER_BLOB_ID
            </label>
            <input
              type="text"
              value={counterBlobId}
              onChange={(e) => setCounterBlobId(e.target.value)}
              placeholder="Auto-filled after file upload"
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              TITLE
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Counter-source title"
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              RATIONALE (OPTIONAL)
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Explain why this page is disputed..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-amber-600 resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-zinc-600">
              SIGNED_AS: {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
            </span>
            <button
              onClick={handleRaiseDispute}
              disabled={
                isPending || rationaleUploading || !counterBlobId.trim() || !title.trim()
              }
              className="font-mono text-xs uppercase tracking-wider border border-amber-700 text-amber-400
                         px-4 py-1.5 hover:bg-amber-950 disabled:border-zinc-700 disabled:text-zinc-600
                         disabled:cursor-not-allowed flex items-center gap-2"
            >
              {(isPending || rationaleUploading) ? (
                <>
                  <Loader className="w-3 h-3 animate-spin" />
                  {rationaleUploading ? "UPLOADING..." : "SIGNING..."}
                </>
              ) : (
                "RAISE_DISPUTE"
              )}
            </button>
          </div>

          {(isPending || rationaleUploading) && (
            <p className="font-mono text-[10px] text-amber-500 animate-pulse">
              {rationaleUploading
                ? "UPLOADING_RATIONALE_TO_WALRUS..."
                : "SIGNING_TRANSACTION..."}
            </p>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-3">
        DISPUTES_RECORD_DISAGREEMENT_TRANSPARENTLY. THEY_DO_NOT_MODIFY_THE_PAGE_CONTENT.
        REQUIRES_COUNTER_SOURCE_AND_CONTRIBUTOR_CAP.
      </p>
    </div>
  );
}
