import { useState, useEffect, useCallback } from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Edit3 } from "lucide-react";
import { PACKAGE_ID } from "../lib/sui";

type PanelStatus = "loading" | "no_wallet" | "non_contributor" | "ready";

interface EditPanelProps {
  onEditStart: (contributorCapId: string) => void;
  disabled?: boolean;
}

export function EditPanel({ onEditStart, disabled }: EditPanelProps) {
  const account = useCurrentAccount();
  const client = useSuiClient();

  const [panelStatus, setPanelStatus] = useState<PanelStatus>("loading");
  const [contributorCapId, setContributorCapId] = useState("");

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
      <div className="border-t border-zinc-800 p-4 bg-zinc-900/30">
        <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <Edit3 className="w-3 h-3" />
          EDIT_PAGE
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
        <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
          <Edit3 className="w-3 h-3" />
          EDIT_PAGE
        </h4>
        <p className="font-mono text-[10px] text-zinc-500 mb-3">
          CONNECT_WALLET_TO_EDIT
        </p>
        <ConnectButton
          connectText="CONNECT_WALLET"
          className="[&_button]:!w-full [&_button]:!py-2 [&_button]:!border [&_button]:!border-zinc-700 [&_button]:!bg-transparent [&_button]:!text-white [&_button]:!font-mono [&_button]:!text-xs [&_button]:!font-bold [&_button]:!uppercase [&_button]:!tracking-wider [&_button]:!rounded-none hover:[&_button]:!bg-zinc-900 hover:[&_button]:!border-white [&_button]:!transition-colors"
        />
      </div>
    );
  }

  if (panelStatus !== "ready") {
    return null;
  }

  return (
    <div className="border-t border-zinc-800 p-4 bg-zinc-900/30 flex flex-col gap-3">
      <h4 className="font-mono text-[10px] text-white font-bold uppercase tracking-widest flex items-center gap-2">
        <Edit3 className="w-3 h-3" />
        EDIT_PAGE
      </h4>
      <button
        onClick={() => onEditStart(contributorCapId)}
        disabled={disabled}
        className="w-full py-2 border border-white text-white hover:bg-white hover:text-black font-mono text-xs font-bold uppercase tracking-wider transition-colors disabled:border-zinc-700 disabled:text-zinc-600 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-zinc-600"
      >
        EDIT_PAGE_CONTENT
      </button>
      <p className="font-mono text-[10px] text-zinc-600 leading-relaxed border-t border-zinc-800 pt-3">
        EDIT_THE_MARKDOWN_CONTENT_DIRECTLY. CHANGES_ARE_VERSIONED_ON_CHAIN.
        REQUIRES_CONTRIBUTOR_CAP.
      </p>
    </div>
  );
}
