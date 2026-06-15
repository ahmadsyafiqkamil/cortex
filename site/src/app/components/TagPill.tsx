type Props = { children: React.ReactNode; tone?: "accent" | "success" | "warning" | "danger" };

const toneStyles: Record<string, { bg: string; color: string }> = {
  accent: { bg: "var(--cx-accent-muted)", color: "var(--cx-accent-hover)" },
  success: { bg: "rgba(52,211,153,0.12)", color: "var(--cx-success)" },
  warning: { bg: "rgba(245,158,11,0.12)", color: "var(--cx-warning)" },
  danger: { bg: "rgba(239,68,68,0.12)", color: "var(--cx-danger)" },
};

export function TagPill({ children, tone = "accent" }: Props) {
  const s = toneStyles[tone];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full"
      style={{
        background: s.bg,
        color: s.color,
        fontSize: "11px",
        letterSpacing: "0.02em",
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}
