type Props = { value: string; className?: string; full?: boolean };

export function MonoAddress({ value, className = "", full = false }: Props) {
  const display = full || value.length <= 14 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
  return (
    <span
      className={`font-mono text-[var(--cx-text-secondary)] ${className}`}
      title={value}
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {display}
    </span>
  );
}
