const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "..", "agent", ".cortex", "config.json");
const SYSTEM_SLUGS = new Set(["_index", "_log"]);

const FRONTMATTER_RE = /^---\s*\n(.*?)\n---\s*\n?/s;
const MARKER_RE = /\^\[blob:([A-Za-z0-9_\-]+)\]/g;
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

function suiJSON(args) {
  const result = execSync(`sui client ${args.join(" ")} --json`, {
    encoding: "utf-8",
    timeout: 30000,
  });
  return JSON.parse(result);
}

function suiJSONSafe(args) {
  try {
    return suiJSON(args);
  } catch {
    return null;
  }
}

function readBlob(blobId) {
  const cacheDir = path.join(__dirname, "..", "..", "..", "agent", ".cortex", "cache");
  const cached = path.join(cacheDir, blobId);
  if (fs.existsSync(cached)) {
    return fs.readFileSync(cached, "utf-8");
  }
  try {
    const result = execSync(`walrus read ${blobId} --context testnet`, {
      encoding: "utf-8",
      timeout: 15000,
    });
    return result;
  } catch {
    return null;
  }
}

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return JSON.parse(raw);
}

function parseFrontmatter(md) {
  const match = md.match(FRONTMATTER_RE);
  if (!match) return {};
  try {
    const lines = match[1].split("\n");
    const fm = {};
    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon > 0 && !line.startsWith(" ") && !line.startsWith("-")) {
        const key = line.slice(0, colon).trim();
        const val = line.slice(colon + 1).trim();
        fm[key] = val;
      }
    }
    return fm;
  } catch {
    return {};
  }
}

function extractMarkers(md) {
  const markers = [];
  let m;
  while ((m = MARKER_RE.exec(md)) !== null) {
    markers.push(m[1]);
  }
  MARKER_RE.lastIndex = 0;
  return markers;
}

function extractWikilinks(md) {
  const links = [];
  let m;
  while ((m = WIKILINK_RE.exec(md)) !== null) {
    links.push(m[1]);
  }
  WIKILINK_RE.lastIndex = 0;
  return links;
}

function bodyWithoutFrontmatter(md) {
  return md.replace(FRONTMATTER_RE, "").trim();
}

function renderMarkdown(md) {
  let html = md;
  html = html.replace(FRONTMATTER_RE, "");

  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-5 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/(<li class="ml-4 list-disc">.*<\/li>\n?)+/g, '<ul class="my-2">$&</ul>');

  html = html.replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 italic my-2">$1</blockquote>');

  html = html.split("\n\n").map(block => {
    if (block.startsWith("<") || block.trim() === "") return block;
    return `<p class="mb-3">${block}</p>`;
  }).join("\n");

  html = html.replace(/\^\[blob:([A-Za-z0-9_\-]+)\]/g,
    '<a href="https://aggregator.walrus-testnet.walrus.space/v1/blobs/$1" target="_blank" rel="noopener" class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-blue-900/40 text-blue-300 border border-blue-600 rounded hover:bg-blue-800/50 transition-colors" title="Source blob: $1">blob:$1</a>');

  html = html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, slug, display) => {
    const label = display || slug;
    return `<a href="/${slug}/index.html" class="text-blue-400 hover:text-blue-300 underline">${label}</a>`;
  });

  return html;
}

function countUniqueMarkersPerClaim(md) {
  const body = bodyWithoutFrontmatter(md);
  const claims = [];
  for (const line of body.split("\n")) {
    const lineMarkers = [];
    const markerRegex = /\^\[blob:([A-Za-z0-9_\-]+)\]/g;
    let m;
    while ((m = markerRegex.exec(line)) !== null) {
      lineMarkers.push(m[1]);
    }
    if (lineMarkers.length > 0) {
      const text = line.replace(/\^\[blob:[A-Za-z0-9_\-]+\]/g, "").trim();
      claims.push({
        text: text.length > 200 ? text.slice(0, 197) + "..." : text,
        uniqueMarkers: [...new Set(lineMarkers)].length,
        confidence: lineMarkers.length >= 2 ? "high" : "low",
      });
    }
  }
  return claims;
}

module.exports = async function () {
  const config = loadConfig();
  const wikiId = config.wiki_id;
  if (!wikiId) throw new Error("wiki_id not found in config.json");

  const dfResult = suiJSONSafe(["dynamic-field", wikiId]);
  if (!dfResult) return [];

  const entries = dfResult.dynamicFields || [];
  const pages = [];

  for (const entry of entries) {
    const fieldObj = entry.fieldObject || entry;
    const json = fieldObj.json || fieldObj;
    const slug = (json && json.name) ? json.name : (entry.name && entry.name.value) || "";

    if (!slug || SYSTEM_SLUGS.has(slug)) continue;

    const record = json && json.value ? json.value : {};
    const latestBlob = record.latest_blob || "";
    const history = record.history || [];
    const sources = record.sources || [];
    const updatedAt = record.updated_at_ms || 0;
    const updatedBy = record.updated_by || "";
    const deleted = record.deleted || false;

    if (deleted) continue;
    if (!latestBlob) continue;

    const md = readBlob(latestBlob);
    if (!md) continue;

    const fm = parseFrontmatter(md);
    const body = bodyWithoutFrontmatter(md);
    const markers = extractMarkers(md);
    const wikilinks = extractWikilinks(md);
    const claims = countUniqueMarkersPerClaim(md);

    pages.push({
      slug,
      title: fm.title || slug,
      tags: fm.tags || [],
      sources: sources,
      sourceEntries: (fm.sources || []).map(s =>
        typeof s === "string" ? { blob: s, title: s } : s
      ),
      contentHtml: renderMarkdown(md),
      contentMarkdown: md,
      bodyText: body,
      rawMarkers: markers,
      wikilinks,
      claims,
      latestBlob,
      history,
      updatedAtMs: updatedAt,
      updatedBy,
      totalHistory: history.length + 1,
      explorerUrl: `https://suiscan.xyz/testnet/object/${wikiId}`,
    });
  }

  console.log(`[cortex-site] Fetched ${pages.length} content pages`);
  return pages;
};
