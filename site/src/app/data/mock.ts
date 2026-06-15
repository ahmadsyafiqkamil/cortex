export type Source = {
  id: string;
  title: string;
  blob: string;
  url?: string;
};

export type Claim = {
  text: string;
  sourceIds: string[];
  pageBlob: string;
};

export type DiffLine = { kind: "same" | "add" | "del"; text: string };

export type Version = {
  blob: string;
  updatedAt: string;
  updatedBy: string;
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
  summary: string;
  tags: string[];
  claims: Claim[];
  sourceIds: string[];
  links: string[]; // slugs
  disputes: Dispute[];
  versions: Version[];
  updatedAt: string;
  updatedBy: string;
  body: { heading?: string; paragraphs: { text: string; sourceIds: string[]; bold?: boolean }[] }[];
  diff: { left: DiffLine[]; right: DiffLine[] };
  // graph position (0..1)
  pos: { x: number; y: number };
};

export const sources: Source[] = [
  {
    id: "s1",
    title: "Undang-Undang No.18 Tahun 2017 tentang Pelindungan PMI",
    blob: "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
    url: "#",
  },
  {
    id: "s2",
    title: "Peraturan BP2MI No.9 Tahun 2020",
    blob: "0x789012abc3456789012abc3456789012abc3456789012abc3456789012abc34",
    url: "#",
  },
  {
    id: "s3",
    title: "Dokumen_BP2MI_2025.pdf",
    blob: "0x345678def9012345678def9012345678def9012345678def9012345678def90",
    url: "#",
  },
];

const baseVersions = (seed: string): Version[] => [
  { blob: `0x${seed}abc123def456789012345678901234567890123456789012345678901234`, updatedAt: "2026-06-15 14:30 UTC", updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a" },
  { blob: `0x${seed}789012abc345678901234567890123456789012345678901234567890abcd`, updatedAt: "2026-05-02 09:12 UTC", updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a" },
  { blob: `0x${seed}345678def901234567890123456789012345678901234567890123456789ef`, updatedAt: "2026-03-21 18:44 UTC", updatedBy: "0x501234567890abcdef1234567890abcdef1234567890abcdef123456789067a" },
];

export const pages: Page[] = [
  {
    slug: "prosedur-pelindungan-pmi",
    title: "Prosedur Pelindungan PMI",
    summary: "Mekanisme perlindungan hukum bagi Pekerja Migran Indonesia.",
    tags: ["pmi", "prosedur", "perlindungan"],
    sourceIds: ["s1", "s2"],
    links: ["hak-pmi", "bp2mi-layanan", "regulasi-penempatan"],
    disputes: [
      {
        id: "d1",
        status: "open",
        raisedBy: "0x501234567890abcdef1234567890abcdef1234567890abcdef123456789067a",
        counterSource: "Dokumen_BP2MI_2025.pdf",
        rationale:
          "Klaim tentang prosedur tidak sesuai dengan revisi BP2MI 2025 yang menambahkan tahap pre-departure orientation.",
      },
    ],
    versions: baseVersions("a"),
    updatedAt: "2026-06-15 14:30 UTC",
    updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a",
    claims: [
      {
        text: "PMI berhak mendapat perlindungan hukum sebelum, selama, dan setelah bekerja.",
        sourceIds: ["s1", "s2"],
        pageBlob: "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
      },
      {
        text: "Perlindungan diselenggarakan oleh Pemerintah Pusat, Daerah, dan Perwakilan RI.",
        sourceIds: ["s1"],
        pageBlob: "0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890",
      },
    ],
    body: [
      {
        heading: "Ringkasan",
        paragraphs: [
          {
            text: "Pelindungan Pekerja Migran Indonesia (PMI) mencakup pelindungan sebelum bekerja, selama bekerja, dan setelah bekerja, sebagaimana diatur dalam Undang-Undang No.18 Tahun 2017.",
            sourceIds: ["s1"],
            bold: true,
          },
          {
            text: "Penyelenggaraan pelindungan dilakukan secara terkoordinasi antara Pemerintah Pusat, Pemerintah Daerah, dan Perwakilan Republik Indonesia di luar negeri.",
            sourceIds: ["s1", "s2"],
          },
        ],
      },
      {
        heading: "Tahapan",
        paragraphs: [
          {
            text: "Tahap pra-penempatan meliputi pendaftaran, seleksi, orientasi pra-keberangkatan, dan pemeriksaan kesehatan calon PMI.",
            sourceIds: ["s2"],
          },
          {
            text: "Tahap penempatan mencakup pemantauan kondisi kerja melalui Perwakilan RI dan mekanisme pengaduan terpusat.",
            sourceIds: ["s2"],
          },
        ],
      },
    ],
    diff: {
      left: [
        { kind: "same", text: "Pelindungan PMI mencakup pra, selama, dan purna." },
        { kind: "del", text: "Pendaftaran dilakukan melalui kantor cabang." },
        { kind: "same", text: "Pemerintah Pusat menyelenggarakan koordinasi." },
        { kind: "del", text: "Tidak ada orientasi pra-keberangkatan wajib." },
        { kind: "same", text: "Perwakilan RI memantau kondisi kerja." },
      ],
      right: [
        { kind: "same", text: "Pelindungan PMI mencakup pra, selama, dan purna." },
        { kind: "add", text: "Pendaftaran wajib melalui SISKOP2MI online." },
        { kind: "same", text: "Pemerintah Pusat menyelenggarakan koordinasi." },
        { kind: "add", text: "Orientasi pra-keberangkatan wajib minimal 3 hari." },
        { kind: "same", text: "Perwakilan RI memantau kondisi kerja." },
      ],
    },
    pos: { x: 0.5, y: 0.45 },
  },
  {
    slug: "hak-pmi",
    title: "Hak Pekerja Migran Indonesia",
    summary: "Daftar hak dasar PMI menurut UU 18/2017.",
    tags: ["pmi", "hak"],
    sourceIds: ["s1"],
    links: ["prosedur-pelindungan-pmi", "bp2mi-layanan"],
    disputes: [],
    versions: baseVersions("b"),
    updatedAt: "2026-06-12 10:05 UTC",
    updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a",
    claims: [
      { text: "PMI berhak atas informasi pekerjaan yang benar dan akurat.", sourceIds: ["s1"], pageBlob: "0xb01" },
    ],
    body: [
      {
        heading: "Hak Dasar",
        paragraphs: [
          { text: "Setiap PMI berhak atas informasi yang benar mengenai pasar kerja, tata cara penempatan, dan kondisi kerja di luar negeri.", sourceIds: ["s1"], bold: true },
        ],
      },
    ],
    diff: { left: [], right: [] },
    pos: { x: 0.25, y: 0.3 },
  },
  {
    slug: "bp2mi-layanan",
    title: "Layanan BP2MI",
    summary: "Layanan publik yang disediakan BP2MI bagi PMI.",
    tags: ["bp2mi", "services"],
    sourceIds: ["s2", "s3"],
    links: ["prosedur-pelindungan-pmi", "regulasi-penempatan"],
    disputes: [],
    versions: baseVersions("c"),
    updatedAt: "2026-06-10 08:00 UTC",
    updatedBy: "0x501234567890abcdef1234567890abcdef1234567890abcdef123456789067a",
    claims: [
      { text: "BP2MI menyediakan layanan crisis center 24 jam.", sourceIds: ["s2", "s3"], pageBlob: "0xc01" },
    ],
    body: [
      {
        paragraphs: [
          { text: "BP2MI menyediakan layanan crisis center, fasilitasi pemulangan, dan bantuan hukum bagi PMI bermasalah.", sourceIds: ["s2", "s3"] },
        ],
      },
    ],
    diff: { left: [], right: [] },
    pos: { x: 0.7, y: 0.25 },
  },
  {
    slug: "regulasi-penempatan",
    title: "Regulasi Penempatan",
    summary: "Kerangka regulasi penempatan PMI.",
    tags: ["regulations", "penempatan"],
    sourceIds: ["s1", "s2"],
    links: ["prosedur-pelindungan-pmi", "bp2mi-layanan"],
    disputes: [],
    versions: baseVersions("d"),
    updatedAt: "2026-06-08 14:22 UTC",
    updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a",
    claims: [
      { text: "Penempatan PMI wajib melalui P3MI berbadan hukum.", sourceIds: ["s1"], pageBlob: "0xd01" },
    ],
    body: [
      {
        paragraphs: [
          { text: "Penempatan Pekerja Migran Indonesia hanya dapat dilakukan oleh P3MI yang telah memiliki SIP3MI yang sah.", sourceIds: ["s1"], bold: true },
        ],
      },
    ],
    diff: { left: [], right: [] },
    pos: { x: 0.78, y: 0.62 },
  },
  {
    slug: "crisis-center",
    title: "Crisis Center PMI",
    summary: "Mekanisme respon darurat bagi PMI di luar negeri.",
    tags: ["services", "darurat"],
    sourceIds: ["s3"],
    links: ["bp2mi-layanan"],
    disputes: [],
    versions: baseVersions("e"),
    updatedAt: "2026-06-05 21:10 UTC",
    updatedBy: "0x501234567890abcdef1234567890abcdef1234567890abcdef123456789067a",
    claims: [{ text: "Crisis center beroperasi 24/7.", sourceIds: ["s3"], pageBlob: "0xe01" }],
    body: [{ paragraphs: [{ text: "Crisis center BP2MI dapat dihubungi 24 jam melalui hotline nasional.", sourceIds: ["s3"] }] }],
    diff: { left: [], right: [] },
    pos: { x: 0.62, y: 0.78 },
  },
  {
    slug: "pemulangan-pmi",
    title: "Pemulangan PMI",
    summary: "Prosedur pemulangan PMI bermasalah dari negara penempatan.",
    tags: ["pmi", "pemulangan"],
    sourceIds: ["s2"],
    links: ["bp2mi-layanan", "crisis-center"],
    disputes: [],
    versions: baseVersions("f"),
    updatedAt: "2026-06-03 11:33 UTC",
    updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a",
    claims: [{ text: "Pemulangan difasilitasi oleh Perwakilan RI.", sourceIds: ["s2"], pageBlob: "0xf01" }],
    body: [{ paragraphs: [{ text: "Pemulangan PMI bermasalah difasilitasi oleh Perwakilan Republik Indonesia bekerja sama dengan BP2MI.", sourceIds: ["s2"] }] }],
    diff: { left: [], right: [] },
    pos: { x: 0.4, y: 0.75 },
  },
  {
    slug: "siskop2mi",
    title: "SISKOP2MI",
    summary: "Sistem Komputerisasi Pelindungan Pekerja Migran Indonesia.",
    tags: ["sistem", "pmi"],
    sourceIds: ["s2"],
    links: ["prosedur-pelindungan-pmi", "regulasi-penempatan"],
    disputes: [],
    versions: baseVersions("g"),
    updatedAt: "2026-05-29 16:00 UTC",
    updatedBy: "0x501234567890abcdef1234567890abcdef1234567890abcdef123456789067a",
    claims: [{ text: "SISKOP2MI mengintegrasikan data pra-penempatan.", sourceIds: ["s2"], pageBlob: "0x10" }],
    body: [{ paragraphs: [{ text: "SISKOP2MI adalah sistem terintegrasi untuk pendaftaran, seleksi, dan pemantauan PMI.", sourceIds: ["s2"], bold: true }] }],
    diff: { left: [], right: [] },
    pos: { x: 0.15, y: 0.6 },
  },
  {
    slug: "perwakilan-ri",
    title: "Peran Perwakilan RI",
    summary: "Fungsi Perwakilan RI dalam pelindungan PMI.",
    tags: ["pelindungan", "luar-negeri"],
    sourceIds: ["s1"],
    links: ["prosedur-pelindungan-pmi", "pemulangan-pmi"],
    disputes: [],
    versions: baseVersions("h"),
    updatedAt: "2026-05-25 09:48 UTC",
    updatedBy: "0x6034567890abcdef1234567890abcdef1234567890abcdef1234567890ab89a",
    claims: [{ text: "Perwakilan RI memantau kondisi kerja PMI.", sourceIds: ["s1"], pageBlob: "0x11" }],
    body: [{ paragraphs: [{ text: "Perwakilan RI di negara penempatan memiliki kewajiban memantau dan memberikan bantuan kepada PMI.", sourceIds: ["s1"] }] }],
    diff: { left: [], right: [] },
    pos: { x: 0.4, y: 0.18 },
  },
];

export const pageBySlug = (slug: string) => pages.find((p) => p.slug === slug);
export const sourceById = (id: string) => sources.find((s) => s.id === id);
