'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase';

const DEFAULT_MEMBERS = [
  { name: '아빠', role: 'PARENT' as const, theme: 'dark_minimal' as const },
  { name: '엄마', role: 'PARENT' as const, theme: 'warm_minimal' as const },
  { name: '첫째', role: 'CHILD' as const,  theme: 'robot_neon'   as const },
  { name: '둘째', role: 'CHILD' as const,  theme: 'pastel_cute'  as const },
];

export default function SetupPage() {
  const router = useRouter();
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading]       = useState(false);
  const [checking, setChecking]     = useState(true);
  const [errorMsg, setErrorMsg]     = useState('');

  // If the user already has a family, send them straight to the dashboard.
  useEffect(() => {
    const check = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: family } = await supabase
        .from('families')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (family) { router.replace('/'); return; }
      setChecking(false);
    };
    check();
  }, [router]);

  const handleSetup = async () => {
    const trimmed = familyName.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createBrowserSupabase();

      // Atomically create the family and migrate any pre-existing NULL-family data
      const { data: familyId, error: rpcErr } = await supabase
        .rpc('setup_family', { p_name: trimmed });
      if (rpcErr || !familyId) throw rpcErr ?? new Error('setup_family returned null');

      // Seed 4 default family members only if none exist yet (new tenants)
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('family_id', familyId)
        .limit(1);

      if (!existing?.length) {
        const { error: seedErr } = await supabase.from('users').insert(
          DEFAULT_MEMBERS.map(m => ({
            id:         crypto.randomUUID(),
            name:       m.name,
            role:       m.role,
            theme:      m.theme,
            family_id:  familyId,
            created_at: new Date().toISOString(),
          }))
        );
        if (seedErr) throw seedErr;
      }

      router.replace('/');
    } catch (e) {
      console.error(e);
      setErrorMsg('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
  };

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#0b0d12' }} />;
  }

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
        maxWidth: 400,
        textAlign: 'center',
        border: '1px solid #232831',
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
        <h1 style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, margin: '0 0 8px' }}>
          패밀리 대시보드 만들기
        </h1>
        <p style={{ color: '#8a8f99', fontSize: 14, margin: '0 0 32px', lineHeight: 1.6 }}>
          가족 이름을 입력하면 바로 시작할 수 있어요.<br />
          구성원 이름과 할 일은 나중에 관리자 페이지에서 설정할 수 있습니다.
        </p>

        <input
          type="text"
          value={familyName}
          onChange={e => setFamilyName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSetup()}
          placeholder="예: 김씨 가족, 우리 가족…"
          autoFocus
          maxLength={40}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '14px 16px',
            borderRadius: 14,
            background: '#232831',
            color: '#ffffff',
            fontSize: 16,
            border: '2px solid #232831',
            outline: 'none',
            marginBottom: errorMsg ? 8 : 16,
            transition: 'border-color 0.2s',
          }}
          onFocus={e  => { e.target.style.borderColor = '#4f9cff'; }}
          onBlur={e   => { e.target.style.borderColor = '#232831'; }}
        />

        {errorMsg && (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>
        )}

        <button
          onClick={handleSetup}
          disabled={!familyName.trim() || loading}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: 14,
            background: familyName.trim() && !loading ? '#4f9cff' : '#232831',
            color:  familyName.trim() && !loading ? '#ffffff' : '#8a8f99',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: familyName.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          {loading ? '생성 중…' : '대시보드 시작하기 →'}
        </button>
      </div>
    </main>
  );
}
