export const SITE_ORIGIN = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || 'https://fambit.vercel.app',
).origin;

export const LEGACY_SITE_HOSTS = new Set(['family-dashboard-puce-psi.vercel.app']);

/** Only return to app pages, never an external URL or another auth redirect. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]|%2f|%5c/i.test(value)) return '/';
  const url = new URL(value, SITE_ORIGIN);
  const pages = ['/', '/admin', '/stats', '/calendar', '/join', '/setup', '/setup/set-pin', '/setup/welcome'];
  if (url.origin !== SITE_ORIGIN || !pages.includes(url.pathname)) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function authCallbackUrl(origin: string, next: string | null | undefined): string {
  const url = new URL('/auth/callback', origin);
  const path = safeReturnPath(next);
  if (path !== '/') url.searchParams.set('next', path);
  return url.toString();
}
