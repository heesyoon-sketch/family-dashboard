'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, ShieldCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';
import { useLanguage } from '@/contexts/LanguageContext';
import { ConnectionStatusChip } from '@/components/ConnectionStatusChip';
import { useFamilyStore } from '@/lib/store';
import { LoadingBlock } from './ui';

/** Auth gate + header shared by Family Growth (/stats) and the Hall of
 *  Shields (/shields). */
export function PageShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { lang, t } = useLanguage();
  const en = lang === 'en';
  const [ready, setReady] = useState(false);
  const familyName = useFamilyStore(s => s.familyName);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: familyInfo } = await supabase.rpc('get_my_family_info');
      if (!(familyInfo as { id?: string } | null)?.id) { router.replace('/setup'); return; }
      if (!await familyHasAdminPin()) { router.replace('/setup/set-pin'); return; }
      // Bring up the store even when the user lands here directly.
      useFamilyStore.getState().hydrate().catch(err => console.warn('[page hydrate]', err));
      if (live) setReady(true);
    })().catch(err => {
      console.error(err);
      if (live) setReady(true);
    });
    return () => { live = false; };
  }, [router]);

  const links = [
    { href: '/stats', label: en ? 'Family Growth' : '우리 가족 성장', Icon: BarChart3 },
    { href: '/shields', label: en ? 'Hall of Shields' : '쉴드 명예의 전당', Icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#0d1020] text-[#F4F5FA]">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0d1020]/90 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:px-6">
          <Link href="/" aria-label={t('back_to_dashboard')} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-[#B3B7CE] transition hover:bg-white/10 hover:text-white">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}{familyName ? ` · ${familyName}` : ''}</p>
            <p className="hidden truncate text-xs text-[#8E94B4] sm:block">{subtitle}</p>
          </div>
          <ConnectionStatusChip className="hidden md:inline-flex" />
          <nav aria-label={en ? 'Family pages' : '가족 페이지'} className="flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/25 p-1">
            {links.map(({ href, label, Icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-[#A5A6FF] sm:px-3 sm:text-sm ${active ? 'bg-[#A5A6FF] text-[#141733]' : 'text-[#B3B7CE] hover:text-white'}`}>
                  <Icon size={15} aria-hidden /><span className="max-[420px]:sr-only">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main>{ready ? children : <LoadingBlock label={t('loading')} />}</main>
    </div>
  );
}
