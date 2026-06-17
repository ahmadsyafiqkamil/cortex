import { useRef, useEffect, useState, useCallback } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { Network, Database, Hexagon, Search, FileText, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import { useCurrentAccount, useDisconnectWallet, useSuiClient } from "@mysten/dapp-kit";
import { PACKAGE_ID, WIKI_ID } from "../lib/sui";

export function Layout() {
  const location = useLocation();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: disconnect } = useDisconnectWallet();
  const navigate = useNavigate();
  const wasConnected = useRef(false);
  const [contributorStatus, setContributorStatus] = useState<"loading" | "contributor" | "non_contributor" | "pending" | "revoked">("loading");

  useEffect(() => {
    if (account) {
      wasConnected.current = true;
    } else if (wasConnected.current) {
      navigate("/", { replace: true });
    }
  }, [account, navigate]);

  const fetchContributorStatus = useCallback(async () => {
    if (!account) return;
    setContributorStatus("loading");
    try {
      const hasCap = await checkOwnsContributorCap(client, account.address, PACKAGE_ID);
      const revoked = await checkIsRevoked(client, account.address, WIKI_ID);
      if (hasCap && !revoked) setContributorStatus("contributor");
      else if (revoked) setContributorStatus("revoked");
      else setContributorStatus("non_contributor");
    } catch {
      setContributorStatus("non_contributor");
    }
  }, [account, client]);

  useEffect(() => {
    fetchContributorStatus();
  }, [fetchContributorStatus]);

  const navItems = [
    { name: "INDEX", path: "/app", icon: <Database className="w-4 h-4" /> },
    { name: "GRAPH_VIEW", path: "/app/graph", icon: <Network className="w-4 h-4" /> },
    { name: "SOURCES", path: "/app/sources", icon: <FileText className="w-4 h-4" /> },
    { name: "ASK", path: "/app/ask", icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#020202] text-zinc-300 font-sans selection:bg-white selection:text-black flex flex-col font-['Inter']">
      <header className="border-b-2 border-zinc-100 bg-[#020202] sticky top-0 z-50">
        <div className="flex items-center justify-between px-6 h-14">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 text-white hover:text-zinc-300 transition-colors">
              <Hexagon className="w-5 h-5 text-white fill-white" />
              <span className="font-mono font-bold tracking-widest text-sm uppercase">Cortex_</span>
            </Link>
            <div className="h-4 w-px bg-zinc-800" />
            <nav className="flex items-center gap-1 font-mono text-xs uppercase font-bold tracking-wider">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || (item.path !== "/app" && location.pathname.startsWith(item.path));
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      "flex items-center gap-2 px-3 py-1.5 transition-colors border",
                      isActive
                        ? "text-black border-white bg-white"
                        : "text-zinc-500 border-transparent hover:text-white hover:border-zinc-800"
                    )}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-white transition-colors" />
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent border border-zinc-800 text-sm font-mono text-white placeholder:text-zinc-600 pl-9 pr-4 py-1.5 focus:outline-none focus:border-white focus:bg-zinc-900 transition-all w-64 rounded-none"
              />
            </div>
            <div className="flex flex-col items-end gap-0.5 font-mono text-[10px] uppercase">
              <div className="flex items-center gap-1.5 text-zinc-400">
                <div className="w-1.5 h-1.5 rounded-none bg-white" />
                SUI TESTNET
              </div>
              <div className="text-zinc-600">WALRUS SYNC: OK</div>
            </div>
            {account && (
              <div className="flex items-center gap-2">
                {contributorStatus === "contributor" && (
                  <span className="font-mono text-[9px] text-green-400 border border-green-800 px-2 py-0.5 uppercase tracking-wider">
                    CONTRIBUTOR
                  </span>
                )}
                {contributorStatus === "pending" && (
                  <span className="font-mono text-[9px] text-amber-400 border border-amber-800 px-2 py-0.5 uppercase tracking-wider">
                    PENDING
                  </span>
                )}
                {contributorStatus === "revoked" && (
                  <span className="font-mono text-[9px] text-red-400 border border-red-800 px-2 py-0.5 uppercase tracking-wider">
                    REVOKED
                  </span>
                )}
                {contributorStatus === "non_contributor" && (
                  <span className="font-mono text-[9px] text-zinc-600 border border-zinc-800 px-2 py-0.5 uppercase tracking-wider">
                    NON_CONTRIBUTOR
                  </span>
                )}
                <span className="font-mono text-[10px] text-green-400 uppercase">
                  {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </span>
                <button
                  onClick={() => disconnect()}
                  className="border border-zinc-700 px-3 py-1 font-mono text-[10px] text-zinc-400 hover:text-white hover:border-white transition-colors uppercase font-bold"
                >
                  DISCONNECT
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}

async function checkOwnsContributorCap(
  client: ReturnType<typeof useSuiClient>,
  address: string,
  packageId: string,
): Promise<boolean> {
  try {
    const objs = await client.getOwnedObjects({
      owner: address,
      filter: { StructType: `${packageId}::wiki::ContributorCap` },
      options: { showType: true },
    });
    return (objs.data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

async function checkIsRevoked(
  client: ReturnType<typeof useSuiClient>,
  address: string,
  wikiId: string,
): Promise<boolean> {
  try {
    const strip0x = address.startsWith("0x") ? address.slice(2) : address;
    const revKey = `rev:${strip0x}`;
    const dfs = await client.getDynamicFields({ parentId: wikiId });
    for (const df of dfs.data) {
      const name = (df.name as any)?.value ?? String(df.name ?? "");
      if (name === revKey) return true;
    }
    return false;
  } catch {
    return false;
  }
}
