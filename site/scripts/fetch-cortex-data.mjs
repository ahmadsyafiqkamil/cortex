import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const CONFIG_PATH = resolve(REPO_ROOT, "agent", ".cortex", "config.json");
const CACHE_DIR = resolve(REPO_ROOT, "agent", ".cortex", "cache");
const OUT_PATH = resolve(__dirname, "..", "src", "app", "data", "cortex-data.json");

const SYSTEM_SLUGS = new Set(["_index", "_log"]);
const FRONTMATTER_RE = /^---\s*\n(.*?)\n---\s*\n?/s;
const MARKER_RE = /\^\[blob:([A-Za-z0-9_\-]+)\]/g;
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const RPC_URL = "https://fullnode.testnet.sui.io:443";
const AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";

function suiJSON(args) {
  const result = execSync(`sui client ${args.join(" ")} --json`, {
    encoding: "utf-8",
    timeout: 30000,
    cwd: REPO_ROOT,
  });
  return JSON.parse(result);
}

function suiJSONSafe(args) {
  try { return suiJSON(args); } catch { return null; }
}

function readBlob(blobId) {
  const cached = resolve(CACHE_DIR, blobId);
  try { return readFileSync(cached, "utf-8"); } catch {}
  try {
    return execSync(`walrus read ${blobId} --context testnet`, {
      encoding: "utf-8",
      timeout: 15000,
      cwd: REPO_ROOT,
    });
  } catch {
    return null;
  }
}

function rpcQueryEvents(packageId, moduleId, eventName, limit = 100) {
  const eventType = `${packageId}::${moduleId}::${eventName}`;
  const payload = JSON.stringify({
    jsonrpc: "2.0", id: 1,
    method: "suix_queryEvents",
    params: [{ MoveEventType: eventType }, null, limit, true],
  });
  try {
    const result = execSync(
      `curl -s -X POST '${RPC_URL}' -H 'Content-Type: application/json' -d '${JSON.stringify(payload)}'`,
      { encoding: "utf-8", timeout: 15000 }
    );
    const parsed = JSON.parse(result);
    return (parsed.result && parsed.result.data) || [];
  } catch {
    return [];
  }
}

function parseFrontmatter(md) {
  const match = md.match(FRONTMATTER_RE);
  if (!match) return {};
  try {
    const fm = {};
    for (const line of match[1].split("\n")) {
      const c = line.indexOf(":");
      if (c > 0 && !line.startsWith(" ") && !line.startsWith("-")) {
        let val = line.slice(c + 1).trim();
        // Handle YAML inline arrays: [a, b, c]
        if (val.startsWith("[") && val.endsWith("]")) {
          val = val.slice(1, -1).split(",").map(v => v.trim().replace(/^['"]|['"]$/g, ""));
        } else {
          val = [val];
        }
        fm[line.slice(0, c).trim()] = val;
      }
    }
    return fm;
  } catch { return {}; }
}

function bodyWithoutFrontmatter(md) {
  return md.replace(FRONTMATTER_RE, "").trim();
}

function extractMarkers(md) {
  const markers = [];
  let m;
  while ((m = MARKER_RE.exec(md)) !== null) markers.push(m[1]);
  MARKER_RE.lastIndex = 0;
  return markers;
}

function extractWikilinks(md) {
  const links = [];
  let m;
  while ((m = WIKILINK_RE.exec(md)) !== null) links.push(m[1]);
  WIKILINK_RE.lastIndex = 0;
  return links;
}

function assignPositions(pages) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const radius = 0.42;
  const cx = 0.5, cy = 0.5;
  return pages.map((p, i) => ({
    ...p,
    pos: {
      x: cx + radius * Math.cos(i * goldenAngle),
      y: cy + radius * Math.sin(i * goldenAngle),
    },
  }));
}

async function fetchPages(wikiId, packageId) {
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
    const sourceIds = (record.sources || []).map(s => s.blob || s);
    const updatedAtMs = record.updated_at_ms || 0;
    const updatedBy = record.updated_by || "";
    const deleted = record.deleted || false;

    if (deleted || !latestBlob) continue;

    const md = readBlob(latestBlob);
    if (!md) continue;

    const fm = parseFrontmatter(md);
    const content = bodyWithoutFrontmatter(md);
    const wikilinks = extractWikilinks(md);

    const tags = fm.tags
      ? (typeof fm.tags === "string" ? fm.tags.split(",").map(t => t.trim()) : fm.tags)
      : [];

    const pageObj = record.id && record.id.id ? record.id.id : "";
    const versions = [
      {
        hash: latestBlob,
        date: new Date(Number(updatedAtMs)).toISOString(),
        author: updatedBy,
        message: "current",
      },
      ...history.map((h, i) => ({
        hash: h.blob || h,
        date: new Date(Number(h.updated_at_ms || 0)).toISOString(),
        author: h.updated_by || "",
        message: `version ${history.length - i}`,
      })),
    ];

    pages.push({
      slug,
      title: fm.title || slug,
      tags,
      content,
      blobId: latestBlob,
      objectId: pageObj || wikiId,
      sourceIds,
      links: wikilinks,
      disputes: [],
      versions,
    });
  }

  console.log(`[cortex-site] Fetched ${pages.length} content pages`);
  return pages;
}

async function fetchSources(wikiId) {
  const dfResult = suiJSONSafe(["dynamic-field", wikiId]);
  if (!dfResult) return [];

  const entries = dfResult.dynamicFields || [];
  const sources = [];

  for (const entry of entries) {
    const fieldObj = entry.fieldObject || entry;
    const json = fieldObj.json || fieldObj;
    const name = (json && json.name) ? json.name : (entry.name && entry.name.value) || "";

    if (!name || !name.startsWith("src:")) continue;

    const record = json && json.value ? json.value : {};
    const blob = record.blob || "";
    if (!blob) continue;

    sources.push({
      id: blob,
      title: record.title || blob,
      blob,
      url: `${AGGREGATOR}/${blob}`,
    });
  }

  console.log(`[cortex-site] Fetched ${sources.length} registered sources`);
  return sources;
}

async function fetchDisputes(packageId) {
  if (!packageId) return [];

  const events = rpcQueryEvents(packageId, "dispute", "DisputeRaised", 100);
  const disputes = [];

  for (const evt of events) {
    const p = evt.parsedJson;
    if (!p) continue;
    disputes.push({
      id: p.dispute_id || "",
      status: "open",
      raisedBy: p.raised_by || "",
      counterSource: p.reason_blob || "",
      rationale: p.reason_blob ? `Dispute against page "${p.page || ""}"` : "",
      page: p.page || "",
    });
  }

  return disputes;
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  const wikiId = config.wiki_id;
  const packageId = config.package_id;

  if (!wikiId) {
    console.error("wiki_id not found in config.json — writing placeholder");
    writeFileSync(OUT_PATH, JSON.stringify({ config: { packageId: "", wikiId: "", network: "testnet", explorer: "https://suiscan.xyz/testnet", aggregator: AGGREGATOR, buildTime: new Date().toISOString() }, pages: [], sources: [] }, null, 2));
    return;
  }

  const [pages, sources, allDisputes] = await Promise.all([
    fetchPages(wikiId, packageId),
    fetchSources(wikiId),
    fetchDisputes(packageId),
  ]);

  // Merge disputes into pages by slug
  for (const d of allDisputes) {
    const target = pages.find(p => p.slug === d.page);
    if (target) {
      target.disputes.push({
        id: d.id,
        status: d.status,
        raisedBy: d.raisedBy,
        counterSource: d.counterSource,
        rationale: d.rationale,
      });
    }
  }

  const pagesWithPos = assignPositions(pages);

  const output = {
    config: {
      packageId,
      wikiId,
      network: config.network || "testnet",
      ownerCapId: config.owner_cap_id || "",
      explorer: `https://suiscan.xyz/testnet`,
      aggregator: AGGREGATOR,
      buildTime: new Date().toISOString(),
    },
    pages: pagesWithPos,
    sources,
  };

  writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`[cortex-site] Wrote ${pagesWithPos.length} pages, ${sources.length} sources`);
}

main().catch((err) => {
  console.error("fetch-cortex-data failed:", err.message);
  process.exit(1);
});
