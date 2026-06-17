import { useState, useEffect, useCallback } from "react";
import { ExternalLink, FileText, Play, RefreshCw } from "lucide-react";
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { sources, type Source } from "../data/mock";
import { PACKAGE_ID, WIKI_ID, AGGREGATOR_URL } from "../lib/sui";
import { GeneratePagesModal } from "../components/GeneratePagesModal";

export function SourcesScreen() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [isContributor, setIsContributor] = useState(false);
  const [contributorLoading, setContributorLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<{ blobId: string; title: string } | null>(null);
  const [liveSources, setLiveSources] = useState<Source[] | null>(null);
  const [livePageSourceMap, setLivePageSourceMap] = useState<Map<string, { slug: string }[]>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const checkContributor = useCallback(async () => {
    if (!account) {
      setIsContributor(false);
      setContributorLoading(false);
      return;
    }
    try {
      const objs = await client.getOwnedObjects({
        owner: account.address,
        filter: { StructType: `${PACKAGE_ID}::wiki::ContributorCap` },
        options: { showType: true },
      });
      setIsContributor((objs.data?.length ?? 0) > 0);
    } catch {
      setIsContributor(false);
    }
    setContributorLoading(false);
  }, [account, client]);

  useEffect(() => {
    setContributorLoading(true);
    checkContributor();
  }, [checkContributor]);

  const fetchLiveSources = useCallback(async () => {
    if (!WIKI_ID) return;
    setRefreshing(true);
    try {
      const dfs = await client.getDynamicFields({ parentId: WIKI_ID });
      console.log("[SourcesScreen] getDynamicFields returned", dfs.data.length, "entries");
      const fetched: Source[] = [];
      const pageMap = new Map<string, { slug: string }[]>();

      for (const df of dfs.data) {
        const name = (df.name as any)?.value ?? String(df.name ?? "");

        if (name.startsWith("src:")) {
          try {
            const obj = await client.getObject({
              id: df.objectId,
              options: { showContent: true },
            });
            const content = obj.data?.content as any;
            const fields = content?.fields;
            const value = fields?.value?.fields ?? {};
            console.log("[SourcesScreen] RAW src entry", {
              name,
              objectId: df.objectId,
              hasContent: !!obj.data?.content,
              contentType: content?.dataType,
              contentKeys: content ? Object.keys(content) : [],
              fieldKeys: fields ? Object.keys(fields) : [],
              valueKeys: value ? Object.keys(value) : [],
            });
            const blob = value.blob ?? "";
            if (!blob) continue;

            fetched.push({
              id: blob,
              title: value.title ?? blob,
              blob,
              url: `${AGGREGATOR_URL}/${blob}`,
            });
            console.log("[SourcesScreen] source:", { name, blob, title: value.title });
          } catch (e) {
            console.warn("[SourcesScreen] skip unreadable source entry:", name, e);
          }
        } else if (name && !name.startsWith("_")) {
          try {
            const obj = await client.getObject({
              id: df.objectId,
              options: { showContent: true },
            });
            const content = obj.data?.content as any;
            const fields = content?.fields;
            const value = fields?.value?.fields ?? {};
            const sourcesList: string[] = value.sources ?? [];

            for (const srcBlob of sourcesList) {
              if (!pageMap.has(srcBlob)) pageMap.set(srcBlob, []);
              pageMap.get(srcBlob)!.push({ slug: name });
            }
            if (sourcesList.length > 0) {
              console.log("[SourcesScreen] page:", { slug: name, sources: sourcesList });
            } else {
              console.log("[SourcesScreen] page with NO sources:", { slug: name, valueKeys: Object.keys(value) });
            }
          } catch (e) {
            console.warn("[SourcesScreen] skip unreadable page entry:", name, e);
          }
        }
      }

      setLiveSources(fetched);
      setLivePageSourceMap(pageMap);
      console.log("[SourcesScreen] done — sources:", fetched.length, "pages cited:", [...pageMap.entries()].map(([k,v]) => `${k}=>${v.map(x=>x.slug)}`));
    } catch (e) {
      console.error("[SourcesScreen] fetchLiveSources failed:", e);
    }
    setRefreshing(false);
  }, [client]);

  useEffect(() => {
    fetchLiveSources();
  }, [fetchLiveSources]);

  const displaySources = liveSources && liveSources.length > 0 ? liveSources : sources;
  const sourceWithPages = displaySources.map((s) => ({
    ...s,
    citedBy: livePageSourceMap.get(s.id) ?? [],
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
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] text-zinc-500 uppercase">
                COUNT: {displaySources.length}
              </span>
              <button
                onClick={fetchLiveSources}
                disabled={refreshing}
                className="font-mono text-[10px] uppercase tracking-wider border border-zinc-700 text-zinc-400
                           px-2 py-0.5 hover:border-white hover:text-white transition-colors flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                REFRESH
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            {sourceWithPages.map((source, i) => (
              <SourceRow
                key={source.id}
                source={source}
                index={i}
                isLast={i === sourceWithPages.length - 1}
                isContributor={isContributor}
                contributorLoading={contributorLoading}
                onGeneratePages={(blobId, title) => setActiveModal({ blobId, title })}
              />
            ))}
          </div>
        </div>

        {!account && (
          <div className="border border-zinc-800 bg-black p-6">
            <p className="font-mono text-xs text-zinc-500 mb-4">
              CONNECT_WALLET_AS_CONTRIBUTOR_TO_GENERATE_PAGES
            </p>
            <ConnectButton className="!font-mono !text-xs !uppercase !tracking-wider !border !border-white/30 !bg-transparent !text-white hover:!bg-white/10 !rounded-none !px-4 !py-2" />
          </div>
        )}
      </div>

      {activeModal && (
        <GeneratePagesModal
          blobId={activeModal.blobId}
          title={activeModal.title}
          open={true}
          onClose={() => setActiveModal(null)}
          onPageGenerated={() => { fetchLiveSources(); }}
        />
      )}
    </div>
  );
}

function SourceRow({
  source,
  index,
  isLast,
  isContributor,
  contributorLoading,
  onGeneratePages,
}: {
  source: Source & { citedBy: { slug: string }[] };
  index: number;
  isLast: boolean;
  isContributor: boolean;
  contributorLoading: boolean;
  onGeneratePages: (blobId: string, title: string) => void;
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
          </div>

          <div className="flex items-center gap-3 mt-2">
            {source.url && (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] flex items-center gap-1 text-zinc-600 hover:text-white transition-colors uppercase"
              >
                VIEW_SOURCE <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {source.citedBy.length === 0 && isContributor && (
              <button
                onClick={() => onGeneratePages(source.blob, source.title)}
                className="font-mono text-[10px] uppercase tracking-wider border border-green-700 text-green-400
                           px-3 py-1 hover:bg-green-950 transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3 h-3" />
                GENERATE_PAGES
              </button>
            )}
            {source.citedBy.length === 0 && !isContributor && !contributorLoading && (
              <span className="font-mono text-[10px] text-zinc-600 uppercase">
                CONTRIBUTOR_ONLY
              </span>
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
