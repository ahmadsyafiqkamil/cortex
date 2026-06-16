import { useState, useEffect, useCallback } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Check, X } from "lucide-react";
import { PACKAGE_ID, WIKI_ID } from "../lib/sui";

interface ResolveDisputeButtonProps {
  disputeId: string;
  onResolved: () => void;
}

export function ResolveDisputeButton({ disputeId, onResolved }: ResolveDisputeButtonProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [capId, setCapId] = useState("");

  const fetchCap = useCallback(async () => {
    if (!account || !PACKAGE_ID) return;
    try {
      const objs = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::wiki::ContributorCap` },
        options: { showType: true },
      });
      if ((objs.data?.length ?? 0) > 0) {
        setCapId(objs.data![0].data?.objectId ?? "");
      }
    } catch { /* no cap */ }
  }, [account, client]);

  useEffect(() => { fetchCap(); }, [fetchCap]);

  if (!capId) return null;

  const handleResolve = (accept: boolean) => {
    if (!capId || !WIKI_ID) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::dispute::resolve_dispute`,
      arguments: [
        tx.object(capId),
        tx.object(WIKI_ID),
        tx.object(disputeId),
        tx.pure.bool(accept),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => onResolved(),
        onError: () => {},
      }
    );
  };

  return (
    <div className="flex gap-1.5 flex-shrink-0">
      <button
        onClick={() => handleResolve(true)}
        disabled={isPending}
        className="font-mono text-[9px] uppercase border border-green-800 text-green-400
                   px-1.5 py-0.5 hover:bg-green-950 disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center gap-0.5"
      >
        {isPending ? (
          <span className="w-2 h-2 border border-green-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Check className="w-2.5 h-2.5" />
        )}
      </button>
      <button
        onClick={() => handleResolve(false)}
        disabled={isPending}
        className="font-mono text-[9px] uppercase border border-red-800 text-red-400
                   px-1.5 py-0.5 hover:bg-red-950 disabled:opacity-40 disabled:cursor-not-allowed
                   flex items-center gap-0.5"
      >
        {isPending ? (
          <span className="w-2 h-2 border border-red-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <X className="w-2.5 h-2.5" />
        )}
      </button>
    </div>
  );
}
