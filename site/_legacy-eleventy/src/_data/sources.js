const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "..", "agent", ".cortex", "config.json");

function suiJSONSafe(args) {
  try {
    const result = execSync(`sui client ${args.join(" ")} --json`, {
      encoding: "utf-8",
      timeout: 30000,
    });
    return JSON.parse(result);
  } catch {
    return null;
  }
}

module.exports = async function () {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const wikiId = config.wiki_id;
  if (!wikiId) return [];

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
      blob,
      title: record.title || blob,
      originUrl: record.origin_url || "",
      addedBy: record.added_by || "",
      addedAtMs: record.added_at_ms || 0,
      explorerUrl: `https://suiscan.xyz/testnet/object/${wikiId}`,
      aggregatorUrl: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blob}`,
    });
  }

  console.log(`[cortex-site] Fetched ${sources.length} registered sources`);
  return sources;
};
