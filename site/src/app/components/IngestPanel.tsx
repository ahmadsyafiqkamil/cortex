import { useState, useEffect, useCallback, useRef } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Upload } from "lucide-react";
import { PACKAGE_ID, WIKI_ID, PUBLISHER_URL } from "../lib/sui";

type PanelStatus = "loading" | "no_wallet" | "non_contributor" | "ready";

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

export function IngestPanel() {
  const account = useCurrentAccount();
  const client = useSuiClient();
    const { mutate: signAndExecute, isPending } =
    useSignAndExecuteTransaction();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panelStatus, setPanelStatus] = useState<PanelStatus>("loading");
  const [contributorCapId, setContributorCapId] = useState("");
  const [blobId, setBlobId] = useState("");
  const [title, setTitle] = useState("");
  const [originUrl, setOriginUrl] = useState("");
  const [txDigest, setTxDigest] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");

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

  if (panelStatus === "loading") {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          INGEST_SOURCE
        </h3>
        <p className="font-mono text-xs text-zinc-500 animate-pulse">
          CHECKING_PERMISSIONS...
        </p>
      </div>
    );
  }

  if (panelStatus === "no_wallet") {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          INGEST_SOURCE
        </h3>
        <p className="font-mono text-xs text-zinc-500 mb-4">
          CONNECT_WALLET_TO_INGEST
        </p>
        <ConnectButton className="!font-mono !text-xs !uppercase !tracking-wider !border !border-white/30 !bg-transparent !text-white hover:!bg-white/10 !rounded-none !px-4 !py-2" />
      </div>
    );
  }

  if (panelStatus !== "ready") {
    return null;
  }

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

      setBlobId(parsedId);
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

  const handleRegister = () => {
    if (!blobId.trim() || !title.trim()) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::source::register_source`,
      arguments: [
        tx.object(contributorCapId),
        tx.object(WIKI_ID),
        tx.pure.string(blobId.trim()),
        tx.pure.string(title.trim()),
        tx.pure.string(originUrl.trim()),
        tx.object("0x6"),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: (result) => {
          setTxDigest(result.digest);
          setBlobId("");
          setTitle("");
          setOriginUrl("");
        },
      }
    );
  };

  return (
    <div className="border border-green-800 bg-black p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        <h3 className="font-mono text-xs uppercase tracking-wider text-green-400">
          REGISTER_SOURCE
        </h3>
      </div>

      <p className="font-mono text-xs text-zinc-500 mb-5">
        REGISTER_A_RAW_SOURCE_ALREADY_STORED_ON_WALRUS_AFTER_WALRUS_STORE_RUN_CORTEX_INGEST_FROM_CLI
      </p>

      {txDigest ? (
        <div className="mb-5 border border-green-900 p-3 bg-green-950/30">
          <p className="font-mono text-[10px] text-green-400 uppercase mb-1">
            SOURCE_REGISTERED
          </p>
          <a
            href={`https://suiscan.xyz/testnet/tx/${txDigest}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-green-500 hover:text-green-300 break-all"
          >
            TX: {txDigest}
          </a>
          <button
            onClick={() => setTxDigest("")}
            className="mt-2 font-mono text-[10px] uppercase tracking-wider border border-green-800 text-green-400 px-3 py-1 hover:bg-green-950"
          >
            REGISTER_ANOTHER
          </button>
        </div>
      ) : (
        <div className="space-y-4 mb-5">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              UPLOAD_FILE (.txt, .md, .csv, .json)
            </label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="ingest-file-upload"
              />
              <label
                htmlFor="ingest-file-upload"
                className={`font-mono text-xs uppercase tracking-wider border px-4 py-2 cursor-pointer transition-colors flex items-center gap-2 ${
                  uploading
                    ? "border-zinc-700 text-zinc-600 cursor-not-allowed"
                    : "border-zinc-700 text-zinc-400 hover:border-white hover:text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                {uploading ? "UPLOADING..." : "CHOOSE_FILE"}
              </label>
              {uploadedFileName && !uploading && (
                <span className="font-mono text-[10px] text-green-400 truncate max-w-[200px]">
                  {uploadedFileName}
                </span>
              )}
              {uploading && (
                <span className="font-mono text-[10px] text-green-500 animate-pulse">
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
              WALRUS_BLOB_ID
            </label>
            <input
              type="text"
              value={blobId}
              onChange={(e) => setBlobId(e.target.value)}
              placeholder="e.g. M5fW...rA — auto-filled after file upload"
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-green-600"
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
              placeholder="Human-readable source title"
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              ORIGIN_URL (OPTIONAL)
            </label>
            <input
              type="text"
              value={originUrl}
              onChange={(e) => setOriginUrl(e.target.value)}
              placeholder="https://example.com/source"
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3
                         placeholder:text-zinc-600 focus:outline-none focus:border-green-600"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-zinc-600">
              SIGNED_AS: {account?.address.slice(0, 6)}...{account?.address.slice(-4)}
            </span>
            <button
              onClick={handleRegister}
              disabled={isPending || !blobId.trim() || !title.trim()}
              className="font-mono text-xs uppercase tracking-wider border border-green-700 text-green-400
                         px-4 py-1.5 hover:bg-green-950 disabled:border-zinc-700 disabled:text-zinc-600
                         disabled:cursor-not-allowed"
            >
              {isPending ? "SIGNING..." : "REGISTER_SOURCE"}
            </button>
          </div>
          {isPending && (
            <p className="font-mono text-[10px] text-green-500 animate-pulse">
              SIGNING_TRANSACTION...
            </p>
          )}
        </div>
      )}

      <div className="border-t border-zinc-800 pt-4 mt-2">
        <h4 className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 mb-2">
          CLI_GUIDE (ALTERNATIVE)
        </h4>
        <div className="space-y-1.5 font-mono text-[10px] text-zinc-500">
          <p className="text-zinc-500 mb-1">
            Use the file upload above to store on Walrus directly from the browser,
            or follow these CLI steps:
          </p>
          <p>
            <span className="text-zinc-600">1.</span>{" "}
            <code className="text-zinc-400 bg-zinc-900 px-1.5 py-0.5">
              walrus store your-source.txt --epochs max --context testnet
            </code>
          </p>
          <p>
            <span className="text-zinc-600">2.</span>{" "}
            Paste the blob ID above and click REGISTER_SOURCE
          </p>
          <p>
            <span className="text-zinc-600">3.</span>{" "}
            <code className="text-zinc-400 bg-zinc-900 px-1.5 py-0.5">
              python -m cortex_cli ingest your-source.txt --title "Title"
            </code>
          </p>
          <p className="text-zinc-600 mt-2">
            Step 3 runs the 7-step LLM pipeline to generate wiki pages. Run it from your terminal.
          </p>
        </div>
      </div>
    </div>
  );
}
