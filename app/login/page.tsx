'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

function LoginContent() {
  const searchParams = useSearchParams();
  const deleted = searchParams.get('deleted') === '1';

  const handleGoogleLogin = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0b0d12',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#141821',
        borderRadius: 28,
        padding: '48px 36px',
        width: '100%',
        maxWidth: 360,
        textAlign: 'center',
        border: '1px solid #232831',
      }}>
        {/* 타이틀 */}
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏠</div>
        <h1 style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>
          Family Habit Dashboard
        </h1>
        <p style={{ color: '#8a8f99', fontSize: 14, margin: '0 0 36px' }}>
          Google 계정으로 나만의 가족 대시보드를 시작하세요
        </p>

        {deleted && (
          <div style={{
            background: 'rgba(61, 220, 151, 0.12)',
            border: '1px solid rgba(61, 220, 151, 0.35)',
            color: '#3ddc97',
            borderRadius: 14,
            padding: '12px 14px',
            fontSize: 13,
            lineHeight: 1.5,
            marginBottom: 18,
          }}>
            가족 데이터가 영구 삭제되었습니다. / All family data has been permanently deleted.
          </div>
        )}

        {/* 구글 로그인 버튼 */}
        <button
          onClick={handleGoogleLogin}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 14,
            background: '#ffffff',
            color: '#1a1a1a',
            fontSize: 15,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google로 로그인
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
