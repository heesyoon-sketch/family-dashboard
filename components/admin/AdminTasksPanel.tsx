import type { Dispatch, SetStateAction } from 'react';
import Image from 'next/image';
import * as Icons from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { ALL_DAYS, type DayOfWeek, type Task, type User } from '@/lib/db';
import type { TimeWindow } from '@/lib/timeWindows';
import { LucideIcon } from '@/components/admin/IconPicker';
import { DAY_LABELS, withAvatarCache } from '@/lib/admin/adminHelpers';
import { buildAdminCopy } from '@/lib/admin/adminCopy';

interface AdminTasksPanelProps {
  selectedUser: User | null;
  sortedUsers: User[];
  tasks: Task[];
  setTasks: Dispatch<SetStateAction<Task[]>>;
  loadTasks: (user: User) => void;
  avatarVersion: number;
  setIconPickerTaskId: Dispatch<SetStateAction<string | null>>;
  editingTaskId: string | null;
  editingTaskTitle: string;
  setEditingTaskTitle: Dispatch<SetStateAction<string>>;
  confirmEditTask: (taskId: string) => void;
  cancelEditTask: () => void;
  startEditTask: (task: Task) => void;
  moveTask: (index: number, direction: 'up' | 'down') => void;
  updateTaskPoints: (taskId: string, rawValue: number) => void;
  toggleDay: (task: Task, day: DayOfWeek) => void;
  toggleTask: (task: Task) => void;
  deleteTask: (taskId: string) => void;
  selectedTimeWindows: (taskWindow: string | null | undefined) => TimeWindow[];
  toggleTimeWindow: (task: Task, timeWindow: TimeWindow) => void;
  newTaskTitle: string;
  setNewTaskTitle: Dispatch<SetStateAction<string>>;
  newTaskPoints: number;
  setNewTaskPoints: Dispatch<SetStateAction<number>>;
  isAddingTask: boolean;
  addTask: () => void;
}

export function AdminTasksPanel({
  selectedUser,
  sortedUsers,
  tasks,
  setTasks,
  loadTasks,
  avatarVersion,
  setIconPickerTaskId,
  editingTaskId,
  editingTaskTitle,
  setEditingTaskTitle,
  confirmEditTask,
  cancelEditTask,
  startEditTask,
  moveTask,
  updateTaskPoints,
  toggleDay,
  toggleTask,
  deleteTask,
  selectedTimeWindows,
  toggleTimeWindow,
  newTaskTitle,
  setNewTaskTitle,
  newTaskPoints,
  setNewTaskPoints,
  isAddingTask,
  addTask,
}: AdminTasksPanelProps) {
  const { lang, t } = useLanguage();
  const adminCopy = buildAdminCopy(lang);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A1B2E] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
                <Icons.ListChecks size={18} className="text-[#4EEDB0]" />
              </span>
              <h2 className="text-base font-black text-white">{adminCopy.tabs.tasks}</h2>
            </div>
            <p className="text-sm leading-6 text-white/54">
              {lang === 'en' ? 'Choose a member and tune their daily rhythm.' : '멤버별로 매일의 습관, 요일, 시간대, 포인트를 조정합니다.'}
            </p>
          </div>
          {selectedUser && (
            <div className="flex items-center gap-2 rounded-lg border border-[#4EEDB0]/20 bg-[#4EEDB0]/10 px-3 py-2 text-sm font-black text-[#4EEDB0]">
              <Icons.Sparkles size={15} />
              <span>{selectedUser.name}</span>
              <span className="text-white/45">{tasks.length}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {sortedUsers.map(u => {
            const isSelected = selectedUser?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => { void loadTasks(u); }}
                className={`flex min-h-[var(--touch-target)] shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-black transition-colors ${
                  isSelected
                    ? 'border-[#4EEDB0]/45 bg-[#4EEDB0] text-[#07120E]'
                    : 'border-white/8 bg-[#111224] text-white/64 hover:border-[#5B8EFF]/35 hover:bg-[#5B8EFF]/10 hover:text-white'
                }`}
              >
                <span className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-xs font-black ${
                  isSelected ? 'bg-[#07120E]/12 text-[#07120E]' : 'bg-white/[0.06] text-white/72'
                }`}>
                  {u.avatarUrl ? (
                    <Image
                      src={withAvatarCache(u.avatarUrl, avatarVersion) ?? u.avatarUrl}
                      alt={u.name}
                      width={32}
                      height={32}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 object-cover"
                    />
                  ) : (
                    u.name.charAt(0)
                  )}
                </span>
                <span className="max-w-28 truncate">{u.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedUser && (
        <section className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[#5B8EFF]">{t('select_user')}</p>
              <h2 className="mt-1 truncate text-xl font-black text-white">
                {selectedUser.name}{t('user_tasks_suffix')}
              </h2>
            </div>
            <div className="flex h-10 items-center gap-1 rounded-lg border border-white/10 bg-[#111224] p-1">
              <span className="h-2.5 w-8 rounded-full bg-[#5B8EFF]" />
              <span className="h-2.5 w-8 rounded-full bg-[#FF7BAC]" />
              <span className="h-2.5 w-8 rounded-full bg-[#4EEDB0]" />
            </div>
          </div>

          <div className="mb-5 space-y-3">
            {tasks.map((task, idx) => {
              const isActiveTask = task.active === 1;
              return (
                <div
                  key={task.id}
                  className={`rounded-lg border bg-[#1A1B2E] p-3 transition-colors sm:p-4 ${
                    isActiveTask
                      ? 'border-white/10 shadow-[0_14px_34px_rgba(0,0,0,0.18)]'
                      : 'border-white/6 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => setIconPickerTaskId(task.id)}
                      className="group flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#5B8EFF]/24 bg-[#5B8EFF]/10 text-[#8EAFFF] transition-colors hover:border-[#5B8EFF]/50 hover:bg-[#5B8EFF]/16 sm:h-12 sm:w-12"
                      title={t('icon_change')}
                      aria-label={t('icon_change')}
                    >
                      <LucideIcon name={task.icon} size={20} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {editingTaskId === task.id ? (
                          <>
                            <input
                              type="text"
                              value={editingTaskTitle}
                              onChange={e => setEditingTaskTitle(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmEditTask(task.id);
                                if (e.key === 'Escape') cancelEditTask();
                              }}
                              autoFocus
                              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#5B8EFF] bg-[#111224] px-3 text-base font-bold text-white outline-none"
                            />
                            <button
                              onClick={() => confirmEditTask(task.id)}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#4EEDB0]/18 text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/26"
                              title={t('confirm')}
                            >
                              <Icons.Check size={18} />
                            </button>
                            <button
                              onClick={cancelEditTask}
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                              title={adminCopy.cancel}
                            >
                              <Icons.X size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-[#4EEDB0]/14 px-1.5 text-xs font-black text-[#4EEDB0]">
                              {idx + 1}
                            </span>
                            <h3 className="min-w-0 flex-1 truncate text-base font-black text-white">{task.title}</h3>
                            <button
                              onClick={() => startEditTask(task)}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-white/54 transition-colors hover:bg-white/[0.08] hover:text-white"
                              title={lang === 'en' ? 'Edit habit' : '습관 이름 수정'}
                              aria-label={lang === 'en' ? 'Edit habit' : '습관 이름 수정'}
                            >
                              <Icons.Pencil size={15} />
                            </button>
                          </>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => moveTask(idx, 'up')}
                            disabled={idx === 0}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111224] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                            title={adminCopy.moveUp}
                          >
                            <Icons.ChevronUp size={17} />
                          </button>
                          <button
                            onClick={() => moveTask(idx, 'down')}
                            disabled={idx === tasks.length - 1}
                            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#111224] text-white/50 transition-colors hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                            title={adminCopy.moveDown}
                          >
                            <Icons.ChevronDown size={17} />
                          </button>
                          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-2 md:flex-initial md:w-28">
                            <Icons.Coins size={15} className="text-[#FFB830]" />
                            <input
                              type="number"
                              value={task.basePoints}
                              onChange={e => setTasks(prev => prev.map(x => x.id === task.id ? { ...x, basePoints: Number(e.target.value) } : x))}
                              onBlur={e => updateTaskPoints(task.id, Number(e.target.value))}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              min={1}
                              max={999}
                              className="min-w-0 flex-1 bg-transparent text-center text-sm font-black text-white outline-none"
                              aria-label={lang === 'en' ? 'Points' : '포인트'}
                            />
                            <span className="text-xs font-bold text-white/40">pt</span>
                          </label>
                        </div>

                        <div className="grid grid-cols-7 gap-1">
                          {ALL_DAYS.map(day => {
                            const isOn = task.daysOfWeek.includes(day);
                            const isWeekend = day === 'SAT' || day === 'SUN';
                            return (
                              <button
                                key={day}
                                onClick={() => toggleDay(task, day)}
                                className={`h-9 rounded-lg text-[11px] font-black transition-colors sm:h-10 sm:text-xs ${
                                  isOn
                                    ? isWeekend
                                      ? 'bg-[#FF7BAC] text-[#220610]'
                                      : 'bg-[#5B8EFF] text-white'
                                    : 'bg-[#111224] text-white/42 hover:bg-white/[0.07] hover:text-white'
                                }`}
                                title={day}
                              >
                                {DAY_LABELS[lang][day]}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleTask(task)}
                            className={`flex h-10 flex-1 min-w-20 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition-colors md:flex-initial ${
                              isActiveTask
                                ? 'bg-[#4EEDB0]/16 text-[#4EEDB0] hover:bg-[#4EEDB0]/22'
                                : 'bg-white/[0.055] text-white/42 hover:bg-white/[0.08]'
                            }`}
                          >
                            <Icons.Power size={14} />
                            {isActiveTask ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                            title={t('delete')}
                            aria-label={t('delete')}
                          >
                            <Icons.Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-white/8 bg-[#111224] p-1">
                        {([
                          { value: 'morning', label: t('morning'), range: '00:00-12:59', icon: Icons.Sun },
                          { value: 'evening', label: lang === 'en' ? 'Afternoon / evening' : '오후·저녁', range: '13:00-23:59', icon: Icons.Moon },
                        ] as const).map(opt => {
                          const isActive = selectedTimeWindows(task.timeWindow).includes(opt.value);
                          const TimeIcon = opt.icon;
                          return (
                            <button
                              key={String(opt.value)}
                              onClick={() => toggleTimeWindow(task, opt.value)}
                              className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-md px-1.5 text-xs font-black transition-colors ${
                                isActive
                                  ? 'bg-[#4EEDB0] text-[#07120E]'
                                  : 'text-white/45 hover:bg-white/[0.055] hover:text-white'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-1">
                                <TimeIcon size={13} />
                                <span className="truncate">{opt.label}</span>
                              </span>
                              <span className={`mt-0.5 text-[9px] font-bold leading-none ${isActive ? 'text-[#07120E]/70' : 'text-white/32'}`}>
                                {opt.range}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/12 bg-[#111224] px-4 py-8 text-center">
                <Icons.ListPlus className="mx-auto mb-2 text-white/34" size={24} />
                <p className="text-sm font-bold text-white/50">{t('no_tasks')}</p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-[#111224] p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <Icons.PlusCircle size={17} className="text-[#4EEDB0]" />
              <h3 className="text-sm font-black text-white">{t('add_task')}</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_88px_auto]">
              <input
                type="text"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                disabled={isAddingTask}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void addTask();
                  }
                }}
                placeholder={t('task_name_placeholder')}
                className="min-h-[var(--touch-target)] min-w-0 rounded-lg border border-white/10 bg-[#1A1B2E] px-3 text-base font-bold text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
              />
              <input
                type="number"
                value={newTaskPoints}
                onChange={e => setNewTaskPoints(Number(e.target.value))}
                min={1}
                max={100}
                disabled={isAddingTask}
                aria-label={lang === 'en' ? 'Points' : '포인트'}
                className="min-h-[var(--touch-target)] rounded-lg border border-white/10 bg-[#1A1B2E] px-3 text-center font-black text-white outline-none transition-colors focus:border-[#4EEDB0]"
              />
              <button
                type="button"
                onClick={() => { void addTask(); }}
                disabled={isAddingTask || !newTaskTitle.trim()}
                className="inline-flex min-h-[var(--touch-target)] items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-white/36"
              >
                {isAddingTask ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Plus size={16} />}
                {t('add')}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
