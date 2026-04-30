'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';

interface GoogleUser {
  email: string;
  name: string;
  avatarUrl?: string;
}

type Step = 'choose' | 'create';

function getSetupErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? error.message : null;
    if (typeof maybeMessage === 'string' && maybeMessage) return maybeMessage;
    const maybeDetails = 'details' in error ? error.details : null;
    if (typeof maybeDetails === 'string' && maybeDetails) return maybeDetails;
    const maybeHint = 'hint' in error ? error.hint : null;
    if (typeof maybeHint === 'string' && maybeHint) return maybeHint;
  }
  if (typeof error === 'string' && error) return error;
  return 'Unknown setup error';
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [familyName, setFamilyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);

  useEffect(() => {
    const check = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (familyId) {
        if (!await familyHasAdminPin()) {
          router.replace('/setup/set-pin');
          return;
        }
        router.replace('/');
        return;
      }
      setGoogleUser({
        email: user.email ?? '',
        name: user.user_metadata?.full_name ?? user.email ?? 'Family Admin',
        avatarUrl: user.user_metadata?.avatar_url,
      });
      setChecking(false);
    };
    check();
  }, [router]);

  const handleCreate = async () => {
    const trimmed = familyName.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const supabase = createBrowserSupabase();

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('로그인이 필요합니다');

      const { data: family, error: familyError } = await supabase
        .from('families')
        .insert({ name: trimmed, owner_id: authUser.id })
        .select('id')
        .single();
      if (familyError || !family) throw familyError ?? new Error('가족 생성에 실패했습니다');

      // If any seed step fails after the family row exists, delete the family so
      // the next attempt starts from a clean slate. The owner can always retry.
      const familyId = family.id as string;
      try {
        const adminName = googleUser?.name?.trim() || authUser.email || 'Family Admin';
        const memberId = crypto.randomUUID();
        const { error: memberError } = await supabase.from('users').insert({
          id: memberId,
          name: adminName,
          role: 'PARENT',
          theme: 'dark_minimal',
          family_id: familyId,
          auth_user_id: authUser.id,
          avatar_url: googleUser?.avatarUrl ?? null,
          email: authUser.email ?? null,
          login_method: 'google',
          display_order: 0,
        });
        if (memberError) throw memberError;

        const { error: levelError } = await supabase.from('levels').insert({
          user_id: memberId,
          current_level: 1,
          total_points: 100,
          spendable_balance: 100,
        });
        if (levelError) throw levelError;

        const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
        const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
        const weekend = ['SAT', 'SUN'];
        const { error: tasksError } = await supabase.from('tasks').insert([
          { id: crypto.randomUUID(), user_id: memberId, family_id: familyId, title: '🛏️ 아침 이불 개기', icon: 'bed', difficulty: 'EASY', base_points: 10, recurrence: 'daily', days_of_week: allDays, time_window: 'morning', active: 1, sort_order: 1 },
          { id: crypto.randomUUID(), user_id: memberId, family_id: familyId, title: '🎒 하교/하원 후 가방 정리', icon: 'backpack', difficulty: 'MEDIUM', base_points: 15, recurrence: 'weekdays', days_of_week: weekdays, time_window: 'evening', active: 1, sort_order: 2 },
          { id: crypto.randomUUID(), user_id: memberId, family_id: familyId, title: '🧹 주말 내 방 청소', icon: 'brush-cleaning', difficulty: 'HARD', base_points: 30, recurrence: 'weekend', days_of_week: weekend, time_window: null, active: 1, sort_order: 3 },
          { id: crypto.randomUUID(), user_id: memberId, family_id: familyId, title: '💖 가족 안아주며 칭찬하기', icon: 'heart-handshake', difficulty: 'HARD', base_points: 50, recurrence: 'daily', days_of_week: allDays, time_window: null, active: 1, sort_order: 4 },
        ]);
        if (tasksError) throw tasksError;

        const { error: rewardsError } = await supabase.from('rewards').insert([
          { title: '🍿 오늘 간식 1개 선택권', icon: 'ice-cream', cost_points: 100, family_id: familyId, sale_enabled: false },
          { title: '🎮 30분 영상 보기 / 게임 하기', icon: 'gamepad-2', cost_points: 400, family_id: familyId, sale_enabled: true, sale_percentage: 38, sale_price: 250, sale_name: '튜토리얼 세일' },
          { title: '👑 YESaturday (하루 종일 예스맨 되기)', icon: 'smile-plus', cost_points: 5000, family_id: familyId, sale_enabled: false },
        ]);
        if (rewardsError) throw rewardsError;
      } catch (seedError) {
        await supabase.from('families').delete().eq('id', familyId);
        throw seedError;
      }

      router.replace('/setup/set-pin');
    } catch (e) {
      console.error(e);
      setErrorMsg(getSetupErrorMessage(e));
      setLoading(false);
    }
  };

  if (checking) return <div className="min-h-screen bg-[#0b0d12]" />;

  return (
    <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logged-in user badge (Google users only) */}
        {googleUser && (
          <div className="flex items-center gap-3 rounded-2xl bg-[#141821] border border-[#232831] p-3 mb-4">
            {googleUser.avatarUrl ? (
              <Image
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                width={36} height={36}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#4f9cff] text-[#06111f] font-bold flex items-center justify-center shrink-0 text-sm">
                {googleUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-semibold truncate">{googleUser.name}</div>
              <div className="text-[#8a8f99] text-xs truncate">{googleUser.email}</div>
            </div>
            <button
              onClick={async () => {
                const supabase = createBrowserSupabase();
                await supabase.auth.signOut();
                localStorage.clear();
                router.replace('/login');
              }}
              className="text-[#8a8f99] text-xs hover:text-red-400 transition-colors shrink-0"
            >
              로그아웃
            </button>
          </div>
        )}

        {/* Universal logout — always visible regardless of login method */}
        {!googleUser && (
          <button
            onClick={async () => {
              const supabase = createBrowserSupabase();
              await supabase.auth.signOut();
              localStorage.clear();
              router.replace('/login');
            }}
            className="w-full text-center text-red-400 text-sm mb-4 hover:text-red-300 transition-colors"
          >
            로그아웃
          </button>
        )}

        {step === 'choose' && (
          <div className="rounded-[28px] bg-[#141821] border border-[#232831] p-8 text-center">
            <div className="text-5xl mb-3">🏠</div>
            <h1 className="text-white text-2xl font-bold mb-2">Family Dashboard</h1>
            <p className="text-[#8a8f99] text-sm leading-6 mb-8">
              아직 어느 가족 공간에도 속해 있지 않습니다.<br />
              새로 만들거나, 초대 코드로 참여하세요.
            </p>

            {/* Primary CTA: Join */}
            <Link
              href="/join"
              className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-[#4f9cff] text-[#06111f] font-bold text-base mb-3 hover:bg-[#3d8bed] transition-colors"
            >
              🔑 초대 코드로 합류하기
            </Link>

            {/* Secondary CTA: Create */}
            <button
              onClick={() => setStep('create')}
              className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-[#232831] text-white font-bold text-base hover:bg-[#2d3545] transition-colors"
            >
              ✨ 우리 가족 공간 새로 만들기
            </button>

            <p className="text-[#8a8f99] text-xs mt-5 leading-5">
              이미 초대 코드를 받았다면 합류하기를 선택하세요.<br />
              가족 관리자가 아니라면 초대 코드가 필요합니다.
            </p>
          </div>
        )}

        {step === 'create' && (
          <div className="rounded-[28px] bg-[#141821] border border-[#232831] p-8 text-center">
            <button
              onClick={() => { setStep('choose'); setErrorMsg(''); }}
              className="flex items-center gap-1 text-[#8a8f99] text-sm mb-4 hover:text-white transition-colors"
            >
              ← 뒤로
            </button>
            <div className="text-4xl mb-3">✨</div>
            <h2 className="text-white text-xl font-bold mb-2">새 가족 공간 만들기</h2>
            <p className="text-[#8a8f99] text-sm leading-6 mb-5">
              가족 이름을 입력하세요. 예시 멤버, 습관, 보상이 자동으로 채워집니다.
            </p>

            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
              placeholder="예: 김씨 가족, Our Family"
              autoFocus
              maxLength={40}
              className="w-full h-12 rounded-xl bg-[#232831] text-white px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff]"
            />

            {errorMsg && <p className="text-red-400 text-sm mt-3">{errorMsg}</p>}

            <button
              onClick={() => { void handleCreate(); }}
              disabled={!familyName.trim() || loading}
              className="mt-4 w-full h-12 rounded-xl bg-[#4f9cff] text-[#06111f] font-bold disabled:bg-[#232831] disabled:text-[#8a8f99] transition-colors"
            >
              {loading ? '생성 중...' : '대시보드 시작하기'}
            </button>
          </div>
        )}

      </div>
    </main>
  );
}
