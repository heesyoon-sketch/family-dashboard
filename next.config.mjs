import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'output: export' 제거 - Supabase 미들웨어/서버 라우트(auth/callback) 필요
  images: {
    unoptimized: true,
  },
};

export default withPWA(nextConfig);
