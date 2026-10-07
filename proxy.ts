import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { LEGACY_SITE_HOSTS, SITE_ORIGIN, safeReturnPath } from '@/lib/site';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (LEGACY_SITE_HOSTS.has(request.nextUrl.hostname)) {
    const url = new URL(`${pathname}${request.nextUrl.search}`, SITE_ORIGIN);
    return NextResponse.redirect(url, 308);
  }

  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/home') ||
    pathname.startsWith('/privacy')
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT server-side (safe against forged cookies)
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(pathname === '/' ? '/home' : '/login', request.url);
    const next = safeReturnPath(`${pathname}${request.nextUrl.search}`);
    if (pathname !== '/' && next !== '/') url.searchParams.set('next', next);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|manifest\\.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)).*)',
  ],
};
