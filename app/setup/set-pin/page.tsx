'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, LogOut } from 'lucide-react';
import { FamBitAuthShell } from '@/components/FamBitAuthShell';
import { createBrowserSupabase } from '@/lib/supabase';
import { getCurrentFamilyAdminPinHash, saveAdminPin } from '@/lib/adminPin';

function getPinErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'PIN을 저장할 수 없습니다';
}

export default function SetPinPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const check = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (!familyId) {
        router.replace('/setup');
        return;
      }

      const existingHash = await getCurrentFamilyAdminPinHash();
      if (existingHash) {
        router.replace('/');
        return;
      }

      setChecking(false);
    };

    check().catch(error => {
      console.error(error);
      setChecking(false);
    });
  }, [router]);

  const handleSave = async () => {
    if (saving) return;
    setErrorMsg('');

    if (!/^\d{4}$/.test(pin)) {
      setErrorMsg('4자리 숫자 PIN을 입력하세요');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('PIN이 일치하지 않습니다');
      return;
    }

    setSaving(true);
    try {
      await saveAdminPin(pin);
      router.replace('/');
    } catch (error) {
      console.error(error);
      setErrorMsg(getPinErrorMessage(error));
      setSaving(false);
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
      eyebrow="Admin protection"
      title="관리자 PIN 설정"
      description="이 가족 공간의 민감한 설정을 보호할 4자리 숫자 PIN을 만드세요."
    >
      <div className="space-y-3">
        <div className="mb-2 flex justify-center text-[#4EEDB0]">
          <LockKeyhole size={24} />
        </div>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="새 PIN"
          autoFocus
          className="h-12 w-full rounded-lg border border-white/10 bg-[#111224] px-4 text-center text-xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
        />

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={confirmPin}
          onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') void handleSave(); }}
          placeholder="PIN 확인"
          className="h-12 w-full rounded-lg border border-white/10 bg-[#111224] px-4 text-center text-xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
        />

        {errorMsg && (
          <p className="rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
            {errorMsg}
          </p>
        )}

        <button
          onClick={() => { void handleSave(); }}
          disabled={saving || pin.length !== 4 || confirmPin.length !== 4}
          className="h-12 w-full rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
        >
          {saving ? '저장 중...' : 'PIN 저장하고 시작하기'}
        </button>

        <button
          onClick={() => { void handleLogout(); }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] text-sm font-bold text-white/58 transition-colors hover:border-[#FF7BAC]/35 hover:text-[#FFB8CF]"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </div>
    </FamBitAuthShell>
  );
}
