'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, LogOut, Plus, Ticket } from 'lucide-react';
import { FamBitAuthShell } from '@/components/FamBitAuthShell';
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

      const adminName = googleUser?.name?.trim() || authUser.email || 'Family Admin';
      const familyId = crypto.randomUUID();
      const preparePayload = {};
      console.log('[setup:create-family] supabase.rpc prepare_create_family payload', preparePayload);
      const { error: prepareError } = await supabase.rpc('prepare_create_family', preparePayload);
      if (prepareError) {
        console.error('[setup:create-family] supabase.rpc prepare_create_family error', { payload: preparePayload, error: prepareError });
        throw prepareError;
      }

      const familyPayload = { id: familyId, name: trimmed, owner_id: authUser.id };
      console.log('[setup:create-family] supabase.from(families).insert payload', familyPayload);
      const { error: familyError } = await supabase
        .from('families')
        .insert(familyPayload);
      if (familyError) {
        console.error('[setup:create-family] supabase.from(families).insert error', { payload: familyPayload, error: familyError });
        throw familyError;
      }

      // If any seed step fails after the family row exists, delete the family so
      // the next attempt starts from a clean slate. The owner can always retry.
      try {
        const seedPayload = {
          p_family_id: familyId,
          p_admin_name: adminName,
          p_admin_avatar_url: googleUser?.avatarUrl ?? null,
        };
        console.log('[setup:create-family] supabase.rpc seed_default_family_data payload', seedPayload);
        const { error: seedError } = await supabase.rpc('seed_default_family_data', seedPayload);
        if (seedError) {
          console.error('[setup:create-family] supabase.rpc seed_default_family_data error', { payload: seedPayload, error: seedError });
          throw seedError;
        }
      } catch (seedError) {
        const cleanupPayload = { id: familyId };
        console.log('[setup:create-family] supabase.from(families).delete payload', cleanupPayload);
        const { error: cleanupError } = await supabase.from('families').delete().eq('id', familyId);
        if (cleanupError) {
          console.error('[setup:create-family] supabase.from(families).delete error', { payload: cleanupPayload, error: cleanupError });
        }
        throw seedError;
      }

      router.replace('/setup/set-pin');
    } catch (e) {
      console.error(e);
      setErrorMsg(getSetupErrorMessage(e));
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    localStorage.clear();
    router.replace('/login');
  };

  if (checking) return <div className="min-h-screen bg-[#0D0E1C]" />;

  return (
    <FamBitAuthShell
      eyebrow="Setup"
      title={step === 'choose' ? '가족 공간 설정' : '새 가족 공간 만들기'}
      description={
        step === 'choose'
          ? 'FamBit을 시작하려면 가족 공간을 만들거나 이미 받은 초대 코드로 합류하세요.'
          : '가족 이름을 입력하면 예시 멤버, 습관, 보상이 자동으로 채워집니다.'
      }
    >
      <div className="space-y-4">
        {googleUser ? (
          <div className="flex items-center gap-3 rounded-lg border border-white/8 bg-[#111224] p-3">
            {googleUser.avatarUrl ? (
              <Image
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5B8EFF] text-sm font-black text-white">
                {googleUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{googleUser.name}</div>
              <div className="truncate text-xs text-white/46">{googleUser.email}</div>
            </div>
            <button
              onClick={() => { void handleLogout(); }}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.045] text-white/50 transition-colors hover:border-[#FF7BAC]/40 hover:text-[#FF7BAC]"
              aria-label="로그아웃"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { void handleLogout(); }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#FF7BAC]/30 bg-[#FF7BAC]/10 text-sm font-bold text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/12"
          >
            <LogOut size={15} />
            로그아웃
          </button>
        )}

        {step === 'choose' && (
          <>
            <Link
              href="/join"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0]"
            >
              <Ticket size={17} />
              초대 코드로 합류하기
            </Link>

            <button
              onClick={() => setStep('create')}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-white transition-colors hover:bg-white/10"
            >
              <Plus size={17} />
              우리 가족 공간 새로 만들기
            </button>

            <p className="text-center text-xs leading-5 text-white/42">
              가족 관리자가 아니라면 초대 코드가 필요합니다.
            </p>
          </>
        )}

        {step === 'create' && (
          <>
            <button
              onClick={() => { setStep('choose'); setErrorMsg(''); }}
              className="flex items-center gap-2 text-sm font-bold text-white/52 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} />
              뒤로
            </button>

            <input
              type="text"
              value={familyName}
              onChange={e => setFamilyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreate(); }}
              placeholder="예: 김씨 가족, Our Family"
              autoFocus
              maxLength={40}
              className="h-12 w-full rounded-lg border border-white/10 bg-[#111224] px-4 text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
            />

            {errorMsg && (
              <p className="rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
                {errorMsg}
              </p>
            )}

            <button
              onClick={() => { void handleCreate(); }}
              disabled={!familyName.trim() || loading}
              className="h-12 w-full rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
            >
              {loading ? '생성 중...' : '대시보드 시작하기'}
            </button>
          </>
        )}
      </div>
    </FamBitAuthShell>
  );
}
