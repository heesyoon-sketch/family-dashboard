type FamBitMarkProps = {
  size?: number;
  className?: string;
};

type FamBitWordmarkProps = {
  compact?: boolean;
  markSize?: number;
  className?: string;
  textClassName?: string;
  showText?: boolean;
};

export function FamBitMark({ size = 44, className }: FamBitMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      aria-hidden="true"
      className={className ?? 'shrink-0'}
    >
      <rect width="80" height="80" rx="22" fill="#1A1B2E" />
      <rect x="18" y="19" width="44" height="11" rx="5.5" fill="#5B8EFF" />
      <rect x="18" y="35" width="32" height="11" rx="5.5" fill="#FF7BAC" />
      <rect x="18" y="51" width="18" height="11" rx="5.5" fill="#4EEDB0" />
    </svg>
  );
}

export function FamBitWordmark({
  compact = false,
  markSize,
  className,
  textClassName,
  showText = true,
}: FamBitWordmarkProps) {
  const resolvedMarkSize = markSize ?? (compact ? 34 : 46);
  const resolvedTextClassName = textClassName ?? (compact
    ? 'text-xl font-black text-white'
    : 'text-3xl font-black text-white');

  return (
    <div className={className ?? 'flex items-center gap-2.5'}>
      <FamBitMark size={resolvedMarkSize} />
      {showText && (
        <span className={resolvedTextClassName}>
          Fam<span className="text-[#4EEDB0]">Bit</span>
        </span>
      )}
    </div>
  );
}
