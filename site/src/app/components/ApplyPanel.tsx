import { useState, useEffect, useCallback } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, WIKI_ID } from "../lib/sui";

type AppStatus = "loading" | "none" | "pending" | "approved" | "rejected";

export function ApplyPanel() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending, isSuccess, data } =
    useSignAndExecuteTransaction();
  const [rationale, setRationale] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [appStatus, setAppStatus] = useState<AppStatus>("loading");
  const [isRevoked, setIsRevoked] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!account) return;
    try {
      const dfs = await client.getDynamicFields({ parentId: WIKI_ID });
      const strip0x = account.address.startsWith("0x")
        ? account.address.slice(2)
        : account.address;
      const appKey = `app:${strip0x}`;
      const revKey = `rev:${strip0x}`;
      let foundStatus = -1;
      let foundRevoked = false;

      for (const df of dfs.data) {
        const name = (df.name as any)?.value ?? String(df.name ?? "");
        if (name === appKey) {
          try {
            const obj = await client.getObject({
              id: df.objectId,
              options: { showContent: true },
            });
            const fields = (obj.data?.content as any)?.fields ?? {};
            foundStatus = Number(fields.status ?? -1);
          } catch {
            // skip
          }
        }
        if (name === revKey) {
          foundRevoked = true;
        }
      }

      setIsRevoked(foundRevoked);

      if (foundStatus === 0) {
        setAppStatus("pending");
      } else if (foundStatus === 1) {
        setAppStatus("approved");
      } else if (foundStatus === 2) {
        setAppStatus("rejected");
      } else {
        setAppStatus("none");
      }
    } catch {
      setAppStatus("none");
    }
  }, [account, client]);

  useEffect(() => {
    setAppStatus("loading");
    fetchStatus();
  }, [fetchStatus]);

  if (!account) {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          BECOME_A_CONTRIBUTOR
        </h3>
        <p className="font-mono text-xs text-zinc-500 mb-4">
          CONNECT_WALLET_TO_APPLY
        </p>
        <ConnectButton className="!font-mono !text-xs !uppercase !tracking-wider !border !border-white/30 !bg-transparent !text-white hover:!bg-white/10 !rounded-none !px-4 !py-2" />
      </div>
    );
  }

  if (appStatus === "loading") {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          CONTRIBUTOR_STATUS
        </h3>
        <p className="font-mono text-xs text-zinc-500 animate-pulse">
          CHECKING_ON_CHAIN...
        </p>
      </div>
    );
  }

  // Active contributor: approved + not revoked
  if (appStatus === "approved" && !isRevoked) {
    return (
      <div className="border border-green-800 bg-black p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-green-400">
            ACTIVE_CONTRIBUTOR
          </h3>
        </div>
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-zinc-500 uppercase w-32">PERMISSIONS</span>
            <div className="flex flex-wrap gap-1">
              <span className="font-mono text-[9px] text-green-400 border border-green-900 px-2 py-0.5 uppercase">
                ADD_PAGES
              </span>
              <span className="font-mono text-[9px] text-green-400 border border-green-900 px-2 py-0.5 uppercase">
                UPDATE_PAGES
              </span>
              <span className="font-mono text-[9px] text-green-400 border border-green-900 px-2 py-0.5 uppercase">
                REGISTER_SOURCES
              </span>
              <span className="font-mono text-[9px] text-green-400 border border-green-900 px-2 py-0.5 uppercase">
                RAISE_DISPUTES
              </span>
            </div>
          </div>
        </div>
        <p className="font-mono text-[10px] text-zinc-500">
          SIGNED_AS: {account.address.slice(0, 10)}...{account.address.slice(-6)}
        </p>
      </div>
    );
  }

  // Approved but revoked
  if (appStatus === "approved" && isRevoked) {
    return (
      <div className="border border-red-900 bg-black p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-3 h-3 bg-red-500 rounded-full" />
          <h3 className="font-mono text-xs uppercase tracking-wider text-red-400">
            CONTRIBUTOR_REVOKED
          </h3>
        </div>
        <p className="font-mono text-xs text-zinc-400 mb-4">
          YOUR_CONTRIBUTOR_RIGHTS_HAVE_BEEN_REVOKED_YOU_MAY_RE_APPLY
        </p>
        <p className="font-mono text-[10px] text-zinc-600">
          SIGNED_AS: {account.address.slice(0, 10)}...{account.address.slice(-6)}
        </p>
      </div>
    );
  }

  // Pending application
  if (appStatus === "pending" || submitted || isSuccess) {
    return (
      <div className="border border-amber-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-amber-400 mb-4">
          APPLICATION_PENDING
        </h3>
        <p className="font-mono text-xs text-zinc-400 mb-2">
          YOUR_APPLICATION_IS_PENDING_REVIEW_BY_THE_WIKI_OWNER
        </p>
        {data?.digest && (
          <a
            href={`https://suiscan.xyz/testnet/tx/${data.digest}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-amber-500 hover:text-amber-400 break-all"
          >
            TX: {data.digest}
          </a>
        )}
        <button
          onClick={() => {
            setSubmitted(false);
            fetchStatus();
          }}
          className="mt-4 font-mono text-xs uppercase tracking-wider border border-zinc-700 text-zinc-400 px-4 py-1.5 hover:bg-zinc-900"
        >
          CHECK_AGAIN
        </button>
      </div>
    );
  }

  // Rejected
  if (appStatus === "rejected") {
    return (
      <div className="border border-red-900 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-red-400 mb-4">
          APPLICATION_REJECTED
        </h3>
        <p className="font-mono text-xs text-zinc-400 mb-4">
          YOUR_APPLICATION_WAS_REJECTED_YOU_MAY_RE_APPLY
        </p>
        <button
          onClick={() => fetchStatus()}
          className="font-mono text-xs uppercase tracking-wider border border-amber-700 text-amber-400 px-4 py-1.5 hover:bg-amber-950"
        >
          RE_APPLY
        </button>
      </div>
    );
  }

  // No application — show apply form
  const handleApply = () => {
    if (!rationale.trim()) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::contributor::submit_application`,
      arguments: [
        tx.object(WIKI_ID),
        tx.pure.string(rationale.trim()),
        tx.object("0x6"),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setSubmitted(true);
          setRationale("");
        },
      }
    );
  };

  return (
    <div className="border border-zinc-800 bg-black p-6">
      <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
        BECOME_A_CONTRIBUTOR
      </h3>
      <p className="font-mono text-xs text-zinc-500 mb-4">
        AS_A_CONTRIBUTOR_YOU_CAN_ADD_AND_UPDATE_WIKI_PAGES_REGISTER_SOURCES_AND_RAISE_DISPUTES
      </p>
      <div className="mb-4">
        <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
          RATIONALE
        </label>
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="EXPLAIN_WHY_YOU_WANT_TO_CONTRIBUTE..."
          rows={4}
          className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-3 resize-none
                     placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-zinc-600">
          SIGNED_AS: {account.address.slice(0, 6)}...{account.address.slice(-4)}
        </span>
        <button
          onClick={handleApply}
          disabled={isPending || !rationale.trim()}
          className="font-mono text-xs uppercase tracking-wider border border-amber-700 text-amber-400
                     px-4 py-1.5 hover:bg-amber-950 disabled:border-zinc-700 disabled:text-zinc-600
                     disabled:cursor-not-allowed"
        >
          {isPending ? "SUBMITTING..." : "SUBMIT_APPLICATION"}
        </button>
      </div>
      {isPending && (
        <p className="font-mono text-[10px] text-amber-500 mt-3 animate-pulse">
          SIGNING_TRANSACTION...
        </p>
      )}
    </div>
  );
}
