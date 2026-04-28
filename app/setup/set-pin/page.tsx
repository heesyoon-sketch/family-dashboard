'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  if (checking) return <div className="min-h-screen bg-[#0b0d12]" />;

  return (
    <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-[#141821] border border-[#232831] p-8 text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-white text-2xl font-bold mb-2">관리자 PIN 설정</h1>
        <p className="text-[#8a8f99] text-sm leading-6 mb-6">
          이 가족 공간 전용 PIN을 설정해야 대시보드를 사용할 수 있습니다.
        </p>

        <input
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="새 PIN"
          autoFocus
          className="w-full h-12 rounded-xl bg-[#232831] text-white text-center text-xl tracking-widest px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff] mb-3"
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
          className="w-full h-12 rounded-xl bg-[#232831] text-white text-center text-xl tracking-widest px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff]"
        />

        {errorMsg && <p className="text-red-400 text-sm mt-3">{errorMsg}</p>}

        <button
          onClick={() => { void handleSave(); }}
          disabled={saving || pin.length !== 4 || confirmPin.length !== 4}
          className="mt-4 w-full h-12 rounded-xl bg-[#4f9cff] text-[#06111f] font-bold disabled:bg-[#232831] disabled:text-[#8a8f99] transition-colors"
        >
          {saving ? '저장 중...' : 'PIN 저장하고 시작하기'}
        </button>

        <button
          onClick={async () => {
            const supabase = createBrowserSupabase();
            await supabase.auth.signOut();
            localStorage.clear();
            router.replace('/login');
          }}
          className="mt-4 text-[#8a8f99] text-sm hover:text-red-400 transition-colors"
        >
          로그아웃
        </button>
      </div>
    </main>
  );
}
