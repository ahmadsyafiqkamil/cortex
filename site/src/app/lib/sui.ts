import data from "../data/cortex-data.json";

export const PACKAGE_ID = data.config?.packageId || "";
export const WIKI_ID = data.config?.wikiId || "";
export const OWNER_CAP_ID = data.config?.ownerCapId || "";
export const NETWORK = (data.config?.network || "testnet") as "testnet" | "mainnet";
export const AGGREGATOR_URL = "https://aggregator.walrus-testnet.walrus.space/v1/blobs";
export const PUBLISHER_URL = "https://publisher.walrus-testnet.walrus.space/v1/blobs";

export function getPageBlob(slug: string): string {
  const page = data.pages?.find((p) => p.slug === slug);
  return page?.blobId || "";
}

export function buildAttestTx(slug: string) {
  const pageBlob = getPageBlob(slug);
  if (!PACKAGE_ID || !WIKI_ID || !pageBlob) return null;

  return {
    packageId: PACKAGE_ID,
    module: "attest",
    function: "attest_provenance",
    arguments: [WIKI_ID, slug, pageBlob],
  };
}

export function buildRaiseDisputeTx(
  slug: string,
  reasonBlob: string,
  contributorCapId: string,
) {
  if (!PACKAGE_ID || !WIKI_ID || !contributorCapId) return null;

  return {
    packageId: PACKAGE_ID,
    module: "dispute",
    function: "raise_dispute",
    arguments: [contributorCapId, WIKI_ID, slug, reasonBlob],
  };
}

export function buildResolveDisputeTx(
  disputeId: string,
  accept: boolean,
  contributorCapId: string,
) {
  if (!PACKAGE_ID || !WIKI_ID || !contributorCapId) return null;

  return {
    packageId: PACKAGE_ID,
    module: "dispute",
    function: "resolve_dispute",
    arguments: [contributorCapId, WIKI_ID, disputeId, accept],
  };
}

export function buildUpdatePageTx(
  slug: string,
  newBlobId: string,
  sourceIds: string[],
  contributorCapId: string,
) {
  if (!PACKAGE_ID || !WIKI_ID || !contributorCapId) return null;

  return {
    packageId: PACKAGE_ID,
    module: "wiki",
    function: "update_page",
    arguments: [contributorCapId, WIKI_ID, slug, newBlobId, sourceIds, "0x6"],
  };
}
