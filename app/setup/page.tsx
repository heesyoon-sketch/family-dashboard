'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase';

interface GoogleUser {
  email: string;
  name: string;
  avatarUrl?: string;
}

export default function SetupPage() {
  const router = useRouter();
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

  const handleSetup = async () => {
    const trimmed = familyName.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setErrorMsg('');
    try {
      const supabase = createBrowserSupabase();
      const { data: familyId, error: setupError } = await supabase.rpc('setup_family', {
        p_name: trimmed,
      });
      if (setupError || !familyId) throw setupError ?? new Error('setup_family returned null');

      const { error: seedError } = await supabase.rpc('seed_default_family_data', {
        p_admin_name: googleUser?.name ?? 'Dad',
        p_admin_avatar_url: googleUser?.avatarUrl ?? null,
      });
      if (seedError) throw seedError;

      router.replace('/');
    } catch (e) {
      console.error(e);
      setErrorMsg('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
    }
  };

  if (checking) {
    return <div className="min-h-screen bg-[#0b0d12]" />;
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[28px] bg-[#141821] border border-[#232831] p-8 text-center">
        <div className="text-5xl mb-3">🏠</div>
        <h1 className="text-white text-2xl font-bold mb-2">Create Family Dashboard</h1>
        <p className="text-[#8a8f99] text-sm leading-6 mb-5">
          Google 로그인은 가족 관리자에게만 필요합니다. 가족을 만들면 예시 멤버, 습관, 보상이 자동으로 채워집니다.
        </p>

        {googleUser && (
          <div className="flex items-center gap-3 rounded-xl bg-[#1a1f2a] border border-[#2d3545] p-3 mb-5 text-left">
            {googleUser.avatarUrl ? (
              <Image
                src={googleUser.avatarUrl}
                alt={googleUser.name}
                width={36}
                height={36}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[#4f9cff] text-white font-bold flex items-center justify-center shrink-0">
                {googleUser.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-white text-sm font-bold truncate">{googleUser.name}</div>
              <div className="text-[#8a8f99] text-xs truncate">{googleUser.email}</div>
            </div>
          </div>
        )}

        <input
          type="text"
          value={familyName}
          onChange={e => setFamilyName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSetup(); }}
          placeholder="Family name"
          autoFocus
          maxLength={40}
          className="w-full h-12 rounded-xl bg-[#232831] text-white px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff]"
        />

        {errorMsg && <p className="text-red-400 text-sm mt-3">{errorMsg}</p>}

        <button
          onClick={() => { void handleSetup(); }}
          disabled={!familyName.trim() || loading}
          className="mt-5 w-full h-12 rounded-xl bg-[#4f9cff] text-white font-bold disabled:bg-[#232831] disabled:text-[#8a8f99]"
        >
          {loading ? 'Creating...' : 'Start Dashboard'}
        </button>

        <Link href="/join" className="mt-4 inline-flex text-sm text-[#8a8f99]">
          가족 코드를 받았다면 여기서 참여하세요
        </Link>
      </div>
    </main>
  );
}
