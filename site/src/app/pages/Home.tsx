import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Clock, FileText, Activity, Hash, Layers, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pages } from "../data/mock";
import { ApplyPanel } from "../components/ApplyPanel";
import { ContributorDashboard } from "../components/ContributorDashboard";

const ITEMS_PER_PAGE = 10;

const SYSTEM_STATS = [
  { label: "TOTAL_PAGES", value: pages.length.toString(), icon: <Layers className="w-4 h-4" /> },
  { label: "SOURCES", value: String(new Set(pages.flatMap(p => p.sourceIds)).size), icon: <FileText className="w-4 h-4" /> },
  { label: "DISPUTES", value: String(pages.reduce((acc, p) => acc + p.disputes.filter(d => d.status === "open").length, 0)), icon: <Activity className="w-4 h-4" /> },
  { label: "LINKS", value: String(pages.reduce((acc, p) => acc + p.links.length, 0)), icon: <Hash className="w-4 h-4" /> },
];

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPages = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedPages = [...filteredPages].sort((a, b) => {
    const aDate = a.versions[0]?.date ? new Date(a.versions[0].date).getTime() : 0;
    const bDate = b.versions[0]?.date ? new Date(b.versions[0].date).getTime() : 0;
    return bDate - aDate;
  });

  const totalPages = Math.max(1, Math.ceil(sortedPages.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPages = sortedPages.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <>
    <div className="flex-1 flex p-6 max-w-[1400px] mx-auto w-full gap-6">

      {/* Left Column: Recent Updates */}
      <div className="flex-[2] flex flex-col gap-6">
        <div className="border border-zinc-800 bg-[#020202] flex flex-col">
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-white" />
              ALL_PAGES
            </h2>
            <span className="font-mono text-[10px] text-zinc-500 uppercase">COUNT: {filteredPages.length} / {pages.length}</span>
          </div>

          <div className="border-b border-zinc-800 px-4 py-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                placeholder="FILTER_PAGES..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="bg-transparent border border-zinc-800 text-xs font-mono text-white placeholder:text-zinc-600 pl-8 pr-3 py-1.5 focus:outline-none focus:border-white focus:bg-zinc-900 transition-all w-full rounded-none"
              />
            </div>
          </div>

          <div className="flex flex-col">
            {paginatedPages.length > 0 ? paginatedPages.map((page, i) => (
              <Link
                key={page.slug}
                to={`/app/wiki/${page.slug}`}
                className={`group flex items-center justify-between px-4 py-4 hover:bg-white hover:text-black transition-colors ${i !== paginatedPages.length - 1 ? 'border-b border-zinc-800' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div className="font-mono text-xs text-zinc-600 mt-0.5 group-hover:text-black transition-colors">
                    {((safePage - 1) * ITEMS_PER_PAGE + i + 1).toString().padStart(2, '0')}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-200 group-hover:text-black transition-colors text-lg tracking-tight">
                      {page.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-zinc-500 group-hover:text-black/70 transition-colors uppercase">
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {page.slug}
                      </span>
                      {page.versions[0]?.date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(page.versions[0].date))} ago
                        </span>
                      )}
                      {page.versions.length > 0 && (
                        <span>{page.versions.length} versions</span>
                      )}
                    </div>
                    {page.disputes.length > 0 && (
                      <div className="mt-1">
                        <span className="font-mono text-[10px] text-amber-500 uppercase font-bold">
                          {page.disputes.filter(d => d.status === "open").length} OPEN DISPUTES
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-700 group-hover:text-black transition-colors" />
              </Link>
            )) : (
              <div className="p-8 text-center font-mono text-xs text-zinc-500 uppercase">
                {searchQuery ? "NO_RESULTS_FOUND" : "NO_PAGES_INDEXED"}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="border-t border-zinc-800 px-4 py-3 flex items-center justify-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-2 py-1 font-mono text-xs text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors rounded-none"
              >
                PREV
              </button>
              {pageNumbers.map((n, i) =>
                n === "ellipsis" ? (
                  <span key={`ellipsis-${i}`} className="px-1 font-mono text-xs text-zinc-600">
                    ...
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    className={`px-2 py-1 font-mono text-xs transition-colors rounded-none ${
                      n === safePage
                        ? "bg-white text-black font-bold"
                        : "text-zinc-500 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-2 py-1 font-mono text-xs text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500 transition-colors rounded-none"
              >
                NEXT
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: System Status & Quick Links */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="border border-zinc-800 bg-[#020202]">
          <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-white animate-pulse" />
              SYSTEM_TELEMETRY
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-zinc-800">
            {SYSTEM_STATS.map((stat) => (
              <div key={stat.label} className="bg-[#020202] p-4 flex flex-col gap-2 hover:bg-zinc-900 transition-colors">
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 uppercase">
                  {stat.icon}
                  {stat.label}
                </div>
                <div className="font-mono text-xl text-white font-bold tracking-tight">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-zinc-800 bg-[#020202]">
          <div className="border-b border-zinc-800 px-4 py-3 bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-zinc-600" />
              QUICK_LINKS
            </h2>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <Link to="/app/sources" className="w-full py-3 border border-zinc-800 hover:border-white text-xs font-mono font-bold transition-colors text-white uppercase tracking-wider text-center hover:bg-white hover:text-black">
              VIEW_ALL_SOURCES
            </Link>
            <Link to="/app/graph" className="w-full py-3 border border-zinc-800 hover:border-white text-xs font-mono font-bold transition-colors text-white uppercase tracking-wider text-center hover:bg-white hover:text-black">
              GRAPH_VIEW
            </Link>
          </div>
        </div>
      </div>

    </div>

    {/* Contributor Section */}
    <div className="max-w-[1400px] mx-auto w-full px-6 pb-6 flex flex-col gap-6">
      <ApplyPanel />
      <ContributorDashboard />
    </div>
    </>
  );
}
