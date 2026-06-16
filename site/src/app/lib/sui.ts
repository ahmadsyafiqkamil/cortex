import data from "../data/cortex-data.json";

export const PACKAGE_ID = data.config?.packageId || "";
export const WIKI_ID = data.config?.wikiId || "";
export const NETWORK = (data.config?.network || "testnet") as "testnet" | "mainnet";

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
