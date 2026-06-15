const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "..", "..", "agent", ".cortex", "config.json");

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

function rpcQueryEvents(packageId, moduleId, eventName, limit = 100) {
  const rpcUrl = "https://fullnode.testnet.sui.io:443";
  const eventType = `${packageId}::${moduleId}::${eventName}`;
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "suix_queryEvents",
    params: [{ MoveEventType: eventType }, null, limit, true],
  });
  try {
    const result = execSync(
      `curl -s -X POST '${rpcUrl}' -H 'Content-Type: application/json' -d '${payload}'`,
      { encoding: "utf-8", timeout: 15000 }
    );
    const parsed = JSON.parse(result);
    return (parsed.result && parsed.result.data) || [];
  } catch {
    return [];
  }
}

module.exports = async function () {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const packageId = config.package_id;
  if (!packageId) return [];

  const events = rpcQueryEvents(packageId, "dispute", "DisputeRaised", 100);
  const disputes = [];

  for (const evt of events) {
    const p = evt.parsedJson;
    if (!p) continue;

    const disputeId = p.dispute_id;
    const status = 0;
    const reasonBlob = p.reason_blob || "";
    let rationaleHtml = "";
    if (reasonBlob) {
      const md = readBlob(reasonBlob);
      if (md) {
        rationaleHtml = md
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>");
      }
    }

    disputes.push({
      disputeId,
      page: p.page || "",
      reasonBlob,
      raisedBy: p.raised_by || "",
      status,
      statusLabel: "Open",
      rationaleHtml,
      explorerUrl: `https://suiscan.xyz/testnet/object/${disputeId}`,
    });
  }

  console.log(`[cortex-site] Fetched ${disputes.length} disputes`);
  return disputes;
};
