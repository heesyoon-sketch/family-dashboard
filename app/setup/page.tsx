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
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading]       = useState(false);
  const [checking, setChecking]     = useState(true);
  const [errorMsg, setErrorMsg]     = useState('');

  // If the user already has a family, send them straight to the dashboard.
  useEffect(() => {
    const check = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (familyId) { router.replace('/'); return; }
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

  const handleJoin = async () => {
    const trimmed = inviteCode.trim().toUpperCase();
    if (!trimmed || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const metadata = user.user_metadata as Record<string, unknown>;
      const displayName =
        (typeof metadata.full_name === 'string' && metadata.full_name) ||
        (typeof metadata.name === 'string' && metadata.name) ||
        user.email ||
        'Family Member';

      const { data: familyId, error: rpcErr } = await supabase.rpc('join_family_by_invite', {
        p_invite_code: trimmed,
        p_user_name: displayName,
      });
      if (rpcErr || !familyId) throw rpcErr ?? new Error('join_family_by_invite returned null');

      router.replace('/');
    } catch (e) {
      console.error(e);
      setErrorMsg('초대 코드를 확인할 수 없습니다. 코드를 다시 확인해주세요.');
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
        <p style={{ color: '#8a8f99', fontSize: 14, margin: '0 0 24px', lineHeight: 1.6 }}>
          새 가족 대시보드를 만들거나<br />
          받은 초대 코드로 기존 가족에 참여하세요.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => { setMode('create'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: mode === 'create' ? '#4f9cff' : '#232831',
              color: mode === 'create' ? '#ffffff' : '#8a8f99',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            새 가족 만들기
          </button>
          <button
            onClick={() => { setMode('join'); setErrorMsg(''); }}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: mode === 'join' ? '#4f9cff' : '#232831',
              color: mode === 'join' ? '#ffffff' : '#8a8f99',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            초대 코드로 참여
          </button>
        </div>

        {mode === 'create' ? (
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
        ) : (
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            placeholder="초대 코드 입력"
            autoFocus
            maxLength={8}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: 14,
              background: '#232831',
              color: '#ffffff',
              fontSize: 18,
              letterSpacing: 2,
              textAlign: 'center',
              border: '2px solid #232831',
              outline: 'none',
              marginBottom: errorMsg ? 8 : 16,
              transition: 'border-color 0.2s',
            }}
            onFocus={e  => { e.target.style.borderColor = '#4f9cff'; }}
            onBlur={e   => { e.target.style.borderColor = '#232831'; }}
          />
        )}

        {errorMsg && (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>
        )}

        <button
          onClick={mode === 'create' ? handleSetup : handleJoin}
          disabled={mode === 'create' ? (!familyName.trim() || loading) : (!inviteCode.trim() || loading)}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 14,
            background: (mode === 'create' ? familyName.trim() : inviteCode.trim()) && !loading ? '#4f9cff' : '#232831',
            color:  (mode === 'create' ? familyName.trim() : inviteCode.trim()) && !loading ? '#ffffff' : '#8a8f99',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            cursor: (mode === 'create' ? familyName.trim() : inviteCode.trim()) && !loading ? 'pointer' : 'default',
            transition: 'all 0.2s',
          }}
        >
          {loading ? '처리 중…' : mode === 'create' ? '대시보드 시작하기 →' : '기존 가족에 참여하기 →'}
        </button>
      </div>
    </main>
  );
}
