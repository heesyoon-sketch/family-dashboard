export function CrossIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18" />
      <path d="M7 8h10" />
    </svg>
  );
}

export function ToothbrushIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="10" height="4" rx="1.5" />
      <line x1="5" y1="11" x2="5" y2="8" />
      <line x1="8" y1="11" x2="8" y2="7" />
      <line x1="11" y1="11" x2="11" y2="8" />
      <line x1="13" y1="13" x2="21" y2="13" />
    </svg>
  );
}

export const CUSTOM_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  cross: CrossIcon,
  sparkles: ToothbrushIcon,
};
