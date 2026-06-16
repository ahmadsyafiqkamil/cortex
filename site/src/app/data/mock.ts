import data from "./cortex-data.json";

export type Source = {
  id: string;
  title: string;
  blob: string;
  url?: string;
};

export type PageVersion = {
  hash: string;
  date: string;
  author: string;
  message: string;
};

export type Dispute = {
  id: string;
  status: "open" | "resolved";
  raisedBy: string;
  counterSource: string;
  rationale: string;
};

export type Page = {
  slug: string;
  title: string;
  tags: string[];
  content: string;
  blobId: string;
  objectId: string;
  sourceIds: string[];
  links: string[];
  disputes: Dispute[];
  versions: PageVersion[];
  pos: { x: number; y: number };
};

function normalizeTitle(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  return "";
}

export const sources: Source[] = data.sources || [];
export const pages: Page[] = (data.pages || []).map((p: any) => ({
  ...p,
  title: normalizeTitle(p.title),
}));

export const pageBySlug = (slug: string) => pages.find((p) => p.slug === slug);
export const sourceById = (id: string) => sources.find((s) => s.id === id);
