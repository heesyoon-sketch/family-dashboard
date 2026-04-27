import Image from 'next/image';

interface AuthProfileAvatarProps {
  avatarUrl?: string | null;
  email?: string | null;
  size?: 28 | 32;
}

export function AuthProfileAvatar({ avatarUrl, email, size = 32 }: AuthProfileAvatarProps) {
  const dimensionClass = size === 28 ? 'h-7 w-7' : 'h-8 w-8';
  const label = email ? `Google account: ${email}` : 'Google account';
  const initial = email?.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <div
      className={`${dimensionClass} shrink-0 overflow-hidden rounded-full border border-white/25 bg-white/10 text-[11px] font-semibold text-white/80 shadow-[0_0_0_1px_rgba(0,0,0,0.2)]`}
      title={email ?? undefined}
      aria-label={label}
    >
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={label}
          width={size}
          height={size}
          referrerPolicy="no-referrer"
          className={`${dimensionClass} object-cover`}
        />
      ) : (
        <div className={`${dimensionClass} flex items-center justify-center`}>
          {initial}
        </div>
      )}
    </div>
  );
}
