import { ExternalLink, FileText } from "lucide-react";
import { sources, pages, type Source } from "../data/mock";

export function SourcesScreen() {
  const sourceWithPages = sources.map((s) => ({
    ...s,
    citedBy: pages.filter((p) => p.sourceIds?.includes(s.id)),
  }));

  return (
    <div className="flex-1 flex p-6 max-w-[1400px] mx-auto w-full gap-6">
      <div className="flex-1 flex flex-col gap-6">
        <div className="border border-zinc-800 bg-[#020202] flex flex-col">
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between bg-zinc-900/50">
            <h2 className="font-mono text-xs text-white tracking-widest flex items-center gap-2 uppercase font-bold">
              <span className="w-2 h-2 bg-white" />
              REGISTERED_SOURCES
            </h2>
            <span className="font-mono text-[10px] text-zinc-500 uppercase">COUNT: {sources.length}</span>
          </div>

          <div className="flex flex-col">
            {sourceWithPages.map((source, i) => (
              <SourceRow key={source.id} source={source} index={i} isLast={i === sources.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourceRow({
  source,
  index,
  isLast,
}: {
  source: Source & { citedBy: typeof pages };
  index: number;
  isLast: boolean;
}) {
  return (
    <div
      className={`group flex flex-col px-4 py-4 hover:bg-zinc-900/50 transition-colors ${!isLast ? "border-b border-zinc-800" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="font-mono text-xs text-zinc-600 mt-0.5 group-hover:text-zinc-400 transition-colors">
          {(index + 1).toString().padStart(2, "0")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <FileText className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors flex-shrink-0" />
            <h3 className="font-bold text-zinc-200 group-hover:text-white transition-colors text-lg tracking-tight truncate">
              {source.title}
            </h3>
          </div>

          <div className="flex items-center gap-3 mt-1.5 font-mono text-[10px] text-zinc-500 uppercase">
            <span>BLOB:</span>
            <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors truncate max-w-[200px]">
              {source.blob}
            </span>
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-zinc-600 hover:text-white transition-colors ml-auto flex-shrink-0"
              >
                VIEW <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {source.citedBy.length > 0 && (
            <div className="mt-3 border-t border-zinc-800/50 pt-3">
              <div className="font-mono text-[10px] text-zinc-500 uppercase mb-2 tracking-wider">
                CITED_BY · {source.citedBy.length} PAGES
              </div>
              <div className="flex flex-wrap gap-2">
                {source.citedBy.map((page) => (
                  <a
                    key={page.slug}
                    href={`/#/app/wiki/${page.slug}`}
                    className="font-mono text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-white px-2 py-1 transition-colors uppercase"
                  >
                    → {page.slug}
                  </a>
                ))}
              </div>
            </div>
          )}

          {source.citedBy.length === 0 && (
            <div className="mt-3 border-t border-zinc-800/50 pt-3">
              <div className="font-mono text-[10px] text-zinc-600 uppercase tracking-wider">
                NO_PAGES_REFERENCE_THIS_SOURCE
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
