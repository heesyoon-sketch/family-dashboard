'use client';

import * as Icons from 'lucide-react';
import { CheckCircle2, Clock3, Eye } from 'lucide-react';
import type { Task, ThemeName } from '@/lib/db';
import type { TimeWindow } from '@/lib/timeWindows';
import { CUSTOM_ICON_MAP } from './CustomIcons';
import { useLanguage } from '@/contexts/LanguageContext';

function pascalCase(value: string): string {
  return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

export function RoutineReferenceCard({
  task,
  theme,
  completed,
  referenceWindow,
}: {
  task: Task;
  theme: ThemeName;
  completed: boolean;
  referenceWindow: TimeWindow;
}) {
  const { lang } = useLanguage();
  const IconMap = Icons as unknown as Record<
    string,
    React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
  >;
  const TaskIcon = CUSTOM_ICON_MAP[task.icon] ?? IconMap[pascalCase(task.icon)] ?? Eye;
  const isPastReference = referenceWindow === 'morning';
  const status = isPastReference
    ? (lang === 'en' ? 'Not completed' : '미완료')
    : (lang === 'en' ? 'Later today' : '오늘 나중에');
  const visualState = completed ? 'completed' : isPastReference ? 'missed' : 'future';

  return (
    <div
      data-theme={theme}
      data-reference-state={visualState}
      aria-disabled="true"
      aria-label={completed
        ? (lang === 'en' ? `${task.title}, completed` : `${task.title}, 완료`)
        : `${task.title}, ${status}`}
      className={`routine-reference-card pointer-events-none relative flex h-full w-full cursor-default select-none items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2 ${
        visualState === 'completed'
          ? 'border-[var(--border)] bg-[var(--bg-card)]/35'
          : visualState === 'missed'
            ? 'border-amber-500/30 bg-amber-500/[0.055]'
            : 'border-[var(--border)] bg-[var(--bg-card)]/45'
      }`}
    >
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] text-[var(--fg-muted)] ${
        completed ? 'bg-[var(--accent-glow)] text-[var(--success)]' : 'bg-[var(--bg)]'
      }`}>
        <TaskIcon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`line-clamp-2 text-sm font-bold leading-tight ${
          completed
            ? 'text-[#D5E9E1] line-through decoration-[var(--success)]/60'
            : 'text-[var(--fg)]'
        }`}>
          {task.title}
        </div>
        {visualState === 'missed' && (
          <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--fg-muted)]">
            <Clock3 size={12} />
            <span>{status}</span>
          </div>
        )}
      </div>
      {completed
        ? <span aria-hidden className="flex w-8 shrink-0 flex-col items-center gap-0.5 text-[var(--success)]">
            <CheckCircle2 size={28} fill="var(--success)" className="text-[var(--completion-fg)]" strokeWidth={2.5} />
            <span className="text-[9px] font-bold leading-none">{lang === 'en' ? 'Done' : '완료'}</span>
          </span>
        : visualState === 'missed'
          ? <Clock3 size={15} className="shrink-0 text-amber-500/65" aria-hidden />
          : <Eye size={15} className="shrink-0 text-[var(--fg-muted)] opacity-60" aria-hidden />}
    </div>
  );
}
