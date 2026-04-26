'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/db';

export default function JoinFamilyPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('CHILD');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkExistingSession = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: familyId } = await supabase.rpc('get_my_family_id');
        if (familyId) {
          router.replace('/');
          return;
        }
      }
      setChecking(false);
    };
    checkExistingSession();
  }, [router]);

  const handleJoin = async () => {
    const code = inviteCode.trim().toUpperCase();
    const memberName = name.trim();
    if (!code || !memberName || loading) return;

    setLoading(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      const { data, error: joinError } = await supabase.rpc('join_family_by_code', {
        p_invite_code: code,
        p_member_name: memberName,
        p_role: role,
      });
      if (joinError) throw joinError;

      const result = data as { memberId?: string } | null;
      const familyId = (data as { familyId?: string } | null)?.familyId;
      if (result?.memberId) {
        localStorage.setItem('family_dashboard_member_id', result.memberId);
      }
      if (familyId) {
        localStorage.setItem('family_dashboard_family_id', familyId);
      }
      router.replace('/');
    } catch (e) {
      console.error(e);
      setError('참여할 수 없습니다. 코드를 확인하거나 관리자에게 다시 요청해주세요.');
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-[#0b0d12]" />;
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-[#141821] border border-[#232831] p-8 text-center">
        <div className="text-4xl mb-3">🏠</div>
        <h1 className="text-white text-2xl font-bold mb-2">Join Family</h1>
        <p className="text-[#8a8f99] text-sm leading-6 mb-6">
          초대 코드와 이름만 입력하면 이 기기에서 바로 대시보드를 사용할 수 있습니다.
        </p>

        <div className="space-y-3 text-left">
          <input
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="6-digit code"
            maxLength={8}
            className="w-full h-12 rounded-xl bg-[#232831] text-white text-center text-lg tracking-[0.25em] outline-none border border-[#2d3545] focus:border-[#4f9cff]"
          />
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleJoin(); }}
            placeholder="Your name"
            maxLength={32}
            className="w-full h-12 rounded-xl bg-[#232831] text-white px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff]"
          />
          <div className="grid grid-cols-2 gap-2">
            {(['PARENT', 'CHILD'] as UserRole[]).map(nextRole => (
              <button
                key={nextRole}
                onClick={() => setRole(nextRole)}
                className={[
                  'h-11 rounded-xl text-sm font-bold transition-colors',
                  role === nextRole
                    ? 'bg-[#4f9cff] text-white'
                    : 'bg-[#232831] text-[#8a8f99]',
                ].join(' ')}
              >
                {nextRole === 'PARENT' ? 'Parent' : 'Child'}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        <button
          onClick={() => { void handleJoin(); }}
          disabled={!inviteCode.trim() || !name.trim() || loading}
          className="mt-5 w-full h-12 rounded-xl bg-[#4f9cff] text-white font-bold disabled:bg-[#232831] disabled:text-[#8a8f99]"
        >
          {loading ? 'Joining...' : 'Join Dashboard'}
        </button>

        <Link href="/login" className="mt-4 inline-flex text-sm text-[#8a8f99]">
          Admin Google login
        </Link>
      </div>
    </main>
  );
}
