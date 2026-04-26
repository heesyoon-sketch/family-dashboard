import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    await supabase.auth.exchangeCodeForSession(code);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Sync Google profile photo to the linked family profile
      const googleAvatar = user.user_metadata?.avatar_url as string | undefined;
      if (googleAvatar) {
        await supabase
          .from('users')
          .update({ avatar_url: googleAvatar, login_method: 'google' })
          .eq('auth_user_id', user.id);
      }

      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (!familyId) {
        return NextResponse.redirect(`${origin}/setup`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
