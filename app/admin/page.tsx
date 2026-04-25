'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { CrossIcon, ToothbrushIcon, CUSTOM_ICON_MAP } from '@/components/CustomIcons';
import { User, Task, Difficulty, DayOfWeek, ALL_DAYS, WEEKDAYS, WEEKEND } from '@/lib/db';
import { legacyRecurrenceToDays } from '@/lib/db';
import { getEffectiveAdminPinHash, saveAdminPin, verifyPin } from '@/lib/adminPin';
import { resetAllProgress } from '@/lib/reset';
import { deleteCurrentFamilyData } from '@/lib/deleteFamilyData';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

function notifyDashboard() {
  new BroadcastChannel('habit_sync').postMessage('update');
}

type View = 'pin' | 'dashboard';

function pascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

const IconMap = Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;

function LucideIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Custom = CUSTOM_ICON_MAP[name];
  if (Custom) return <Custom size={size} className={className} />;
  const Comp = IconMap[pascalCase(name)] ?? Icons.Circle;
  return <Comp size={size} className={className} />;
}

const ICON_GROUPS: { labelKey: string; labelKo: string; icons: { key: string; label: string }[] }[] = [
  {
    labelKey: 'icon_group_hygiene',
    labelKo: '생활/위생',
    icons: [
      { key: 'sparkles',        label: '양치' },
      { key: 'droplets',        label: '씻기' },
      { key: 'waves',           label: '샤워' },
      { key: 'moon',            label: '수면' },
      { key: 'sun',             label: '아침' },
      { key: 'coffee',          label: '아침식사' },
    ],
  },
  {
    labelKey: 'icon_group_health',
    labelKo: '건강',
    icons: [
      { key: 'pill',            label: '영양제' },
      { key: 'dumbbell',        label: '운동' },
      { key: 'heart',           label: '건강' },
      { key: 'apple',           label: '식단' },
      { key: 'bike',            label: '자전거' },
      { key: 'person-standing', label: '스트레칭' },
    ],
  },
  {
    labelKey: 'icon_group_study',
    labelKo: '학습',
    icons: [
      { key: 'book-open',       label: '독서' },
      { key: 'pen-line',        label: '일기' },
      { key: 'graduation-cap',  label: '공부' },
      { key: 'globe',           label: '영어' },
      { key: 'calculator',      label: '수학' },
      { key: 'microscope',      label: '과학' },
    ],
  },
  {
    labelKey: 'icon_group_chores',
    labelKo: '가정',
    icons: [
      { key: 'house',           label: '집안일' },
      { key: 'shirt',           label: '옷정리' },
      { key: 'utensils-crossed',label: '설거지' },
      { key: 'trash-2',         label: '쓰레기' },
      { key: 'package',         label: '정리' },
      { key: 'blocks',          label: '장난감' },
    ],
  },
  {
    labelKey: 'icon_group_other',
    labelKo: '기타',
    icons: [
      { key: 'cross',           label: '기도' },
      { key: 'music',           label: '음악' },
      { key: 'gamepad-2',       label: '게임' },
      { key: 'star',            label: '특별' },
      { key: 'trophy',          label: '성취' },
      { key: 'zap',             label: '에너지' },
    ],
  },
];

function IconPicker({
  currentIcon,
  onSelect,
  onClose,
}: {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#141821] rounded-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232831] shrink-0">
          <span className="font-semibold text-white text-base">{t('icon_select')}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors"
          >
            <Icons.X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-5">
          {ICON_GROUPS.map(group => (
            <div key={group.labelKo}>
              <p className="text-xs font-semibold text-[#8a8f99] mb-2 uppercase tracking-wide">
                {t(group.labelKey as Parameters<typeof t>[0])}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map(({ key, label }) => {
                  const selected = key === currentIcon;
                  return (
                    <button
                      key={`${group.labelKo}-${key}`}
                      onClick={() => onSelect(key)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                        selected
                          ? 'bg-[#4f9cff] text-white'
                          : 'bg-[#232831] text-[#8a8f99] hover:bg-[#2d3545] hover:text-white'
                      }`}
                      style={{ minHeight: 48 }}
                      title={label}
                    >
                      {key === 'sparkles'
                        ? <ToothbrushIcon size={20} />
                        : key === 'cross'
                          ? <CrossIcon size={20} />
                          : <LucideIcon name={key} size={20} />}
                      <span className="text-[10px] leading-none">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Reward {
  id: string;
  title: string;
  cost_points: number;
  icon: string;
}

function mapTask(r: Record<string, unknown>): Task {
  const rawDays = r.days_of_week as DayOfWeek[] | null | undefined;
  return {
    id: r.id as string,
    userId: r.user_id as string,
    code: (r.code as string | null) ?? undefined,
    title: r.title as string,
    icon: r.icon as string,
    difficulty: r.difficulty as Difficulty,
    basePoints: r.base_points as number,
    recurrence: r.recurrence as string,
    daysOfWeek: (rawDays && rawDays.length > 0) ? rawDays : legacyRecurrenceToDays(r.recurrence as string),
    timeWindow: (r.time_window as 'morning' | 'afternoon' | 'evening' | null) ?? undefined,
    active: r.active as number,
    sortOrder: r.sort_order as number,
  };
}

export default function AdminPage() {
  const { lang, setLang, t } = useLanguage();
  const [view, setView] = useState<View>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isParentAdmin, setIsParentAdmin] = useState(false);
  const [parents, setParents] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPoints, setNewTaskPoints] = useState(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [iconPickerTaskId, setIconPickerTaskId] = useState<string | null>(null);
  // Rewards CRUD state
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardPoints, setNewRewardPoints] = useState(300);
  const [newRewardIcon, setNewRewardIcon] = useState('star');
  const [rewardIconPickerOpen, setRewardIconPickerOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editingRewardTitle, setEditingRewardTitle] = useState('');
  const [editingRewardPoints, setEditingRewardPoints] = useState(0);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyInviteCode, setFamilyInviteCode] = useState<string | null>(null);
  // Admin PIN management
  // undefined = still loading, null = no PIN configured, string = active hash
  const [adminPinHash, setAdminPinHash] = useState<string | null | undefined>(undefined);
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinChanging, setPinChanging] = useState(false);
  const [deletingFamily, setDeletingFamily] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'family' | 'tasks' | 'store'>('settings');
  const storeHydrate = useFamilyStore(s => s.hydrate);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserSupabase();

      // Resolve family for INSERT operations; redirect if setup is incomplete
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: resolvedFamilyId } = await supabase.rpc('get_my_family_id');
      if (!resolvedFamilyId) { router.replace('/setup'); return; }
      setFamilyId(resolvedFamilyId);

      const { data: family } = await supabase
        .from('families')
        .select('id, invite_code')
        .eq('id', resolvedFamilyId)
        .maybeSingle();
      setFamilyInviteCode(family?.invite_code ?? null);

      await supabase.rpc('claim_owner_parent_profile');

      const [userRes, rewardRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('rewards').select('*').order('cost_points'),
      ]);
      const users: User[] = (userRes.data ?? []).map(r => ({
        id: r.id, name: r.name, role: r.role, theme: r.theme,
        avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
        authUserId: r.auth_user_id ?? undefined,
        createdAt: new Date(r.created_at),
      }));
      const parentsList = users.filter(u => u.role === 'PARENT');
      setParents(parentsList);
      setAllUsers(users);
      setRewards((rewardRes.data ?? []).map(r => ({
        id: r.id, title: r.title, cost_points: r.cost_points, icon: r.icon,
      })));
      const { data: parentAllowed } = await supabase.rpc('is_my_family_parent');
      setIsParentAdmin(Boolean(parentAllowed));
      // Load effective admin PIN hash (family_settings → users.pin_hash → env)
      const hash = await getEffectiveAdminPinHash(parentsList);
      setAdminPinHash(hash);
    };
    init();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handleDeleteFamilyData = async () => {
    if (deletingFamily) return;
    const confirmed = confirm(t('danger_zone_confirm'));
    if (!confirmed) return;

    setDeletingFamily(true);
    try {
      await deleteCurrentFamilyData();
      const supabase = createBrowserSupabase();
      await supabase.auth.signOut();
      window.location.href = '/login?deleted=1';
    } catch (error) {
      console.error(error);
      toast.error(t('danger_zone_delete_failed'));
      setDeletingFamily(false);
    }
  };

  const handlePinSubmit = async () => {
    if (adminPinHash === undefined) return; // still loading
    setError('');
    if (!isParentAdmin) {
      setError('Parent account required');
      setPin('');
      return;
    }
    if (adminPinHash === null) {
      setView('dashboard');
      return;
    }
    if (adminPinHash && await verifyPin(pin, adminPinHash)) {
      setView('dashboard');
      return;
    }
    setError(t('pin_incorrect'));
    setPin('');
  };

  const handleChangePin = async () => {
    if (pinChanging) return;
    if (!/^\d{4}$/.test(newPinInput)) {
      toast.error(t('pin_must_be_4_digits'));
      return;
    }
    if (newPinInput !== confirmPinInput) {
      toast.error(t('pin_mismatch'));
      return;
    }
    if (adminPinHash && !await verifyPin(currentPinInput, adminPinHash)) {
      toast.error(t('pin_incorrect'));
      return;
    }
    setPinChanging(true);
    try {
      const newHash = await saveAdminPin(newPinInput);
      setAdminPinHash(newHash);
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      toast.success(t('pin_changed'));
    } catch {
      toast.error(t('pin_change_failed'));
    } finally {
      setPinChanging(false);
    }
  };

  const copyInviteCode = async () => {
    if (!familyInviteCode) return;
    await navigator.clipboard.writeText(familyInviteCode);
    toast.success('Invitation code copied');
  };

  const loadTasks = async (user: User) => {
    setSelectedUser(user);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('sort_order');
    setTasks((data ?? []).map(r => mapTask(r as Record<string, unknown>)));
  };

  const addTask = async () => {
    if (!selectedUser || !newTaskTitle.trim()) return;
    const supabase = createBrowserSupabase();
    const maxSort = tasks.reduce((m, task) => Math.max(m, task.sortOrder), -1);
    const { data, error } = await supabase.rpc('admin_insert_task', {
      p_user_id: selectedUser.id,
      p_title: newTaskTitle.trim(),
      p_icon: 'check-circle',
      p_difficulty: 'MEDIUM',
      p_base_points: newTaskPoints,
      p_recurrence: 'daily',
      p_days_of_week: ALL_DAYS,
      p_active: 1,
      p_sort_order: maxSort + 1,
    });
    if (error) {
      toast.error(`${t('task_add_failed')}: ${error.message}`);
      return;
    }
    if (data) {
      setTasks(prev => [...prev, mapTask(data as Record<string, unknown>)]);
      await storeHydrate();
      router.refresh();
      notifyDashboard();
    }
    setNewTaskTitle('');
    setNewTaskPoints(10);
  };

  const toggleTask = async (task: Task) => {
    const supabase = createBrowserSupabase();
    const newActive = task.active === 1 ? 0 : 1;
    await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { active: newActive } });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, active: newActive } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const deleteTask = async (taskId: string) => {
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_delete_task', { p_task_id: taskId });
    setTasks(prev => prev.filter(task => task.id !== taskId));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const moveTask = async (index: number, dir: 'up' | 'down') => {
    const other = dir === 'up' ? index - 1 : index + 1;
    if (other < 0 || other >= tasks.length) return;
    const supabase = createBrowserSupabase();
    const aOrder = tasks[index].sortOrder;
    const bOrder = tasks[other].sortOrder;
    await Promise.all([
      supabase.rpc('admin_update_task', { p_task_id: tasks[index].id, p_patch: { sort_order: bOrder } }),
      supabase.rpc('admin_update_task', { p_task_id: tasks[other].id, p_patch: { sort_order: aOrder } }),
    ]);
    const updated = tasks.map((task, i) => {
      if (i === index) return { ...task, sortOrder: bOrder };
      if (i === other) return { ...task, sortOrder: aOrder };
      return task;
    });
    setTasks(updated.sort((a, b) => a.sortOrder - b.sortOrder));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskTitle(task.title);
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTaskTitle('');
  };

  const confirmEditTask = async (taskId: string) => {
    const trimmed = editingTaskTitle.trim();
    if (!trimmed) return;
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { title: trimmed } });
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, title: trimmed } : task));
    setEditingTaskId(null);
    setEditingTaskTitle('');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const selectIcon = async (taskId: string, icon: string) => {
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { icon } });
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, icon } : task));
    setIconPickerTaskId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const saveDaysOfWeek = async (task: Task, daysOfWeek: DayOfWeek[]) => {
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { days_of_week: daysOfWeek } });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, daysOfWeek } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const toggleDay = async (task: Task, day: DayOfWeek) => {
    const active = task.daysOfWeek.includes(day);
    if (active && task.daysOfWeek.length === 1) {
      toast.error(t('min_one_day'));
      return;
    }
    const next = active
      ? task.daysOfWeek.filter(d => d !== day)
      : ALL_DAYS.filter(d => task.daysOfWeek.includes(d) || d === day);
    await saveDaysOfWeek(task, next);
  };

  const toggleDayGroup = async (task: Task, group: DayOfWeek[]) => {
    const allPresent = group.every(d => task.daysOfWeek.includes(d));
    const next = allPresent
      ? task.daysOfWeek.filter(d => !group.includes(d))
      : ALL_DAYS.filter(d => task.daysOfWeek.includes(d) || group.includes(d));
    if (next.length === 0) { toast.error(t('min_one_day')); return; }
    await saveDaysOfWeek(task, next);
  };

  const setTimeWindow = async (task: Task, timeWindow: 'morning' | 'evening' | null) => {
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { time_window: timeWindow ?? '' } });
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, timeWindow: timeWindow ?? undefined } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const updateTaskPoints = async (taskId: string, rawValue: number) => {
    const pts = Math.max(1, Math.round(rawValue) || 1);
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { base_points: pts } });
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, basePoints: pts } : task));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const addReward = async () => {
    if (!newRewardTitle.trim()) return;
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.rpc('admin_insert_reward', {
      p_title: newRewardTitle.trim(),
      p_cost_points: Math.max(1, newRewardPoints),
      p_icon: newRewardIcon,
    });
    if (error) { toast.error(`${t('reward_add_failed')}: ${error.message}`); return; }
    if (data) setRewards(prev => [...prev, { id: data.id, title: data.title, cost_points: data.cost_points, icon: data.icon }].sort((a, b) => a.cost_points - b.cost_points));
    setNewRewardTitle('');
    setNewRewardPoints(300);
    setNewRewardIcon('star');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
    toast.success(t('reward_added'));
  };

  const saveRewardEdit = async (rewardId: string) => {
    const trimmed = editingRewardTitle.trim();
    if (!trimmed) return;
    const pts = Math.max(1, Math.round(editingRewardPoints) || 1);
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_reward', { p_reward_id: rewardId, p_title: trimmed, p_cost_points: pts });
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, title: trimmed, cost_points: pts } : r));
    setEditingRewardId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const deleteReward = async (rewardId: string) => {
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_delete_reward', { p_reward_id: rewardId });
    setRewards(prev => prev.filter(r => r.id !== rewardId));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const startEditName = (user: User) => {
    setEditingUserId(user.id);
    setEditingName(user.name);
  };

  const cancelEditName = () => {
    setEditingUserId(null);
    setEditingName('');
  };

  const confirmEditName = async (userId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const supabase = createBrowserSupabase();
    await supabase.rpc('admin_update_user_name', { p_user_id: userId, p_name: trimmed });
    const updated = allUsers.map(u => u.id === userId ? { ...u, name: trimmed } : u);
    setAllUsers(updated);
    setParents(updated.filter(u => u.role === 'PARENT'));
    if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, name: trimmed } : prev);
    setEditingUserId(null);
    setEditingName('');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const pickerTask = iconPickerTaskId ? tasks.find(task => task.id === iconPickerTaskId) : null;

  if (view === 'pin') {
    return (
      <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
        <div className="bg-[#141821] rounded-3xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white mb-2">{t('admin_mode')}</h1>
          <p className="text-[#8a8f99] mb-6 text-sm">{t('enter_parent_pin')}</p>
          {isParentAdmin && adminPinHash === null && (
            <p className="text-[#3ddc97] mb-4 text-sm">
              No Admin PIN is set yet. Press confirm to continue and set one.
            </p>
          )}
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            placeholder="••••"
            className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] mb-4"
            style={{ minHeight: 'var(--touch-target)' }}
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            onClick={handlePinSubmit}
            disabled={adminPinHash === undefined}
            className="w-full rounded-xl bg-[#4f9cff] text-white font-semibold p-4 min-h-[var(--touch-target)] disabled:opacity-50 transition-opacity"
          >
            {adminPinHash === undefined ? '…' : t('confirm')}
          </button>
          {!isParentAdmin && adminPinHash !== undefined && (
            <p className="text-[#8a8f99] text-xs mt-3">
              Sign in with a linked parent profile to manage settings.
            </p>
          )}
          <a href="/" className="block mt-4 text-[#8a8f99] text-sm">← {t('back_to_dashboard')}</a>
        </div>
      </main>
    );
  }

  return (
    <>
      {pickerTask && (
        <IconPicker
          currentIcon={pickerTask.icon}
          onSelect={icon => selectIcon(pickerTask.id, icon)}
          onClose={() => setIconPickerTaskId(null)}
        />
      )}
      {rewardIconPickerOpen && (
        <IconPicker
          currentIcon={newRewardIcon}
          onSelect={icon => { setNewRewardIcon(icon); setRewardIconPickerOpen(false); }}
          onClose={() => setRewardIconPickerOpen(false)}
        />
      )}

      <main className="min-h-screen bg-[#0b0d12] text-white">
        {/* Header */}
        <div className="max-w-4xl mx-auto px-4 pt-6 pb-2 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('admin_mode')}</h1>
          <a href="/" className="text-[#8a8f99] text-sm hover:text-white">← {t('back_to_dashboard')}</a>
        </div>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-40 bg-[#0b0d12]/95 backdrop-blur border-b border-[#232831]">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-1 py-2" style={{ scrollbarWidth: 'none' }}>
              {([
                { key: 'settings', label: '⚙️ Settings' },
                { key: 'family',   label: '👨‍👩‍👧‍👦 Family' },
                { key: 'tasks',    label: '✅ Tasks' },
                { key: 'store',    label: '🎁 Store' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    activeTab === tab.key
                      ? 'bg-[#4f9cff] text-white'
                      : 'text-[#8a8f99] hover:bg-[#232831] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div key={activeTab} className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">

          {/* ─── SETTINGS & SECURITY ─── */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* Family invitation */}
              <div className="bg-[#141821] rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#4f9cff]">Family Invitation</h2>
                    <p className="text-[#8a8f99] text-sm mt-1">
                      Share this code with a family member after they sign in with Google.
                    </p>
                  </div>
                  <Icons.UsersRound className="text-[#4f9cff] shrink-0" size={22} />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 rounded-xl bg-[#232831] border border-[#2d3545] px-4 py-3 min-h-[var(--touch-target)] flex items-center justify-center">
                    <span className="text-white text-2xl font-bold tracking-[0.25em]">
                      {familyInviteCode ?? '------'}
                    </span>
                  </div>
                  <button
                    onClick={copyInviteCode}
                    disabled={!familyInviteCode}
                    className="w-14 rounded-xl bg-[#4f9cff] text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#3d8bed] transition-colors"
                    style={{ minHeight: 'var(--touch-target)' }}
                    title="Copy invitation code"
                  >
                    <Icons.Copy size={20} />
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className="bg-[#141821] rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">Language / 언어 설정</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLang('ko')}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[var(--touch-target)] ${
                      lang === 'ko' ? 'bg-[#4f9cff] text-white' : 'bg-[#232831] text-[#8a8f99] hover:bg-[#2d3545]'
                    }`}
                  >
                    Korean (한국어)
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-colors min-h-[var(--touch-target)] ${
                      lang === 'en' ? 'bg-[#4f9cff] text-white' : 'bg-[#232831] text-[#8a8f99] hover:bg-[#2d3545]'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Change Admin PIN */}
              <div className="bg-[#141821] rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">{t('change_admin_pin')}</h2>
                <div className="space-y-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={currentPinInput}
                    onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('current_pin')}
                    className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newPinInput}
                    onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('new_pin')}
                    className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPinInput}
                    onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('confirm_new_pin')}
                    className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                  />
                  <button
                    onClick={handleChangePin}
                    disabled={pinChanging || !currentPinInput || !newPinInput || !confirmPinInput}
                    className="w-full rounded-xl bg-[#4f9cff] text-white font-semibold p-4 min-h-[var(--touch-target)] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                  >
                    {pinChanging ? '…' : t('change_pin_btn')}
                  </button>
                </div>
              </div>

              {/* Progress Reset */}
              <div className="rounded-2xl p-6 border border-red-900/30 bg-red-900/5">
                <h2 className="text-lg font-semibold mb-2 text-red-400">{t('reset_all_progress')}</h2>
                <p className="text-[#8a8f99] text-sm mb-4">{t('reset_description')}</p>
                <button
                  onClick={async () => {
                    if (!confirm(t('reset_confirm'))) return;
                    await resetAllProgress();
                    localStorage.removeItem('family_progress_reset_v1');
                    toast.success(t('reset_success'));
                    setTimeout(() => { location.href = '/'; }, 1000);
                  }}
                  className="px-6 py-3 rounded-xl bg-red-900/40 text-red-400 font-semibold border border-red-900/60 min-h-[var(--touch-target)] hover:bg-red-900/60 transition-colors"
                >
                  {t('reset_full')}
                </button>
              </div>

              {/* Danger Zone — permanent family data deletion */}
              <div className="rounded-2xl border border-red-800/50 bg-red-950/20 p-6">
                <h2 className="text-lg font-bold text-red-300 mb-2">{t('danger_zone')}</h2>
                <p className="text-sm leading-6 text-[#c8ccd4] mb-4">{t('danger_zone_description')}</p>
                <button
                  onClick={handleDeleteFamilyData}
                  disabled={deletingFamily}
                  className="w-full rounded-xl border border-red-700 bg-red-900/60 px-5 py-4 font-bold text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ minHeight: 'var(--touch-target)' }}
                >
                  {deletingFamily ? t('danger_zone_deleting') : t('danger_zone_button')}
                </button>
              </div>
            </div>
          )}

          {/* ─── FAMILY ─── */}
          {activeTab === 'family' && (
            <div className="bg-[#141821] rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">{t('set_family_names')}</h2>
              <div className="space-y-3">
                {allUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    {editingUserId === u.id ? (
                      <>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') confirmEditName(u.id);
                            if (e.key === 'Escape') cancelEditName();
                          }}
                          autoFocus
                          className="flex-1 rounded-xl bg-[#232831] text-white px-4 outline-none border border-[#4f9cff]"
                          style={{ minHeight: '48px', fontSize: '18px' }}
                        />
                        <button
                          onClick={() => confirmEditName(u.id)}
                          className="w-12 rounded-xl bg-[#3ddc97]/20 text-[#3ddc97] font-bold text-lg flex items-center justify-center hover:bg-[#3ddc97]/30 transition-colors"
                          style={{ minHeight: '48px' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEditName}
                          className="w-12 rounded-xl bg-red-900/30 text-red-400 font-bold text-lg flex items-center justify-center hover:bg-red-900/50 transition-colors"
                          style={{ minHeight: '48px' }}
                        >
                          ✗
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium text-[18px]">{u.name}</span>
                        <span className="text-xs text-[#8a8f99] px-2 py-1 rounded-lg bg-[#232831]">
                          {u.role === 'PARENT' ? t('parent_role') : t('child_role')}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-lg ${
                            u.authUserId
                              ? 'bg-[#3ddc97]/15 text-[#3ddc97]'
                              : 'bg-[#232831] text-[#8a8f99]'
                          }`}
                        >
                          {u.authUserId ? 'Account linked' : 'No account'}
                        </span>
                        <button
                          onClick={() => startEditName(u)}
                          className="w-12 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors"
                          style={{ minHeight: '48px', fontSize: '20px' }}
                        >
                          ✏️
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── TASKS ─── */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              {/* Select user */}
              <div className="bg-[#141821] rounded-2xl p-6">
                <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">{t('select_user')}</h2>
                <div className="flex gap-3 flex-wrap">
                  {allUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => loadTasks(u)}
                      className={`px-5 py-3 rounded-xl font-semibold min-h-[var(--touch-target)] transition-colors ${
                        selectedUser?.id === u.id
                          ? 'bg-[#4f9cff] text-white'
                          : 'bg-[#232831] text-[#e8eaed] hover:bg-[#2d3545]'
                      }`}
                    >
                      {u.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task list */}
              {selectedUser && (
                <div className="bg-[#141821] rounded-2xl p-6">
                  <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">
                    {selectedUser.name}{t('user_tasks_suffix')}
                  </h2>
                  <div className="space-y-3 mb-6">
                    {tasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className={`relative p-4 rounded-xl bg-[#232831] ${task.active === 0 ? 'opacity-50' : ''}`}
                      >
                        {/* Index badge */}
                        <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#4f9cff] text-white text-xs font-bold flex items-center justify-center leading-none select-none">
                          {idx + 1}
                        </span>

                        {/* Icon + title row */}
                        <div className="flex items-center gap-2 mb-2 pl-6">
                          <button
                            onClick={() => setIconPickerTaskId(task.id)}
                            className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#4f9cff] flex items-center justify-center hover:bg-[#2d3545] transition-colors shrink-0 relative group"
                            title={t('icon_change')}
                          >
                            <LucideIcon name={task.icon} size={18} />
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4f9cff] text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              🎨
                            </span>
                          </button>

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
                                className="flex-1 rounded-xl bg-[#1a1f2a] text-white px-3 outline-none border border-[#4f9cff]"
                                style={{ minHeight: 44, fontSize: 16 }}
                              />
                              <button
                                onClick={() => confirmEditTask(task.id)}
                                className="w-11 rounded-xl bg-[#3ddc97]/20 text-[#3ddc97] font-bold text-lg flex items-center justify-center hover:bg-[#3ddc97]/30 transition-colors shrink-0"
                                style={{ minHeight: 44 }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEditTask}
                                className="w-11 rounded-xl bg-red-900/30 text-red-400 font-bold text-lg flex items-center justify-center hover:bg-red-900/50 transition-colors shrink-0"
                                style={{ minHeight: 44 }}
                              >
                                ✗
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 font-medium text-sm leading-snug">{task.title}</span>
                              <button
                                onClick={() => startEditTask(task)}
                                className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors shrink-0 text-base"
                              >
                                ✏️
                              </button>
                            </>
                          )}
                        </div>

                        {/* Order + points + toggle + delete row */}
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            onClick={() => moveTask(idx, 'up')}
                            disabled={idx === 0}
                            className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#8a8f99] flex items-center justify-center text-base hover:bg-[#2d3545] hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveTask(idx, 'down')}
                            disabled={idx === tasks.length - 1}
                            className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#8a8f99] flex items-center justify-center text-base hover:bg-[#2d3545] hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed shrink-0"
                          >
                            ↓
                          </button>
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="number"
                              value={task.basePoints}
                              onChange={e => setTasks(prev => prev.map(x => x.id === task.id ? { ...x, basePoints: Number(e.target.value) } : x))}
                              onBlur={e => updateTaskPoints(task.id, Number(e.target.value))}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              min={1}
                              max={999}
                              className="w-16 rounded-lg bg-[#1a1f2a] text-white text-center text-sm outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[44px]"
                            />
                            <span className="text-[#8a8f99] text-xs">pt</span>
                          </div>
                          <button
                            onClick={() => toggleTask(task)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[44px] ${
                              task.active === 1 ? 'bg-[#3ddc97]/20 text-[#3ddc97]' : 'bg-[#8a8f99]/20 text-[#8a8f99]'
                            }`}
                          >
                            {task.active === 1 ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/30 text-red-400 min-h-[44px]"
                          >
                            {t('delete')}
                          </button>
                        </div>

                        {/* Day-of-week toggles */}
                        <div className="flex gap-1 mb-1">
                          {ALL_DAYS.map(day => {
                            const isOn = task.daysOfWeek.includes(day);
                            const isSat = day === 'SAT';
                            const isSun = day === 'SUN';
                            return (
                              <button
                                key={day}
                                onClick={() => toggleDay(task, day)}
                                className={`flex-1 rounded-lg text-[11px] font-bold transition-colors ${
                                  isOn
                                    ? isSat || isSun
                                      ? 'bg-[#f59e0b] text-[#1a1200]'
                                      : 'bg-[#4f9cff] text-white'
                                    : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                                }`}
                                style={{ minHeight: 36 }}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                        {/* Quick-select helpers */}
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => toggleDayGroup(task, WEEKDAYS)}
                            className={`flex-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                              WEEKDAYS.every(d => task.daysOfWeek.includes(d))
                                ? 'border-[#4f9cff] text-[#4f9cff] bg-[#4f9cff]/10'
                                : 'border-[#2d3545] text-[#8a8f99] bg-[#1a1f2a] hover:bg-[#2d3545]'
                            }`}
                            style={{ minHeight: 30 }}
                          >
                            {t('weekdays_all')}
                          </button>
                          <button
                            onClick={() => toggleDayGroup(task, WEEKEND)}
                            className={`flex-1 rounded-lg text-[11px] font-semibold transition-colors border ${
                              WEEKEND.every(d => task.daysOfWeek.includes(d))
                                ? 'border-[#f59e0b] text-[#f59e0b] bg-[#f59e0b]/10'
                                : 'border-[#2d3545] text-[#8a8f99] bg-[#1a1f2a] hover:bg-[#2d3545]'
                            }`}
                            style={{ minHeight: 30 }}
                          >
                            {t('weekends_all')}
                          </button>
                        </div>

                        {/* Time window row */}
                        <div className="flex gap-2">
                          {([
                            { value: null,      labelKey: 'all_day' },
                            { value: 'morning', labelKey: 'morning' },
                            { value: 'evening', labelKey: 'evening' },
                          ] as const).map(opt => {
                            const isActive = (opt.value === null ? !task.timeWindow : task.timeWindow === opt.value);
                            const label = opt.value === null
                              ? t('all_day')
                              : opt.value === 'morning'
                                ? `🌅 ${t('morning')}`
                                : `🌙 ${t('evening')}`;
                            return (
                              <button
                                key={String(opt.value)}
                                onClick={() => setTimeWindow(task, opt.value)}
                                className={`flex-1 rounded-lg text-sm font-semibold min-h-[44px] transition-colors ${
                                  isActive
                                    ? 'bg-[#f59e0b] text-[#1a1200]'
                                    : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="text-[#8a8f99] text-center py-4">{t('no_tasks')}</p>
                    )}
                  </div>

                  {/* Add new task */}
                  <div className="border-t border-[#232831] pt-4">
                    <h3 className="text-sm font-semibold text-[#8a8f99] mb-3">{t('add_task')}</h3>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={e => setNewTaskTitle(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTask()}
                        placeholder={t('task_name_placeholder')}
                        className="flex-1 rounded-xl bg-[#232831] text-white p-3 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                      />
                      <input
                        type="number"
                        value={newTaskPoints}
                        onChange={e => setNewTaskPoints(Number(e.target.value))}
                        min={1}
                        max={100}
                        className="w-20 rounded-xl bg-[#232831] text-white p-3 outline-none text-center border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                      />
                      <button
                        onClick={addTask}
                        className="px-5 rounded-xl bg-[#4f9cff] text-white font-semibold min-h-[var(--touch-target)]"
                      >
                        {t('add')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── STORE ─── */}
          {activeTab === 'store' && (
            <div className="bg-[#141821] rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">{t('store_management')}</h2>
              <div className="space-y-3 mb-6">
                {rewards.map(r => (
                  <div key={r.id} className="flex items-center gap-2 p-3 rounded-xl bg-[#232831]">
                    <div className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#4f9cff] flex items-center justify-center shrink-0">
                      <LucideIcon name={r.icon} size={18} />
                    </div>
                    {editingRewardId === r.id ? (
                      <>
                        <input
                          type="text"
                          value={editingRewardTitle}
                          onChange={e => setEditingRewardTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveRewardEdit(r.id); if (e.key === 'Escape') setEditingRewardId(null); }}
                          autoFocus
                          className="flex-1 rounded-xl bg-[#1a1f2a] text-white px-3 outline-none border border-[#4f9cff]"
                          style={{ minHeight: 44, fontSize: 15 }}
                        />
                        <input
                          type="number"
                          value={editingRewardPoints}
                          onChange={e => setEditingRewardPoints(Number(e.target.value))}
                          min={1}
                          className="w-20 rounded-xl bg-[#1a1f2a] text-white px-2 outline-none text-center border border-[#4f9cff]"
                          style={{ minHeight: 44 }}
                        />
                        <span className="text-[#8a8f99] text-xs shrink-0">pt</span>
                        <button
                          onClick={() => saveRewardEdit(r.id)}
                          className="w-11 rounded-xl bg-[#3ddc97]/20 text-[#3ddc97] font-bold text-lg flex items-center justify-center hover:bg-[#3ddc97]/30 transition-colors shrink-0"
                          style={{ minHeight: 44 }}
                        >✓</button>
                        <button
                          onClick={() => setEditingRewardId(null)}
                          className="w-11 rounded-xl bg-red-900/30 text-red-400 font-bold text-lg flex items-center justify-center hover:bg-red-900/50 transition-colors shrink-0"
                          style={{ minHeight: 44 }}
                        >✗</button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium text-sm truncate">{r.title}</span>
                        <span className="text-xs text-[#8a8f99] px-2 py-1 rounded-lg bg-[#1a1f2a] shrink-0">{r.cost_points}pt</span>
                        <button
                          onClick={() => { setEditingRewardId(r.id); setEditingRewardTitle(r.title); setEditingRewardPoints(r.cost_points); }}
                          className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors shrink-0 text-base"
                          style={{ minHeight: 44 }}
                        >✏️</button>
                        <button
                          onClick={() => deleteReward(r.id)}
                          className="w-9 h-9 rounded-lg bg-red-900/30 text-red-400 flex items-center justify-center hover:bg-red-900/50 transition-colors shrink-0"
                          style={{ minHeight: 44 }}
                        >
                          <Icons.Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {rewards.length === 0 && (
                  <p className="text-[#8a8f99] text-center py-4">{t('no_rewards_registered')}</p>
                )}
              </div>

              {/* Add new reward */}
              <div className="border-t border-[#232831] pt-4">
                <h3 className="text-sm font-semibold text-[#8a8f99] mb-3">{t('add_new_reward')}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRewardIconPickerOpen(true)}
                    className="w-11 rounded-xl bg-[#232831] text-[#4f9cff] flex items-center justify-center hover:bg-[#2d3545] transition-colors shrink-0 relative group"
                    style={{ minHeight: 'var(--touch-target)' }}
                    title={t('icon_select')}
                  >
                    <LucideIcon name={newRewardIcon} size={20} />
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4f9cff] text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">🎨</span>
                  </button>
                  <input
                    type="text"
                    value={newRewardTitle}
                    onChange={e => setNewRewardTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addReward()}
                    placeholder={t('reward_name_placeholder')}
                    className="flex-1 rounded-xl bg-[#232831] text-white p-3 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                  />
                  <input
                    type="number"
                    value={newRewardPoints}
                    onChange={e => setNewRewardPoints(Number(e.target.value))}
                    min={1}
                    className="w-20 rounded-xl bg-[#232831] text-white p-3 outline-none text-center border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                  />
                  <button
                    onClick={addReward}
                    className="px-4 rounded-xl bg-[#4f9cff] text-white font-semibold min-h-[var(--touch-target)]"
                  >
                    {t('add')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logout — always visible outside tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-6">
          <button
            onClick={handleLogout}
            className="w-full py-4 rounded-2xl bg-[#141821] border border-red-900/30 text-red-400 hover:bg-red-900/10 font-semibold transition-colors"
          >
            {t('logout')}
          </button>
        </div>

      </main>
    </>
  );
}
