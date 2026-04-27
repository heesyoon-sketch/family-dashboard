import { createBrowserClient } from '@supabase/ssr';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// 클라이언트 컴포넌트용 (쿠키 기반 세션 유지)
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  );
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function assertUuid(value: string, label = 'id'): string {
  if (!isUuid(value)) {
    throw new Error(`${label} must be a valid UUID`);
  }

  return value;
}
