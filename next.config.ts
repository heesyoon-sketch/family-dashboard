import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 'output: export' 제거 — Supabase 미들웨어/서버 라우트(auth/callback) 필요
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
