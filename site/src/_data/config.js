const fs = require("fs");
const path = require("path");

module.exports = function () {
  const configPath = path.join(__dirname, "..", "..", "..", "agent", ".cortex", "config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  return {
    packageId: config.package_id || "",
    wikiId: config.wiki_id || "",
    network: config.network || "testnet",
    wikiExplorerUrl: `https://suiscan.xyz/testnet/object/${config.wiki_id}`,
    agentA: config.agent_a || {},
    agentB: config.agent_b || {},
  };
};
