'use client';

import { useLanguage } from '@/contexts/LanguageContext';
import { useFamilyAnalytics } from '@/lib/analytics/useFamilyAnalytics';
import { HallOfShields } from '@/components/hall/HallOfShields';
import { PageShell } from '@/components/analytics/PageShell';

export default function ShieldsPage() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const analytics = useFamilyAnalytics();
  return (
    <PageShell title={en ? 'Hall of Shields' : '쉴드 명예의 전당'} subtitle={en ? 'Every week tells a different story.' : '매주 다른 이야기가 쓰여요.'}>
      <HallOfShields analytics={analytics} />
    </PageShell>
  );
}
