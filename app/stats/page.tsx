'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyAnalytics } from '@/lib/analytics/useFamilyAnalytics';
import { FamilyGrowth } from '@/components/growth/FamilyGrowth';
import { PageShell } from '@/components/analytics/PageShell';

// Older links (`?view=shield`, `?view=insignia`, `?view=growth`) still land
// here; the member and `#shields` anchor keep working.
function StatsPageInner() {
  const searchParams = useSearchParams();
  const { lang } = useLanguage();
  const en = lang === 'en';
  const analytics = useFamilyAnalytics();
  return (
    <PageShell title={en ? 'Growth & Shields' : '성장과 쉴드'} subtitle={en ? 'Earn last month, equip this month — and see how far each of us has come' : '지난달에 얻고 이번 달에 장착해요. 그리고 각자 얼마나 자랐는지'}>
      <FamilyGrowth analytics={analytics} initialMemberId={searchParams.get('member')} />
    </PageShell>
  );
}

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1020]" />}>
      <StatsPageInner />
    </Suspense>
  );
}
