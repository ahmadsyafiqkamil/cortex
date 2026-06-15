import { TagPill } from "./TagPill";

export function ConfidenceBadge({ sources }: { sources: number }) {
  const high = sources >= 2;
  return <TagPill tone={high ? "success" : "warning"}>{high ? "High" : "Low"} confidence</TagPill>;
}
