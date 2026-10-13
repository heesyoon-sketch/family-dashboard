'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { useFamilyStore } from '@/lib/store';
import { useFamilyAnalytics } from '@/lib/analytics/useFamilyAnalytics';
import { FamilyGrowth } from '@/components/growth/FamilyGrowth';
import { LoadingBlock } from '@/components/analytics/ui';

// Stats and Shield Wall are one page now. Older links (`?view=shield`,
// `?view=insignia`, `?view=growth`) still land here and open the same view.
function StatsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const en = lang === 'en';
  const [ready, setReady] = useState(false);
  const familyName = useFamilyStore(s => s.familyName);
  const analytics = useFamilyAnalytics();

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: familyInfo } = await supabase.rpc('get_my_family_info');
      if (!(familyInfo as { id?: string } | null)?.id) { router.replace('/setup'); return; }
      if (!await familyHasAdminPin()) { router.replace('/setup/set-pin'); return; }
      // Bring up the store (members, today's routines, shield snapshot) even
      // when the user lands here without visiting the dashboard first.
      useFamilyStore.getState().hydrate().catch(err => console.warn('[stats hydrate]', err));
      if (live) setReady(true);
    })().catch(err => {
      console.error(err);
      if (live) setReady(true);
    });
    return () => { live = false; };
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1020] text-[#F4F5FA]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0d1020]/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <Link href="/" aria-label={t('back_to_dashboard')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-[#B3B7CE] transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">{en ? 'Family Growth' : '우리 가족 성장'}{familyName ? ` · ${familyName}` : ''}</h1>
            <p className="hidden truncate text-xs text-[#8E94B4] sm:block">{en ? 'Together as a family, and how far each of us has come' : '함께하는 우리, 그리고 각자 얼마나 자랐는지'}</p>
          </div>
          <ConnectionStatusChip className="hidden md:inline-flex" />
        </div>
      </header>
      <main>
        {!ready ? <LoadingBlock label={t('loading')} /> : <FamilyGrowth analytics={analytics} initialMemberId={searchParams.get('member')} />}
      </main>
    </div>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1020]" />}>
      <StatsPageInner />
    </Suspense>
  );
}
