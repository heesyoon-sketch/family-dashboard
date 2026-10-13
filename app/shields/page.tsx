'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyAnalytics } from '@/lib/analytics/useFamilyAnalytics';
import { ShieldWall } from '@/components/hall/ShieldWall';
import { PageShell } from '@/components/analytics/PageShell';

export default function ShieldsPage() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const analytics = useFamilyAnalytics();
  return (
    <PageShell title={en ? 'Shield Wall' : '쉴드 월'} subtitle={en ? 'Earn last month. Equip this month.' : '지난달에 얻고, 이번 달에 장착해요.'}>
      <ShieldWall analytics={analytics} />
    </PageShell>
  );
}
