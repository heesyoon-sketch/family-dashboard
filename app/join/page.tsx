'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LogIn, Ticket } from 'lucide-react';
import { FamBitAuthShell } from '@/components/FamBitAuthShell';
import { createBrowserSupabase } from '@/lib/supabase';
import type { UserRole } from '@/lib/db';

interface JoinMemberOption {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string | null;
  claimed: boolean;
}

interface JoinResult {
  familyId?: string;
  memberId?: string;
  linkedBy?: 'existing' | 'email' | 'selection' | 'name' | 'created';
  requiresMemberSelection?: boolean;
  members?: JoinMemberOption[];
}

export default function JoinFamilyPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('CHILD');
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [memberOptions, setMemberOptions] = useState<JoinMemberOption[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkExistingSession = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setGoogleEmail(user.email ?? null);
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
    if (!code || loading) return;
    if (!googleEmail && !memberName) return;

    setLoading(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      const { data, error: joinError } = await supabase.rpc('join_family_by_code', {
        p_invite_code: code,
        p_member_name: googleEmail ? null : memberName,
        p_role: googleEmail ? 'PARENT' : role,
        p_member_id: null,
      });
      if (joinError) throw joinError;

      const result = data as JoinResult | null;
      if (result?.requiresMemberSelection) {
        setMemberOptions(result.members ?? []);
        setSelectedMemberId('');
        setLoading(false);
        return;
      }

      const familyId = result?.familyId;
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

  const handleSelectMember = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code || !selectedMemberId || loading) return;

    setLoading(true);
    setError('');
    try {
      const supabase = createBrowserSupabase();
      const { data, error: joinError } = await supabase.rpc('join_family_by_code', {
        p_invite_code: code,
        p_member_name: null,
        p_role: googleEmail ? 'PARENT' : role,
        p_member_id: selectedMemberId,
      });
      if (joinError) throw joinError;

      const result = data as JoinResult | null;
      if (result?.memberId) {
        localStorage.setItem('family_dashboard_member_id', result.memberId);
      }
      if (result?.familyId) {
        localStorage.setItem('family_dashboard_family_id', result.familyId);
      }
      router.replace('/');
    } catch (e) {
      console.error(e);
      setError('프로필을 연결할 수 없습니다. 이미 연결된 프로필인지 확인해주세요.');
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-[#0D0E1C]" />;
  }

  return (
    <FamBitAuthShell
      eyebrow="Invite"
      title={memberOptions.length === 0 ? '초대 코드로 참여' : '가족 프로필 연결'}
      description={
        memberOptions.length === 0
          ? googleEmail
            ? `${googleEmail} 계정으로 받은 초대 코드를 입력하세요.`
            : '초대 코드와 이름만 입력하면 이 기기에서 바로 FamBit 대시보드를 사용할 수 있습니다.'
          : '초대 코드에 연결할 가족 프로필을 선택하세요.'
      }
    >
      <div className="space-y-4">
        {memberOptions.length === 0 ? (
          <div className="space-y-3 text-left">
            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase text-white/42">Invite code</span>
              <input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="6-digit code"
                maxLength={8}
                className="h-12 w-full rounded-lg border border-white/10 bg-[#111224] text-center text-lg font-black tracking-[0.25em] text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#4EEDB0]"
              />
            </label>

            {!googleEmail && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase text-white/42">Name</span>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') void handleJoin(); }}
                    placeholder="Your name"
                    maxLength={32}
                    className="h-12 w-full rounded-lg border border-white/10 bg-[#111224] px-4 text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {(['PARENT', 'CHILD'] as UserRole[]).map(nextRole => (
                    <button
                      key={nextRole}
                      onClick={() => setRole(nextRole)}
                      className={[
                        'h-11 rounded-lg text-sm font-black transition-colors',
                        role === nextRole
                          ? 'bg-[#5B8EFF] text-white'
                          : 'border border-white/10 bg-white/[0.045] text-white/54 hover:bg-white/10 hover:text-white',
                      ].join(' ')}
                    >
                      {nextRole === 'PARENT' ? 'Parent' : 'Child'}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-left">
            <p className="text-sm font-bold text-white">Who are you? / 이 중 누구신가요?</p>
            <div className="space-y-2">
              {memberOptions.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  disabled={member.claimed}
                  className={[
                    'w-full rounded-lg border px-4 py-3 text-left transition-colors',
                    selectedMemberId === member.id
                      ? 'border-[#4EEDB0] bg-[#4EEDB0]/12 text-white'
                      : 'border-white/10 bg-[#111224] text-white/78',
                    member.claimed ? 'cursor-not-allowed opacity-45' : 'hover:border-[#4EEDB0]/70',
                  ].join(' ')}
                >
                  <span className="block font-black">{member.name}</span>
                  <span className="text-xs text-white/42">
                    {member.role === 'PARENT' ? 'Parent' : 'Child'}
                    {member.claimed ? ' · already linked' : ''}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setMemberOptions([]);
                setSelectedMemberId('');
                setError('');
              }}
              className="flex items-center gap-2 text-sm font-bold text-white/52 transition-colors hover:text-white"
            >
              <ArrowLeft size={15} />
              Change invitation code
            </button>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
            {error}
          </p>
        )}

        {memberOptions.length === 0 ? (
          <button
            onClick={() => { void handleJoin(); }}
            disabled={!inviteCode.trim() || (!googleEmail && !name.trim()) || loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
          >
            <Ticket size={17} />
            {loading ? 'Joining...' : 'Join Dashboard'}
          </button>
        ) : (
          <button
            onClick={() => { void handleSelectMember(); }}
            disabled={!selectedMemberId || loading}
            className="h-12 w-full rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
          >
            {loading ? 'Linking...' : 'Link Selected Member'}
          </button>
        )}

        <Link
          href="/login"
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] text-sm font-bold text-white/58 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogIn size={16} />
          Admin Google login
        </Link>
      </div>
    </FamBitAuthShell>
  );
}
