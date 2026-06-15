# Figma Make Prompt — Cortex Wiki Site

Copy seluruh konten di bawah ini ke Figma Make.

---

## Project Context

Cortex adalah decentralized knowledge base yang dipelihara AI agents — wiki publik di atas Walrus (storage) + Sui (coordination layer). Setiap halaman wiki adalah blob immutable; setiap klaim tertelusur ke sumber mentah (provenance). Fitur: dispute (sengketa transparan), confidence score, time travel diff, dan wallet-based provenance attestation.

**Target audience:** Tim riset kebijakan / unit layanan publik yang butuh knowledge base terverifikasi. Tone: serius, precise, terpercaya — bukan playful.

**Positioning:** "Verifiable provenance, not verifiable truth."

---

## Design System Tokens

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| bg-base | `#0A0A0C` | Page background (near-black, NOT `#000000`) |
| bg-surface | `#111114` | Cards, panels |
| bg-elevated | `#18181B` | Modals, dropdowns |
| border-subtle | `rgba(255,255,255,0.06)` | Card borders, dividers |
| border-visible | `rgba(255,255,255,0.10)` | Hover states, active cards |
| text-primary | `#ECECED` | Headings, body text (off-white, not pure white) |
| text-secondary | `#888893` | Meta info, descriptions |
| text-tertiary | `#5C5C66` | Timestamps, less important info |
| accent | `#5B6CF0` | Links, active states, primary buttons |
| accent-hover | `#7B8AF8` | Button hover, link hover |
| accent-muted | `rgba(91,108,240,0.12)` | Tag backgrounds, subtle highlights |
| success | `#34D399` | Confidence high, verified |
| warning | `#F59E0B` | Dispute open, confidence low |
| danger | `#EF4444` | Errors, broken links |

### Typography

| Token | Value |
|-------|-------|
| Font primary | Inter (headings + body) |
| Font mono | JetBrains Mono (addresses, blob IDs, code) |
| Scale | 12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 48px |
| Headings | Inter SemiBold 600, tracking -0.02em |
| Body | Inter Regular 400, line-height 1.7 |
| Labels | Inter Medium 500, tracking +0.02em |
| Mono text | JetBrains Mono Regular, 13px |

### Spacing

| Token | Value |
|-------|-------|
| Content reading width | 720px max |
| Page max-width | 1200px |
| Section gap | 48px |
| Card padding | 20px |
| Card gap | 16px |
| Border radius (cards) | 8px |
| Border radius (buttons) | 6px |
| Border radius (modals) | 12px |

### Elevation

- **Cards resting:** bg-surface + border-subtle, no shadow
- **Cards hover:** border-visible + subtle brightness (bg brightens 2%)
- **Nav:** backdrop-blur(12px) + bg rgba(10,10,12,0.8)
- **Modals:** bg rgba(0,0,0,0.6) overlay + backdrop-blur(4px)

---

## Screen 1: Home — Wiki Page List

**URL:** `/`
**Purpose:** First impression, daftar semua page, entry point navigasi.

### Layout

```
TOP: Sticky nav bar
  - Left: "CORTEX" wordmark (Inter Bold, 20px, accent color)
  - Right: [Pages] [Sources] [Graph] [Explorer] links (14px, text-secondary)
  - Bottom: subtle border divider

HEADER SECTION (centered, max-width 720px):
  - "Knowledge Base" heading (40px, SemiBold)
  - Subtitle: "26 pages · 3 sources · Updated 2 hours ago" (14px, text-secondary)
    with small circle icons between stats

SEARCH BAR (centered, max-width 720px):
  - Card container with bg-surface, border-subtle, radius 8px
  - Left: magnifying glass icon (text-tertiary)
  - Input: "Search pages..." placeholder (text-secondary, 14px)
  - Focus: border turns accent color

PAGE GRID (centered, max-width 1200px):
  - 2 columns on desktop, 1 column on mobile
  - Each card:
    - [[page_slug]] (JetBrains Mono, 16px, accent)
    - 5 claims · 3 sources (12px, text-secondary)
    - Updated 2 hours ago (12px, text-tertiary)
    - [pmi] [services] [regulations] (tag pills: accent-muted bg, 11px)
  - Card hover: border-visible, slight lift (scale 1.01)

FOOTER:
  - Package ID: 0x823f... (truncated, mono, text-tertiary, 11px)
  - "Cortex — Verifiable provenance on Walrus & Sui"
```

### Elements Detail

- **Nav:** Logo "CORTEX" kiri (Inter Bold, accent color). Nav links kanan: Pages (active), Sources, Graph, Explorer (external icon). Divider subtle di bawah nav.
- **Header:** "Knowledge Base" sebagai heading besar (32px, SemiBold). Subtitle stats di bawah (14px, secondary color, icon kecil): `26 pages · 3 sources · Last updated 2h ago`.
- **Search bar:** Full-width di dalam card surface. Placeholder "Search pages..." (text-secondary). Icon search di kiri. Border-subtle, focus ring accent color.
- **Page cards:** 2-column grid di desktop, 1-column di mobile. Setiap card punya:
  - Title: [[Page Slug]] dalam format monospace, linkable.
  - Meta line: "5 claims · 3 sources" (text-secondary, 12px).
  - Timestamp: "Updated 2h ago" (text-tertiary, 12px).
  - Tags: pill badges (background: accent-muted, text: accent, 12px).
  - Hover: border berubah ke visible, subtle scale.

---

## Screen 2: Page Detail

**URL:** `/[slug]`
**Purpose:** Halaman wiki individual dengan full content, provenance trail, dispute badges, confidence scores, version history.

### Layout (max-width 720px content column)

#### SECTION 1 — PAGE HEADER

- Back to Index link (14px, text-secondary, accent on hover)
- Title: "[Prosedur Pelindungan PMI]" (32px, SemiBold)
- Slug badge: [[Prosedur_Pelindungan_PMI]] (mono, 13px, text-tertiary bg)
- Tags row: [pmi] [prosedur] [perlindungan] pills

#### SECTION 2 — DISPUTE BANNER (conditional)

- Warning-colored left border (2px solid `#F59E0B`)
- bg: rgba(245,158,11,0.08)
- Content: "1 open dispute against claims on this page"
- Button: "View dispute" (text-warning, 13px)

#### SECTION 3 — PAGE BODY

Wiki markdown content rendered:

- H2 headings: Inter SemiBold 20px, mt-48px, mb-16px
- Paragraphs: 16px, line-height 1.7, text-primary, max-width 680px
- Inline provenance markers: `^[blob:abc123...]` rendered as small superscript link badges (mono 11px, accent-muted bg, "Source" label)
- Wikilinks: [[Target Page]] rendered as inline links (accent, underline on hover)
- Bold claims: key factual statements styled with subtle left border accent

#### SECTION 4 — PROVENANCE TRAIL (for each claim)

Small breadcrumb-style component:

```
Claim: "PMI berhak mendapat perlindungan hukum..."
├─ Page blob ← 0xabc123... (mono 12px, collapsed)
└─ Raw source ← Undang-Undang No.18 Tahun 2017 (link to source)
   [View raw source]

Sources: 2  ●●  High confidence (confidence badge)
```

#### SECTION 5 — CONFIDENCE BADGES

Per-claim display:

- 1 source: yellow badge "Low" (warning bg, 12px)
- 2+ sources: green badge "High" (success bg, 12px)
- Label: "Confidence score: number of independent sources, not truth claim"

#### SECTION 6 — LINKED PAGES

- Heading: "Linked Pages" (18px, SemiBold)
- Horizontal scrollable row of linked page cards (compact):
  - [[Page1]] / 4 claims
  - [[Page2]] / 6 claims
  - [[Page3]] / 3 claims

#### SECTION 7 — DISPUTES (conditional)

- Heading: "Disputes" (18px, SemiBold)
- Each dispute card:
  - Status badge: "Open" (warning)
  - Raised by: 0x5012...67a (mono 13px, truncated)
  - Counter-source: Dokumen_BP2MI_2025.pdf
  - Rationale: "Klaim tentang prosedur tidak sesuai..." (14px, text-secondary)
  - [View counter-source] link

#### SECTION 8 — VERIFY PANEL (Provenance Attestation)

Card with subtle accent left border:

```
│ Verify Provenance
│
│ Review the claims and sources on this page.
│ [Connect Wallet] button (accent)
│
│ After wallet connected:
│ ✓ Sources registered on-chain
│ ✓ Lint check passed
│ [Attest Provenance Verified] button (primary CTA)
│
│ "Attestations: 12 · 0xabc... attested 3 pages"
│ Tx digest: 0xdef... [View on Suiscan]
```

#### SECTION 9 — VERSION HISTORY (Time Travel)

- Heading: "Version History" (18px, SemiBold)
- Two dropdown selects side by side:
  - [v3: 0xabc...] vs [v1: 0x789...]
  - [Compare Versions] button (outlined, subtle)

- Diff view (below button):
  - Unchanged lines (gray, no background)
  - Deleted lines (red background)
  - Added lines (green background)
  - Line numbers on both sides

#### SECTION 10 — ALL VERSIONS LIST

- Heading: "All Versions" (16px, SemiBold)
- Ordered list (mono 12px, text-secondary):
  - 1. 0xabc123def... (current) — accent badge
  - 2. 0x789012abc...
  - 3. 0x345678def...

#### SECTION 11 — METADATA FOOTER

Card with bg-surface:

```
Latest blob: 0xabc...    [View on Walrus]
Versions: 3
Sources cited: 2
Updated by: 0x6034...89a  [View on Suiscan]
Updated at: 2026-06-15 14:30 UTC
```

---

## Screen 3: Graph View

**URL:** `/graph`
**Purpose:** Visualisasi network semua halaman wiki dan wikilink antar halaman (ala Obsidian graph view).

### Layout

Full viewport (no content column constraint):

```
┌─────────────────────────────────────────────────────┐
│ [CORTEX]                    Pages  Sources  Graph  │
├─────────────────────────────────────────────────────┤
│                                                     │
│            ●                                        │
│          /   \                                      │
│         ●─────●                                     │
│        / \   / \                                    │
│       ●   ●─●   ●                                   │
│        \ /                                          │
│         ●                                           │
│                                                     │
│     [Legend: ● Page  ● Disputed Page  — Link]      │
│     [Click a node to open page]                     │
│                                                     │
│     Top-right: [Search node...] mini search         │
│     Zoom: scroll | Pan: drag | Click: navigate      │
└─────────────────────────────────────────────────────┘
```

### Interaction Notes

- **Force-directed layout** (physics simulation): nodes repel, edges attract
- **Node size:** Proportional to number of claims on the page (radius 8px–24px)
- **Node color:** Default accent color; warning color if page has open dispute
- **Node label:** Page slug in mono 10px, appears on hover
- **Edge:** Thin line (1px, border-subtle), subtle curve
- **Click action:** Navigate to page detail `/slug`
- **Zoom/Pan:** Scroll to zoom, drag to pan, double-click to fit all
- **Search:** Type to highlight/filter nodes in real-time
- **Controls:** Legend overlay bottom-left (small text, low opacity)

---

## Global Components

### Navigation Bar (persistent across all pages)

- Sticky top, z-50
- Height: 56px
- Left: Logo wordmark
- Right: 4 links (Pages, Sources, Graph, Explorer)
- Active link: accent color + subtle bottom indicator (2px accent line)
- Inactive: text-secondary, accent on hover
- Background: backdrop-blur(12px) + bg rgba(10,10,12,0.85)
- Bottom edge: 1px border-subtle

### Tag/Badge System

- **Page tags:** pill shape, accent-muted bg, accent text, 11px, radius 12px
- **Status badges:**
  - "Open Dispute": warning bg + text, 12px
  - "Verified": success bg, 12px
  - "Current Version": accent bg, 12px
- **Confidence badges:**
  - "High": success bg, pill
  - "Low": warning bg, pill

### Buttons

- **Primary (accent):** bg accent, text white, radius 6px, height 40px, padding 16px horizontal
- **Secondary (outlined):** bg transparent, border-visible, text-secondary, same sizing
- **Ghost:** no bg, no border, text-secondary, accent on hover
- **Small:** height 32px, 12px font
- **Hover states:** Primary: accent-hover. Secondary: bg surface. Ghost: text accent.
- **Focus ring:** 2px accent ring, offset 2px

### Links

- **Internal (accent):** accent color, no underline default, underline on hover
- **External:** accent color + external icon, subtle
- **Blob ID/Address:** mono font, text-secondary, truncated with "..." (first 6 + last 4 chars)

### Empty States

- Icon at top (24px, text-tertiary)
- Message: "No pages yet" (16px, text-secondary)
- Sub-message: "Run cortex ingest to build the knowledge base." (14px, text-tertiary)

---

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| >= 1024px | Full desktop: 2-col card grid, full nav, reading column for content |
| 768–1023px | Tablet: 1-col cards, nav links compact, content full-width |
| < 768px | Mobile: stacked layout, nav hamburger, content edge-to-edge with 16px padding |

---

## Design Principles (non-negotiable)

1. **Single accent color** — hanya `#5B6CF0` untuk semua interactive elements. Tidak ada warna aksen kedua.
2. **No pure black** — background terdalam adalah `#0A0A0C`, bukan `#000000`.
3. **Content in cards** — tidak ada konten yang mengambang di background tanpa container.
4. **Typography restraint** — max 3 font weight, max 5 font size per halaman.
5. **Motion is functional** — animasi hanya untuk state transitions (hover, focus, mount), tidak dekoratif.
6. **"Verifiable provenance, not verifiable truth"** — copy di UI harus mencerminkan ini. Tidak ada label "Verified True" atau "Proven Correct".
7. **Dark-first** — desain untuk dark mode. Tidak perlu light mode.
