import { useState } from "react";
import { ShieldCheck, ExternalLink, Loader } from "lucide-react";
import { ConnectButton, useCurrentAccount, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { buildAttestTx } from "../lib/sui";

interface AttestPanelProps {
  pageSlug: string;
  sourceCount: number;
  hasOpenDispute: boolean;
}

export function AttestPanel({ pageSlug, sourceCount, hasOpenDispute }: AttestPanelProps) {
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending, data: txResult } = useSignAndExecuteTransaction();
  const [attestCount, setAttestCount] = useState<number>(0);

  const handleAttest = () => {
    if (!account) return;
    const moveData = buildAttestTx(pageSlug);
    if (!moveData) return;

    const tx = new Transaction();
    tx.moveCall({
      target: `${moveData.packageId}::${moveData.module}::${moveData.function}`,
      arguments: [
        tx.object(moveData.arguments[0]),
        tx.pure.string(moveData.arguments[1]),
        tx.pure.string(moveData.arguments[2]),
      ],
    });

    signAndExecute(
      { transaction: tx },
      {
        onSuccess: () => {
          setAttestCount((n) => n + 1);
        },
      }
    );
  };

  const digest = txResult?.digest;

  return (
    <div className="border-t border-zinc-800 p-4 bg-zinc-900/30 flex flex-col gap-3">
      <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-2">
        <ShieldCheck className="w-3 h-3" />
        ATTEST_PROVENANCE
      </h4>

      <ConnectButton
        connectText="CONNECT_WALLET"
        className="[&_button]:!w-full [&_button]:!py-2 [&_button]:!border [&_button]:!border-white [&_button]:!bg-transparent [&_button]:!text-white [&_button]:!font-mono [&_button]:!text-xs [&_button]:!font-bold [&_button]:!uppercase [&_button]:!tracking-wider [&_button]:!rounded-none hover:[&_button]:!bg-white hover:[&_button]:!text-black [&_button]:!transition-colors"
      />

      {account && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase">
            <span className="w-1.5 h-1.5 bg-green-400" />
            <span className="text-green-400 text-[10px] font-bold">
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </span>
          </div>

          {hasOpenDispute ? (
            <div className="flex items-center gap-2 font-mono uppercase text-amber-400 text-[10px]">
              DISPUTE_OPEN — review before attesting
            </div>
          ) : (
            <div className="flex flex-col gap-1 font-mono text-[10px] text-zinc-400">
              <span>✓ {sourceCount} source(s) on-chain</span>
              <span>✓ Page provenance traceable</span>
            </div>
          )}

          <button
            onClick={handleAttest}
            disabled={isPending || !!digest || hasOpenDispute}
            className="w-full py-2 border border-white hover:bg-white hover:text-black text-xs font-mono font-bold transition-colors text-white uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <Loader className="w-3 h-3 animate-spin" /> ATTESTING...
              </span>
            ) : digest ? (
              "✓ ATTESTED"
            ) : (
              "ATTEST_PROVENANCE_VERIFIED"
            )}
          </button>

          {attestCount > 0 && (
            <div className="flex items-center justify-between text-xs font-mono uppercase text-zinc-500">
              <span>ATTESTATIONS:</span>
              <span className="text-white font-bold">{attestCount}</span>
            </div>
          )}

          {digest && (
            <div className="flex flex-col gap-1 font-mono text-[10px] text-zinc-400">
              <span className="truncate">TX: {digest.slice(0, 20)}...</span>
              <a
                href={`https://suiscan.xyz/testnet/tx/${digest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
              >
                VIEW_ON_SUISCAN <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      <p className="font-mono text-[10px] text-zinc-600 leading-relaxed">
        PROVENANCE_VERIFIED = CLAIMS_TRACEABLE_TO_RAW_SOURCES. NOT_A_TRUTH_CLAIM.
      </p>
    </div>
  );
}
