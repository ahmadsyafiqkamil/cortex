import { Outlet, Link, useLocation } from "react-router";
import { Network, Database, Hexagon, Search } from "lucide-react";
import { clsx } from "clsx";

export function Layout() {
  const location = useLocation();

  const navItems = [
    { name: "INDEX", path: "/app", icon: <Database className="w-4 h-4" /> },
    { name: "GRAPH_VIEW", path: "/app/graph", icon: <Network className="w-4 h-4" /> },
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
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
