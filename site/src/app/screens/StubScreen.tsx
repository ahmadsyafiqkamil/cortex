import { sources } from "../data/mock";
import { MonoAddress } from "../components/MonoAddress";
import { ExternalLink } from "lucide-react";

export function SourcesScreen() {
  return (
    <div className="max-w-[720px] mx-auto px-6 pt-12 pb-24">
      <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--cx-text-primary)" }}>
        Sources
      </h1>
      <p className="mt-2" style={{ color: "var(--cx-text-secondary)", fontSize: 14 }}>
        Raw documents that wiki claims trace back to.
      </p>
      <div className="mt-8 space-y-3">
        {sources.map((s) => (
          <div key={s.id} className="p-4 rounded-lg" style={{ background: "var(--cx-bg-surface)", border: "1px solid var(--cx-border-subtle)" }}>
            <div style={{ color: "var(--cx-text-primary)", fontSize: 15 }}>{s.title}</div>
            <div className="mt-2 flex items-center gap-3" style={{ fontSize: 12 }}>
              <MonoAddress value={s.blob} className="text-[12px]" />
              <a href={s.url} className="inline-flex items-center gap-1" style={{ color: "var(--cx-accent)" }}>
                Walrus <ExternalLink size={11} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExplorerScreen() {
  return (
    <div className="max-w-[720px] mx-auto px-6 pt-24 pb-24 text-center">
      <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--cx-text-primary)" }}>Explorer</h1>
      <p className="mt-3" style={{ color: "var(--cx-text-secondary)", fontSize: 14 }}>
        On-chain transactions, blobs, and attestations live on Suiscan. This panel is a stub.
      </p>
    </div>
  );
}
