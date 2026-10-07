import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { safeReturnPath } from '@/lib/site';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeReturnPath(searchParams.get('next'));
  const response = NextResponse.redirect(new URL(next, origin));
  response.headers.set('Cache-Control', 'private, no-store');

  const fail = (reason: string) => {
    const url = new URL('/login', origin);
    url.searchParams.set('error', reason);
    if (next !== '/') url.searchParams.set('next', next);
    response.headers.set('Location', url.toString());
    return response;
  };

  if (searchParams.has('error')) return fail('oauth_denied');
  if (!code) return fail('missing_code');

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) return fail('session_exchange_failed');

    const { data: familyId, error: familyError } = await supabase.rpc('get_my_family_id');
    if (familyError) return fail('family_lookup_failed');
    if (!familyId) {
      response.headers.set('Location', new URL('/setup', origin).toString());
    }
    return response;
  } catch {
    return fail('session_exchange_failed');
  }
}
