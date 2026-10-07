import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Login and session redirects must never be replayed from a PWA cache.
        urlPattern: ({ sameOrigin, url }) => sameOrigin && (
          url.pathname === '/' || /^\/(auth|login|join|setup|admin|stats|calendar|api)(\/|$)/.test(url.pathname)
        ),
        handler: 'NetworkOnly',
        method: 'GET',
      },
      {
        urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/auth/'),
        handler: 'NetworkOnly',
        method: 'GET',
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'output: export' 제거 - Supabase 미들웨어/서버 라우트(auth/callback) 필요
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/auth/:path*',
        headers: [{ key: 'Cache-Control', value: 'private, no-store' }],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
