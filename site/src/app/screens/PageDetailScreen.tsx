import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, ExternalLink, AlertTriangle, ShieldCheck, GitBranch } from "lucide-react";
import { pageBySlug, pages, sourceById, type Page, type DiffLine } from "../data/mock";
import { TagPill } from "../components/TagPill";
import { ConfidenceBadge } from "../components/ConfidenceBadge";
import { MonoAddress } from "../components/MonoAddress";

export function PageDetailScreen() {
  const { slug = "" } = useParams();
  const page = pageBySlug(slug);
  if (!page) return <NotFound slug={slug} />;
  return <PageDetail page={page} />;
}

function NotFound({ slug }: { slug: string }) {
  return (
    <div className="max-w-[720px] mx-auto px-6 py-24 text-center">
      <div style={{ color: "var(--cx-text-secondary)", fontSize: 16 }}>Page not found</div>
      <div className="mt-2" style={{ color: "var(--cx-text-tertiary)", fontSize: 14 }}>
        No wiki page with slug <span style={{ fontFamily: "var(--font-mono)" }}>[[{slug}]]</span>.
      </div>
      <Link to="/" className="inline-block mt-6" style={{ color: "var(--cx-accent)", fontSize: 14 }}>
        ← Back to Index
      </Link>
    </div>
  );
}

function PageDetail({ page }: { page: Page }) {
  const hasOpenDispute = page.disputes.some((d) => d.status === "open");
  const [leftV, setLeftV] = useState(page.versions[page.versions.length - 1].blob);
  const [rightV, setRightV] = useState(page.versions[0].blob);
  const [showDiff, setShowDiff] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [attested, setAttested] = useState(false);

  return (
    <div className="px-6 pb-24">
      <article className="max-w-[720px] mx-auto pt-10">
        {/* SECTION 1: HEADER */}
        <Link to="/" className="inline-flex items-center gap-2" style={{ color: "var(--cx-text-secondary)", fontSize: 14 }}>
          <ArrowLeft size={14} /> Back to Index
        </Link>
        <h1 className="mt-6" style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--cx-text-primary)" }}>
          {page.title}
        </h1>
        <div className="mt-3 inline-flex items-center px-2.5 py-1 rounded-md"
          style={{ background: "var(--cx-bg-elevated)", color: "var(--cx-text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          [[{page.slug.replace(/-/g, "_")}]]
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {page.tags.map((t) => (
            <TagPill key={t}>{t}</TagPill>
          ))}
        </div>

        {/* SECTION 2: DISPUTE BANNER */}
        {hasOpenDispute && (
          <div
            className="mt-8 p-4 rounded-md flex items-center justify-between"
            style={{ background: "rgba(245,158,11,0.08)", borderLeft: "2px solid var(--cx-warning)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "var(--cx-text-primary)", fontSize: 14 }}>
              <AlertTriangle size={16} color="var(--cx-warning)" />
              {page.disputes.filter((d) => d.status === "open").length} open dispute against claims on this page
            </div>
            <a href="#disputes" style={{ color: "var(--cx-warning)", fontSize: 13 }}>View dispute</a>
          </div>
        )}

        {/* SECTION 3: BODY */}
        <div className="mt-12">
          {page.body.map((sec, i) => (
            <section key={i} className="mb-10">
              {sec.heading && (
                <h2 className="mb-4" style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--cx-text-primary)" }}>
                  {sec.heading}
                </h2>
              )}
              {sec.paragraphs.map((p, j) => (
                <p
                  key={j}
                  className="mt-4"
                  style={{
                    fontSize: 16,
                    lineHeight: 1.7,
                    color: "var(--cx-text-primary)",
                    paddingLeft: p.bold ? 12 : 0,
                    borderLeft: p.bold ? "2px solid var(--cx-accent)" : "none",
                  }}
                >
                  {p.text}{" "}
                  {p.sourceIds.map((sid) => {
                    const s = sourceById(sid);
                    if (!s) return null;
                    return (
                      <a
                        key={sid}
                        href="#provenance"
                        className="inline-flex items-center px-1.5 ml-0.5 rounded align-super"
                        style={{
                          background: "var(--cx-accent-muted)",
                          color: "var(--cx-accent-hover)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          textDecoration: "none",
                          verticalAlign: "super",
                        }}
                        title={s.title}
                      >
                        Source
                      </a>
                    );
                  })}
                </p>
              ))}
            </section>
          ))}
        </div>

        {/* SECTION 4 + 5: PROVENANCE TRAIL + CONFIDENCE */}
        <section id="provenance" className="mt-12">
          <h2 className="mb-4" style={{ fontSize: 20, fontWeight: 600, color: "var(--cx-text-primary)" }}>
            Provenance Trail
          </h2>
          <p style={{ color: "var(--cx-text-tertiary)", fontSize: 12 }}>
            Confidence score: number of independent sources, not a truth claim.
          </p>
          <div className="mt-4 space-y-3">
            {page.claims.map((c, i) => (
              <div key={i} className="p-4 rounded-lg" style={{ background: "var(--cx-bg-surface)", border: "1px solid var(--cx-border-subtle)" }}>
                <div style={{ color: "var(--cx-text-primary)", fontSize: 14, lineHeight: 1.6 }}>
                  Claim: "{c.text}"
                </div>
                <div className="mt-3 pl-3" style={{ borderLeft: "1px dashed var(--cx-border-visible)", fontSize: 12, color: "var(--cx-text-secondary)" }}>
                  <div className="flex items-center gap-2">
                    <span>├─ Page blob ←</span>
                    <MonoAddress value={c.pageBlob} className="text-[12px]" />
                  </div>
                  {c.sourceIds.map((sid, k) => {
                    const s = sourceById(sid);
                    if (!s) return null;
                    const last = k === c.sourceIds.length - 1;
                    return (
                      <div key={sid} className="mt-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{last ? "└─" : "├─"} Raw source ←</span>
                          <a href={s.url} className="inline-flex items-center gap-1" style={{ color: "var(--cx-accent)" }}>
                            {s.title} <ExternalLink size={11} />
                          </a>
                        </div>
                        <div className="pl-5 mt-0.5">
                          <a href={s.url} style={{ color: "var(--cx-accent)", fontSize: 12 }}>[View raw source]</a>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3" style={{ fontSize: 12, color: "var(--cx-text-secondary)" }}>
                  <span>Sources: {c.sourceIds.length}</span>
                  <span style={{ color: "var(--cx-text-tertiary)" }}>●●</span>
                  <ConfidenceBadge sources={c.sourceIds.length} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 6: LINKED PAGES */}
        <section className="mt-12">
          <h2 className="mb-4" style={{ fontSize: 18, fontWeight: 600, color: "var(--cx-text-primary)" }}>
            Linked Pages
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {page.links.map((slug) => {
              const lp = pages.find((p) => p.slug === slug);
              if (!lp) return null;
              return (
                <Link
                  key={slug}
                  to={`/${slug}`}
                  className="flex-shrink-0 p-3 rounded-md min-w-[200px]"
                  style={{ background: "var(--cx-bg-surface)", border: "1px solid var(--cx-border-subtle)" }}
                >
                  <div style={{ fontFamily: "var(--font-mono)", color: "var(--cx-accent)", fontSize: 13 }}>
                    [[{slug}]]
                  </div>
                  <div className="mt-1" style={{ color: "var(--cx-text-secondary)", fontSize: 12 }}>
                    {lp.claims.length} claims
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* SECTION 7: DISPUTES */}
        {page.disputes.length > 0 && (
          <section id="disputes" className="mt-12">
            <h2 className="mb-4" style={{ fontSize: 18, fontWeight: 600, color: "var(--cx-text-primary)" }}>
              Disputes
            </h2>
            <div className="space-y-3">
              {page.disputes.map((d) => (
                <div key={d.id} className="p-4 rounded-lg" style={{ background: "var(--cx-bg-surface)", border: "1px solid var(--cx-border-subtle)" }}>
                  <div className="flex items-center gap-3">
                    <TagPill tone="warning">{d.status === "open" ? "Open" : "Resolved"}</TagPill>
                    <span style={{ color: "var(--cx-text-secondary)", fontSize: 13 }}>
                      Raised by <MonoAddress value={d.raisedBy} className="text-[13px]" />
                    </span>
                  </div>
                  <div className="mt-3" style={{ fontSize: 13, color: "var(--cx-text-secondary)" }}>
                    Counter-source: <span style={{ fontFamily: "var(--font-mono)", color: "var(--cx-text-primary)" }}>{d.counterSource}</span>
                  </div>
                  <div className="mt-2" style={{ fontSize: 14, color: "var(--cx-text-secondary)", lineHeight: 1.6 }}>
                    {d.rationale}
                  </div>
                  <a href="#" className="inline-flex items-center gap-1 mt-3" style={{ color: "var(--cx-accent)", fontSize: 13 }}>
                    View counter-source <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 8: VERIFY PANEL */}
        <section className="mt-12">
          <div className="cx-gradient-border relative p-5 rounded-lg overflow-hidden" style={{
            background:
              "radial-gradient(ellipse 120% 60% at 0% 0%, rgba(91,108,240,0.10), transparent 50%), var(--cx-bg-surface)",
            border: "1px solid var(--cx-border-subtle)",
            boxShadow: "0 0 0 1px rgba(91,108,240,0.1), 0 20px 60px -20px rgba(91,108,240,0.25)",
          }}>
            <div className="absolute top-0 right-0 px-2 py-0.5" style={{
              fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--cx-cyan)", letterSpacing: "0.18em",
            }}>
              <span className="cx-flicker">◉ LIVE</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: "var(--cx-text-primary)", fontSize: 16, fontWeight: 600 }}>
              <ShieldCheck size={16} color="var(--cx-accent)" /> Verify Provenance
            </div>
            <p className="mt-2" style={{ color: "var(--cx-text-secondary)", fontSize: 14, lineHeight: 1.6 }}>
              Review the claims and sources on this page, then attest that provenance is verifiable on-chain.
            </p>
            {!walletConnected ? (
              <button
                onClick={() => setWalletConnected(true)}
                className="mt-4 rounded-md transition-colors"
                style={{
                  height: 40, padding: "0 16px", color: "#fff", fontSize: 14, fontWeight: 500,
                  background: "linear-gradient(135deg, var(--cx-accent), var(--cx-violet))",
                  boxShadow: "var(--cx-accent-glow)",
                }}
              >
                Connect Wallet
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="space-y-1" style={{ fontSize: 13, color: "var(--cx-text-secondary)" }}>
                  <div>✓ Sources registered on-chain</div>
                  <div>✓ Lint check passed</div>
                </div>
                <button
                  onClick={() => setAttested(true)}
                  disabled={attested}
                  className="rounded-md transition-colors disabled:opacity-60"
                  style={{
                    height: 40, padding: "0 16px", color: "#fff", fontSize: 14, fontWeight: 500,
                    background: attested
                      ? "linear-gradient(135deg, var(--cx-success), #15a47a)"
                      : "linear-gradient(135deg, var(--cx-accent), var(--cx-cyan))",
                    boxShadow: attested ? "0 0 16px rgba(52,211,153,0.4)" : "var(--cx-accent-glow)",
                  }}
                >
                  {attested ? "✓ Attestation submitted" : "Attest Provenance Verified"}
                </button>
                <div style={{ color: "var(--cx-text-tertiary)", fontSize: 12 }}>
                  Attestations: {attested ? 13 : 12} · <MonoAddress value="0xabc1234567890def" className="text-[12px]" /> attested 3 pages
                </div>
                {attested && (
                  <div style={{ color: "var(--cx-text-tertiary)", fontSize: 12 }}>
                    Tx digest: <MonoAddress value="0xdef9876543210abc1234" className="text-[12px]" />{" "}
                    <a href="#" style={{ color: "var(--cx-accent)" }}>View on Suiscan</a>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 9: VERSION HISTORY */}
        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2" style={{ fontSize: 18, fontWeight: 600, color: "var(--cx-text-primary)" }}>
            <GitBranch size={16} /> Version History
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <VersionSelect versions={page.versions} value={leftV} onChange={setLeftV} />
            <span style={{ color: "var(--cx-text-tertiary)" }}>vs</span>
            <VersionSelect versions={page.versions} value={rightV} onChange={setRightV} />
            <button
              onClick={() => setShowDiff(true)}
              className="rounded-md"
              style={{
                height: 32,
                padding: "0 12px",
                background: "transparent",
                border: "1px solid var(--cx-border-visible)",
                color: "var(--cx-text-secondary)",
                fontSize: 13,
              }}
            >
              Compare Versions
            </button>
          </div>

          {showDiff && (
            <div className="mt-4 rounded-lg overflow-hidden" style={{ border: "1px solid var(--cx-border-subtle)" }}>
              <div className="grid grid-cols-2" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>
                <DiffColumn lines={page.diff.left} />
                <div style={{ borderLeft: "1px solid var(--cx-border-subtle)" }}>
                  <DiffColumn lines={page.diff.right} />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SECTION 10: ALL VERSIONS */}
        <section className="mt-10">
          <h3 className="mb-3" style={{ fontSize: 16, fontWeight: 600, color: "var(--cx-text-primary)" }}>
            All Versions
          </h3>
          <ol className="space-y-2">
            {page.versions.map((v, i) => (
              <li key={v.blob} className="flex items-center gap-2" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--cx-text-secondary)" }}>
                <span style={{ color: "var(--cx-text-tertiary)" }}>{i + 1}.</span>
                <MonoAddress value={v.blob} className="text-[12px]" />
                {i === 0 && <TagPill>current</TagPill>}
              </li>
            ))}
          </ol>
        </section>

        {/* SECTION 11: METADATA FOOTER */}
        <section className="mt-12 p-5 rounded-lg" style={{ background: "var(--cx-bg-surface)", border: "1px solid var(--cx-border-subtle)" }}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6" style={{ fontSize: 13 }}>
            <Row label="Latest blob">
              <MonoAddress value={page.versions[0].blob} className="text-[13px]" />{" "}
              <a href="#" className="inline-flex items-center gap-1" style={{ color: "var(--cx-accent)" }}>
                [View on Walrus] <ExternalLink size={11} />
              </a>
            </Row>
            <Row label="Versions">{page.versions.length}</Row>
            <Row label="Sources cited">{page.sourceIds.length}</Row>
            <Row label="Updated by">
              <MonoAddress value={page.updatedBy} className="text-[13px]" />{" "}
              <a href="#" className="inline-flex items-center gap-1" style={{ color: "var(--cx-accent)" }}>
                [View on Suiscan] <ExternalLink size={11} />
              </a>
            </Row>
            <Row label="Updated at">{page.updatedAt}</Row>
          </dl>
        </section>
      </article>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt style={{ color: "var(--cx-text-tertiary)", fontSize: 12, letterSpacing: "0.02em", textTransform: "uppercase" }}>{label}</dt>
      <dd className="mt-0.5" style={{ color: "var(--cx-text-primary)" }}>{children}</dd>
    </div>
  );
}

function VersionSelect({
  versions,
  value,
  onChange,
}: {
  versions: { blob: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md outline-none"
      style={{
        background: "var(--cx-bg-elevated)",
        border: "1px solid var(--cx-border-subtle)",
        color: "var(--cx-text-primary)",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        padding: "6px 10px",
      }}
    >
      {versions.map((v, i) => (
        <option key={v.blob} value={v.blob} style={{ background: "#18181B" }}>
          v{versions.length - i}: {v.blob.slice(0, 8)}…
        </option>
      ))}
    </select>
  );
}

function DiffColumn({ lines }: { lines: DiffLine[] }) {
  return (
    <div>
      {lines.map((ln, i) => {
        const bg =
          ln.kind === "add" ? "rgba(52,211,153,0.12)" : ln.kind === "del" ? "rgba(239,68,68,0.12)" : "transparent";
        const color = ln.kind === "same" ? "var(--cx-text-secondary)" : "var(--cx-text-primary)";
        const prefix = ln.kind === "add" ? "+" : ln.kind === "del" ? "-" : " ";
        return (
          <div key={i} className="flex" style={{ background: bg }}>
            <span className="w-10 px-2 text-right" style={{ color: "var(--cx-text-tertiary)" }}>{i + 1}</span>
            <span className="w-4" style={{ color }}>{prefix}</span>
            <span className="flex-1 px-2 py-1" style={{ color }}>{ln.text}</span>
          </div>
        );
      })}
      {lines.length === 0 && (
        <div className="p-4 text-center" style={{ color: "var(--cx-text-tertiary)", fontSize: 12 }}>
          No diff available for this page.
        </div>
      )}
    </div>
  );
}
