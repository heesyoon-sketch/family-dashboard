'use client';

import * as Icons from 'lucide-react';
import { Check, Clock3, Eye, LockKeyhole } from 'lucide-react';
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
  const status = completed
    ? (lang === 'en' ? 'Completed' : '완료')
    : isPastReference
      ? (lang === 'en' ? 'Not completed' : '미완료')
      : (lang === 'en' ? 'Later today' : '오늘 나중에');

  return (
    <div
      data-theme={theme}
      aria-disabled="true"
      className="pointer-events-none relative flex h-full w-full select-none items-center gap-2.5 overflow-hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-card)]/60 px-3 py-2 opacity-80"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--fg-muted)]">
        <TaskIcon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-sm font-bold leading-tight text-[var(--fg)]">
          {task.title}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-[var(--fg-muted)]">
          {completed ? <Check size={12} /> : isPastReference ? <Clock3 size={12} /> : <LockKeyhole size={12} />}
          <span>{status}</span>
        </div>
      </div>
      <Eye size={15} className="shrink-0 text-[var(--fg-muted)]" aria-hidden />
    </div>
  );
}
