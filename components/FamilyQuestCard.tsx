'use client';

import { HeartHandshake, Sparkles } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

function ritualLead(lang: 'en' | 'ko'): string {
  const day = new Date().getDay();
  if (day === 0) {
    return lang === 'en'
      ? 'Sunday ritual: tune the week before it starts.'
      : '일요일 의식: 한 주가 시작되기 전에 리듬을 맞춰보세요.';
  }
  if (day === 5) {
    return lang === 'en'
      ? 'Friday ritual: finish the week side by side.'
      : '금요일 의식: 함께 한 주를 마무리해보세요.';
  }
  return lang === 'en'
    ? 'Today’s family quest'
    : '오늘의 가족 퀘스트';
}

export function FamilyQuestCard() {
  const { lang } = useLanguage();
  const users = useFamilyStore(s => s.users);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const todayCompletions = useFamilyStore(s => s.todayCompletions);

  const activeMembers = users.filter(user => (tasksByUser[user.id] ?? []).length > 0);
  if (activeMembers.length < 2) return null;

  const joined = activeMembers.filter(user => (todayCompletions[user.id] ?? []).length > 0);
  const complete = joined.length === activeMembers.length;

  return (
    <section className="rounded-2xl border border-[#4EEDB0]/20 bg-[#111224] px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.2)] sm:px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#4EEDB0]/12 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#4EEDB0]">
            {complete ? <Sparkles size={12} /> : <HeartHandshake size={12} />}
            {ritualLead(lang)}
          </div>
          <p className="text-sm font-black text-white">
            {complete
              ? (lang === 'en' ? 'Everyone touched the day.' : '오늘은 모두가 리듬에 참여했어요.')
              : (lang === 'en'
                  ? 'Get one completion from every active member.'
                  : '활성 멤버 모두가 습관 하나씩 완료해보세요.')}
          </p>
        </div>
        <div className="shrink-0">
          <div className="text-right text-sm font-black text-[#4EEDB0]">
            {joined.length}/{activeMembers.length}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
            {lang === 'en' ? 'members joined' : '참여 멤버'}
          </div>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#4EEDB0] transition-[width] duration-300"
          style={{ width: `${(joined.length / activeMembers.length) * 100}%` }}
        />
      </div>
    </section>
  );
}
