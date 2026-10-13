'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { useFamilyStore } from '@/lib/store';
import { useFamilyAnalytics } from '@/lib/analytics/useFamilyAnalytics';
import { PersonalStats } from '@/components/stats/PersonalStats';
import { ShieldWall } from '@/components/shieldwall/ShieldWall';
import { LoadingBlock } from '@/components/analytics/ui';

type View = 'stats' | 'shield';

// `insignia` and `growth` are older names for links people may have saved.
function viewFromQuery(value: string | null): View {
  return value === 'shield' || value === 'insignia' || value === 'growth' ? 'shield' : 'stats';
}

function StatsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang, t } = useLanguage();
  const en = lang === 'en';
  const [view, setView] = useState<View>(viewFromQuery(searchParams.get('view')));
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

  const switchView = (next: View) => {
    setView(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'shield') params.set('view', 'shield'); else params.delete('view');
    const query = params.toString();
    router.replace(query ? `/stats?${query}` : '/stats', { scroll: false });
  };

  return (
    <div className="min-h-screen bg-[#0d1020] text-[#F4F5FA]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0d1020]/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <Link href="/" aria-label={t('back_to_dashboard')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-[#B3B7CE] transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{view === 'shield' ? 'Shield Wall' : (en ? 'Stats' : '통계')}{familyName ? ` · ${familyName}` : ''}</p>
            <p className="hidden truncate text-xs text-[#8E94B4] sm:block">{view === 'shield' ? (en ? 'We grow stronger together' : '함께할수록 더 단단해져요') : (en ? 'See how far you’ve come' : '얼마나 자랐는지 확인해요')}</p>
          </div>
          <ConnectionStatusChip className="hidden md:inline-flex" />
          <nav aria-label={en ? 'Stats sections' : '통계 메뉴'} className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
            {([
              { id: 'stats' as const, label: en ? 'Stats' : '통계', Icon: BarChart3 },
              { id: 'shield' as const, label: 'Shield Wall', Icon: ShieldCheck },
            ]).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={view === id ? 'page' : undefined}
                onClick={() => switchView(id)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-[#A5A6FF] sm:text-sm ${view === id ? 'bg-[#A5A6FF] text-[#141733]' : 'text-[#B3B7CE] hover:text-white'}`}
              >
                <Icon size={15} aria-hidden />{label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {!ready ? <LoadingBlock label={t('loading')} />
          : view === 'shield' ? <ShieldWall analytics={analytics} />
          : <PersonalStats analytics={analytics} initialMemberId={searchParams.get('member')} />}
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
