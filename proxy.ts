import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_EMAIL = process.env.NEXT_PUBLIC_ALLOWED_EMAIL;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 정적 리소스 및 /login, /auth/* 는 통과
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/')
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

  const { data: { user } } = await supabase.auth.getUser();

  // 미로그인 → /login 리다이렉트
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 허용된 이메일이 아님 → /login?error=unauthorized
  if (ALLOWED_EMAIL && user.email !== ALLOWED_EMAIL) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav)).*)',
  ],
};
