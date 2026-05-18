'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';

interface Step {
  key: string;
  done: boolean;
  label: string;
}

export function FamilyOnboardingChecklist() {
  const { lang } = useLanguage();
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const rewards = useFamilyStore(s => s.rewards);
  const activeTaskCount = useFamilyStore(s => s.activeTaskCount);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const [locallyDismissed, setLocallyDismissed] = useState(false);

  const storageKey = familyId ? `family_onboarding_dismissed_${familyId}` : null;
  const persistedDismissed =
    typeof window !== 'undefined' && storageKey
      ? localStorage.getItem(storageKey) === '1'
      : false;
  const dismissed = locallyDismissed || persistedDismissed;

  const hasStarted = Object.values(levelsByUser).some(level => level.totalPoints > 0);

  const steps = useMemo<Step[]>(() => [
    {
      key: 'profiles',
      done: users.length >= 2,
      label: lang === 'en' ? 'Add at least two family profiles' : '가족 프로필을 2명 이상 추가하기',
    },
    {
      key: 'habits',
      done: activeTaskCount >= 3,
      label: lang === 'en' ? 'Create three starter habits' : '시작 습관 3개 만들기',
    },
    {
      key: 'rewards',
      done: rewards.length >= 3,
      label: lang === 'en' ? 'Add three rewards worth saving for' : '모아 살 만한 보상 3개 추가하기',
    },
    {
      key: 'first-win',
      done: hasStarted,
      label: lang === 'en' ? 'Record the first completion' : '첫 완료 기록 남기기',
    },
  ], [activeTaskCount, hasStarted, lang, rewards.length, users.length]);

  const completeCount = steps.filter(step => step.done).length;
  const fullyComplete = completeCount === steps.length;
  const nextStep = steps.find(step => !step.done);
  const nextHref = nextStep?.key === 'first-win' ? '#' : '/admin';

  if (!familyId || dismissed || fullyComplete) return null;

  const dismiss = () => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1');
    }
    setLocallyDismissed(true);
  };

  return (
    <section className="rounded-2xl border border-[#5B8EFF]/24 bg-[#111224] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.24)] sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#5B8EFF]/14 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8EAFFF]">
            <Sparkles size={12} />
            {lang === 'en' ? 'Quick start' : '빠른 시작'}
          </div>
          <h2 className="text-sm font-black text-white">
            {lang === 'en' ? 'Set the family system once' : '가족 시스템을 한 번에 세팅하세요'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-white/56">
            {lang === 'en'
              ? 'Finish these four moves and the dashboard becomes self-explanatory.'
              : '이 네 단계만 끝내면 대시보드가 스스로 설명되기 시작합니다.'}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={lang === 'en' ? 'Dismiss quick start' : '빠른 시작 닫기'}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
        >
          <X size={15} />
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-[#4EEDB0] transition-[width] duration-300"
          style={{ width: `${(completeCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {steps.map(step => (
          <div key={step.key} className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2.5 py-2">
            {step.done ? (
              <CheckCircle2 size={16} className="shrink-0 text-[#4EEDB0]" />
            ) : (
              <Circle size={16} className="shrink-0 text-white/25" />
            )}
            <span className={`text-xs font-semibold ${step.done ? 'text-white/48 line-through' : 'text-white/82'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {nextStep && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/52">
            {lang === 'en' ? 'Next:' : '다음:'} {nextStep.label}
          </p>
          {nextHref === '#' ? (
            <span className="text-xs font-bold text-[#4EEDB0]">
              {lang === 'en' ? 'Complete any task below to finish setup.' : '아래 습관 하나를 완료하면 설정이 끝납니다.'}
            </span>
          ) : (
            <Link
              href={nextHref}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#4EEDB0] px-4 text-xs font-black text-[#07120E] transition hover:bg-[#71F4C0]"
            >
              {lang === 'en' ? 'Open admin setup' : '관리 설정 열기'}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
