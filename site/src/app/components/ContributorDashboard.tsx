import { useState, useEffect, useCallback } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PACKAGE_ID, WIKI_ID, OWNER_CAP_ID } from "../lib/sui";

interface Application {
  applicant: string;
  rationale_blob: string;
  status: number;
  created_at_ms: number;
  resolved_at_ms: number;
}

export function ContributorDashboard() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();
  const [ownerAddress, setOwnerAddress] = useState("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [revokedSet, setRevokedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [targetAddress, setTargetAddress] = useState("");

  const fetchData = useCallback(async () => {
    try {
      console.log("[Dashboard] fetchData: WIKI_ID=", WIKI_ID, "OWNER_CAP_ID=", OWNER_CAP_ID);
      const wikiObj = await client.getObject({
        id: WIKI_ID,
        options: { showContent: true },
      });
      console.log("[Dashboard] wikiObj ok:", wikiObj.data?.content);
      const content = wikiObj.data?.content as any;
      const fields = content?.fields ?? content;
      const owner = fields?.owner ?? "";
      setOwnerAddress(owner);

      const dfs = await client.getDynamicFields({ parentId: WIKI_ID });
      console.log("[Dashboard] dynamicFields count:", dfs.data?.length);
      const apps: Application[] = [];
      const revoked = new Set<string>();

      for (const df of dfs.data) {
        const name = (df.name as any)?.value ?? String(df.name ?? "");
        console.log("[Dashboard] df entry: name=", name, "objectId=", df.objectId);
        if (name.startsWith("app:")) {
          try {
            const obj = await client.getObject({
              id: df.objectId,
              options: { showContent: true },
            });
            const c = (obj.data?.content as any)?.fields ?? {};
            apps.push({
              applicant: c.applicant ?? "",
              rationale_blob: c.rationale_blob ?? "",
              status: Number(c.status ?? -1),
              created_at_ms: Number(c.created_at_ms ?? 0),
              resolved_at_ms: Number(c.resolved_at_ms ?? 0),
            });
          } catch {
            // Dynamic field pagination — object fetch may fail; skip
          }
        } else if (name.startsWith("rev:")) {
          const addr = name.slice(4);
          revoked.add(addr);
        }
      }
      setApplications(apps);
      setRevokedSet(revoked);
    } catch (err) {
      console.error("Failed to load contributor data:", err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!account) {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          CONTRIBUTOR_DASHBOARD
        </h3>
        <p className="font-mono text-xs text-zinc-500 mb-4">
          CONNECT_WALLET_TO_ACCESS
        </p>
        <ConnectButton className="!font-mono !text-xs !uppercase !tracking-wider !border !border-white/30 !bg-transparent !text-white hover:!bg-white/10 !rounded-none !px-4 !py-2" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          CONTRIBUTOR_DASHBOARD
        </h3>
        <p className="font-mono text-xs text-zinc-500 animate-pulse">
          LOADING_ON_CHAIN_DATA...
        </p>
      </div>
    );
  }

  const isOwner =
    ownerAddress &&
    account.address.toLowerCase() === ownerAddress.toLowerCase();

  if (!isOwner) {
    return (
      <div className="border border-zinc-800 bg-black p-6">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          CONTRIBUTOR_DASHBOARD
        </h3>
        <p className="font-mono text-xs text-zinc-500">
          ACCESS_RESTRICTED_TO_WIKI_OWNER
        </p>
        <p className="font-mono text-[10px] text-zinc-600 mt-2 break-all">
          OWNER: {ownerAddress}
        </p>
      </div>
    );
  }

  const pendingApps = applications.filter((a) => a.status === 0);
  const approvedApps = applications.filter((a) => a.status === 1);

  const handleAction = (
    moduleName: string,
    funcName: string,
    targetAddr: string
  ) => {
    if (!OWNER_CAP_ID) {
      console.error("OWNER_CAP_ID not configured");
      return;
    }
    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${moduleName}::${funcName}`,
      arguments: [
        tx.object(OWNER_CAP_ID),
        tx.object(WIKI_ID),
        tx.pure.string(targetAddr),
        tx.object("0x6"),
      ],
    });
    signAndExecute({ transaction: tx }, { onSuccess: () => fetchData() });
  };

  const approvedAddresses = new Set(approvedApps.map((a) => a.applicant));

  return (
    <div className="border border-zinc-800 bg-black">
      <div className="p-6 border-b border-zinc-800">
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-400">
          CONTRIBUTOR_DASHBOARD
        </h3>
        <p className="font-mono text-[10px] text-zinc-600 mt-1 break-all">
          CONNECTED_AS_OWNER: {account.address}
        </p>
      </div>

      {/* Pending Applications */}
      <div className="p-6 border-b border-zinc-800">
        <h4 className="font-mono text-xs uppercase tracking-wider text-amber-400 mb-4">
          PENDING_APPLICATIONS ({pendingApps.length})
        </h4>
        {pendingApps.length === 0 ? (
          <p className="font-mono text-xs text-zinc-600">NO_PENDING_APPLICATIONS</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {pendingApps.map((app) => (
              <div
                key={app.applicant}
                className="border border-zinc-800 p-3 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[11px] text-zinc-300 break-all">
                    {app.applicant}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-600 mt-1 break-all line-clamp-2">
                    {app.rationale_blob}
                  </p>
                  <p className="font-mono text-[10px] text-zinc-700 mt-1">
                    {new Date(Number(app.created_at_ms)).toISOString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() =>
                      handleAction("contributor", "approve_application", app.applicant)
                    }
                    disabled={isPending}
                    className="font-mono text-[10px] uppercase tracking-wider border border-green-800
                               text-green-500 px-3 py-1 hover:bg-green-950
                               disabled:border-zinc-700 disabled:text-zinc-600"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() =>
                      handleAction("contributor", "reject_application", app.applicant)
                    }
                    disabled={isPending}
                    className="font-mono text-[10px] uppercase tracking-wider border border-red-900
                               text-red-500 px-3 py-1 hover:bg-red-950
                               disabled:border-zinc-700 disabled:text-zinc-600"
                  >
                    REJECT
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approved Contributors */}
      <div className="p-6 border-b border-zinc-800">
        <h4 className="font-mono text-xs uppercase tracking-wider text-green-400 mb-4">
          ACTIVE_CONTRIBUTORS ({approvedAddresses.size})
        </h4>
        {approvedAddresses.size === 0 ? (
          <p className="font-mono text-xs text-zinc-600">NO_APPROVED_CONTRIBUTORS</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {[...approvedAddresses].map((addr) => {
              const isRevoked = revokedSet.has(addr);
              return (
                <div
                  key={addr}
                  className="flex items-center justify-between border border-zinc-800 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRevoked ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                    <span className="font-mono text-[11px] text-zinc-300 break-all">
                      {addr}
                    </span>
                    {isRevoked && (
                      <span className="font-mono text-[9px] text-red-400 uppercase">
                        REVOKED
                      </span>
                    )}
                  </div>
                  {!isRevoked && (
                    <button
                      onClick={() =>
                        handleAction("wiki", "revoke_contributor", addr)
                      }
                      disabled={isPending}
                      className="font-mono text-[10px] uppercase tracking-wider border border-red-900
                                 text-red-500 px-3 py-1 hover:bg-red-950
                                 disabled:border-zinc-700 disabled:text-zinc-600"
                    >
                      REVOKE
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-6">
        <h4 className="font-mono text-xs uppercase tracking-wider text-zinc-400 mb-4">
          QUICK_ACTIONS
        </h4>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="block font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">
              ADDRESS
            </label>
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              placeholder="0x..."
              className="w-full bg-zinc-950 border border-zinc-700 text-white font-mono text-xs p-2
                         placeholder:text-zinc-600 focus:outline-none focus:border-amber-600"
            />
          </div>
          <button
            onClick={() => {
              if (targetAddress.trim()) {
                handleAction("contributor", "approve_application", targetAddress.trim());
              }
            }}
            disabled={isPending || !targetAddress.trim()}
            className="font-mono text-[10px] uppercase tracking-wider border border-green-800
                       text-green-500 px-3 py-2 hover:bg-green-950
                       disabled:border-zinc-700 disabled:text-zinc-600 shrink-0"
          >
            APPROVE_BY_ADDR
          </button>
          <button
            onClick={() => {
              if (targetAddress.trim()) {
                handleAction("contributor", "reject_application", targetAddress.trim());
              }
            }}
            disabled={isPending || !targetAddress.trim()}
            className="font-mono text-[10px] uppercase tracking-wider border border-red-900
                       text-red-500 px-3 py-2 hover:bg-red-950
                       disabled:border-zinc-700 disabled:text-zinc-600 shrink-0"
          >
            REJECT_BY_ADDR
          </button>
          <button
            onClick={() => {
              if (targetAddress.trim()) {
                handleAction("wiki", "revoke_contributor", targetAddress.trim());
              }
            }}
            disabled={isPending || !targetAddress.trim()}
            className="font-mono text-[10px] uppercase tracking-wider border border-red-900
                       text-red-500 px-3 py-2 hover:bg-red-950
                       disabled:border-zinc-700 disabled:text-zinc-600 shrink-0"
          >
            REVOKE
          </button>
        </div>
      </div>

      {isPending && (
        <div className="px-6 pb-4">
          <p className="font-mono text-[10px] text-amber-500 animate-pulse">
            PROCESSING_ON_CHAIN...
          </p>
        </div>
      )}
    </div>
  );
}
