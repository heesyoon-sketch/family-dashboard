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

interface InviteProfile {
  id: string;
  name: string;
  role: 'PARENT' | 'CHILD';
  theme: string;
  claimed: boolean;
}

interface GoogleUser {
  email: string;
  name: string;
  avatarUrl?: string;
}

export default function SetupPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [inviteProfiles, setInviteProfiles] = useState<InviteProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loading, setLoading]       = useState(false);
  const [checking, setChecking]     = useState(true);
  const [errorMsg, setErrorMsg]     = useState('');
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);

  // If the user already has a family, send them straight to the dashboard.
  useEffect(() => {
    const check = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (familyId) { router.replace('/'); return; }
      setGoogleUser({
        email: user.email ?? '',
        name: user.user_metadata?.full_name ?? user.email ?? '',
        avatarUrl: user.user_metadata?.avatar_url,
      });
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
        const { data: { user } } = await supabase.auth.getUser();
        const { error: seedErr } = await supabase.from('users').insert(
          DEFAULT_MEMBERS.map((m, idx) => ({
            id:         crypto.randomUUID(),
            name:       m.name,
            role:       m.role,
            theme:      m.theme,
            family_id:  familyId,
            auth_user_id: idx === 0 ? user?.id : null,
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

  const loadInviteProfiles = async () => {
    const trimmed = inviteCode.trim().toUpperCase();
    if (!trimmed || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }

      const { data, error } = await supabase.rpc('get_invite_profiles', {
        p_invite_code: trimmed,
      });
      if (error) throw error;

      const profiles = (data ?? []) as InviteProfile[];
      if (profiles.length === 0) throw new Error('No profiles returned');
      setInviteProfiles(profiles);
      setSelectedProfileId(profiles.find(p => !p.claimed)?.id ?? '');
    } catch (e) {
      console.error(e);
      setErrorMsg('초대 코드를 확인할 수 없습니다. 코드를 다시 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const trimmed = inviteCode.trim().toUpperCase();
    if (!trimmed || !selectedProfileId || loading) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createBrowserSupabase();

      const { data: familyId, error: rpcErr } = await supabase.rpc('join_family_by_invite', {
        p_invite_code: trimmed,
        p_profile_id: selectedProfileId,
      });
      if (rpcErr || !familyId) throw rpcErr ?? new Error('join_family_by_invite returned null');

      // Sync Google profile photo now that auth_user_id is linked
      const { data: { user } } = await supabase.auth.getUser();
      const googleAvatar = user?.user_metadata?.avatar_url as string | undefined;
      if (googleAvatar && user) {
        await supabase
          .from('users')
          .update({ avatar_url: googleAvatar })
          .eq('auth_user_id', user.id);
      }

      router.replace('/');
    } catch (e) {
      console.error(e);
      setErrorMsg('이미 연결된 프로필이거나 초대 코드가 올바르지 않습니다.');
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
        <p style={{ color: '#8a8f99', fontSize: 14, margin: '0 0 16px', lineHeight: 1.6 }}>
          새 가족 대시보드를 만들거나<br />
          받은 초대 코드로 기존 가족에 참여하세요.
        </p>

        {/* Logged-in Google account badge */}
        {googleUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#1a1f2a',
            border: '1px solid #2d3545',
            borderRadius: 12,
            padding: '8px 12px',
            marginBottom: 20,
            textAlign: 'left',
          }}>
            {googleUser.avatarUrl ? (
              <img
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                referrerPolicy="no-referrer"
                style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%', background: '#4f9cff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {googleUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#ffffff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {googleUser.name}
              </div>
              <div style={{ color: '#8a8f99', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {googleUser.email}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => { setMode('create'); setErrorMsg(''); setInviteProfiles([]); setSelectedProfileId(''); }}
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
            onChange={e => {
              setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setInviteProfiles([]);
              setSelectedProfileId('');
            }}
            onKeyDown={e => e.key === 'Enter' && (inviteProfiles.length ? handleJoin() : loadInviteProfiles())}
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

        {mode === 'join' && inviteProfiles.length > 0 && (
          <div style={{ display: 'grid', gap: 8, marginBottom: errorMsg ? 8 : 16 }}>
            {inviteProfiles.map(profile => {
              const disabled = profile.claimed;
              const selected = selectedProfileId === profile.id;
              return (
                <button
                  key={profile.id}
                  onClick={() => !disabled && setSelectedProfileId(profile.id)}
                  disabled={disabled}
                  style={{
                    minHeight: 52,
                    borderRadius: 14,
                    border: selected ? '2px solid #4f9cff' : '2px solid #232831',
                    background: selected ? 'rgba(79,156,255,0.16)' : '#232831',
                    color: disabled ? '#5f6673' : '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 14px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{profile.name}</span>
                  <span style={{ color: disabled ? '#5f6673' : '#8a8f99', fontSize: 13 }}>
                    {disabled ? '연결됨' : profile.role === 'PARENT' ? '부모' : '자녀'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {errorMsg && (
          <p style={{ color: '#ff6b6b', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>
        )}

        <button
          onClick={mode === 'create' ? handleSetup : inviteProfiles.length ? handleJoin : loadInviteProfiles}
          disabled={mode === 'create' ? (!familyName.trim() || loading) : (!inviteCode.trim() || loading || (inviteProfiles.length > 0 && !selectedProfileId))}
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
          {loading
            ? '처리 중…'
            : mode === 'create'
              ? '대시보드 시작하기 →'
              : inviteProfiles.length
                ? '선택한 프로필로 참여하기 →'
                : '초대 코드 확인하기 →'}
        </button>
      </div>
    </main>
  );
}
