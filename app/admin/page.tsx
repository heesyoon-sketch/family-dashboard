'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { CrossIcon, ToothbrushIcon, CUSTOM_ICON_MAP } from '@/components/CustomIcons';
import { User, Task, Difficulty } from '@/lib/db';
import { verifyPin } from '@/lib/pin';
import { resetAllProgress } from '@/lib/reset';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';

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

const ICON_GROUPS: { label: string; icons: { key: string; label: string }[] }[] = [
  {
    label: '생활/위생',
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
    label: '건강',
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
    label: '학습',
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
    label: '가정',
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
    label: '기타',
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#141821] rounded-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232831] shrink-0">
          <span className="font-semibold text-white text-base">아이콘 선택</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors"
          >
            <Icons.X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-5">
          {ICON_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-[#8a8f99] mb-2 uppercase tracking-wide">{group.label}</p>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map(({ key, label }) => {
                  const selected = key === currentIcon;
                  return (
                    <button
                      key={`${group.label}-${key}`}
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
  return {
    id: r.id as string,
    userId: r.user_id as string,
    code: (r.code as string | null) ?? undefined,
    title: r.title as string,
    icon: r.icon as string,
    difficulty: r.difficulty as Difficulty,
    basePoints: r.base_points as number,
    recurrence: r.recurrence as string,
    timeWindow: (r.time_window as 'morning' | 'afternoon' | 'evening' | null) ?? undefined,
    active: r.active as number,
    sortOrder: r.sort_order as number,
  };
}

export default function AdminPage() {
  const [view, setView] = useState<View>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
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
  const storeHydrate = useFamilyStore(s => s.hydrate);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserSupabase();
      const [userRes, rewardRes] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('rewards').select('*').order('cost_points'),
      ]);
      const users: User[] = (userRes.data ?? []).map(r => ({
        id: r.id, name: r.name, role: r.role, theme: r.theme,
        avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
        createdAt: new Date(r.created_at),
      }));
      setParents(users.filter(u => u.role === 'PARENT'));
      setAllUsers(users);
      setRewards((rewardRes.data ?? []).map(r => ({
        id: r.id, title: r.title, cost_points: r.cost_points, icon: r.icon,
      })));
    };
    init();
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const handlePinSubmit = async () => {
    setError('');
    for (const parent of parents) {
      if (parent.pinHash && await verifyPin(pin, parent.pinHash)) {
        setView('dashboard');
        return;
      }
    }
    setError('PIN이 올바르지 않습니다');
    setPin('');
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
    const maxSort = tasks.reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const newTask = {
      id: crypto.randomUUID(),
      user_id: selectedUser.id,
      title: newTaskTitle.trim(),
      icon: 'check-circle',
      difficulty: 'MEDIUM' as Difficulty,
      base_points: newTaskPoints,
      recurrence: 'daily',
      active: 1,
      sort_order: maxSort + 1,
    };
    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    if (error) {
      toast.error(`태스크 추가 실패: ${error.message}`);
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
    await supabase.from('tasks').update({ active: newActive }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, active: newActive } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const deleteTask = async (taskId: string) => {
    const supabase = createBrowserSupabase();
    await supabase.from('tasks').delete().eq('id', taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
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
      supabase.from('tasks').update({ sort_order: bOrder }).eq('id', tasks[index].id),
      supabase.from('tasks').update({ sort_order: aOrder }).eq('id', tasks[other].id),
    ]);
    const updated = tasks.map((t, i) => {
      if (i === index) return { ...t, sortOrder: bOrder };
      if (i === other) return { ...t, sortOrder: aOrder };
      return t;
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
    await supabase.from('tasks').update({ title: trimmed }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: trimmed } : t));
    setEditingTaskId(null);
    setEditingTaskTitle('');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const selectIcon = async (taskId: string, icon: string) => {
    const supabase = createBrowserSupabase();
    await supabase.from('tasks').update({ icon }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, icon } : t));
    setIconPickerTaskId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const setRecurrence = async (task: Task, recurrence: string) => {
    const supabase = createBrowserSupabase();
    await supabase.from('tasks').update({ recurrence }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, recurrence } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const setTimeWindow = async (task: Task, timeWindow: 'morning' | 'evening' | null) => {
    const supabase = createBrowserSupabase();
    await supabase.from('tasks').update({ time_window: timeWindow }).eq('id', task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, timeWindow: timeWindow ?? undefined } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const updateTaskPoints = async (taskId: string, rawValue: number) => {
    const pts = Math.max(1, Math.round(rawValue) || 1);
    const supabase = createBrowserSupabase();
    await supabase.from('tasks').update({ base_points: pts }).eq('id', taskId);
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, basePoints: pts } : t));
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const addReward = async () => {
    if (!newRewardTitle.trim()) return;
    const supabase = createBrowserSupabase();
    const payload = {
      id: crypto.randomUUID(),
      title: newRewardTitle.trim(),
      cost_points: Math.max(1, newRewardPoints),
      icon: newRewardIcon,
    };
    const { data, error } = await supabase.from('rewards').insert(payload).select().single();
    if (error) { toast.error(`리워드 추가 실패: ${error.message}`); return; }
    if (data) setRewards(prev => [...prev, { id: data.id, title: data.title, cost_points: data.cost_points, icon: data.icon }].sort((a, b) => a.cost_points - b.cost_points));
    setNewRewardTitle('');
    setNewRewardPoints(300);
    setNewRewardIcon('star');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
    toast.success('리워드 추가 완료');
  };

  const saveRewardEdit = async (rewardId: string) => {
    const trimmed = editingRewardTitle.trim();
    if (!trimmed) return;
    const pts = Math.max(1, Math.round(editingRewardPoints) || 1);
    const supabase = createBrowserSupabase();
    await supabase.from('rewards').update({ title: trimmed, cost_points: pts }).eq('id', rewardId);
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, title: trimmed, cost_points: pts } : r));
    setEditingRewardId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const deleteReward = async (rewardId: string) => {
    const supabase = createBrowserSupabase();
    await supabase.from('rewards').delete().eq('id', rewardId);
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
    await supabase.from('users').update({ name: trimmed }).eq('id', userId);
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

  const pickerTask = iconPickerTaskId ? tasks.find(t => t.id === iconPickerTaskId) : null;

  if (view === 'pin') {
    return (
      <main className="min-h-screen bg-[#0b0d12] flex items-center justify-center p-6">
        <div className="bg-[#141821] rounded-3xl p-8 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white mb-2">관리자 모드</h1>
          <p className="text-[#8a8f99] mb-6 text-sm">부모 PIN을 입력하세요</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => setPin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
            placeholder="PIN"
            className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] mb-4"
            style={{ minHeight: 'var(--touch-target)' }}
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            onClick={handlePinSubmit}
            className="w-full rounded-xl bg-[#4f9cff] text-white font-semibold p-4 min-h-[var(--touch-target)]"
          >
            확인
          </button>
          <a href="/" className="block mt-4 text-[#8a8f99] text-sm">← 대시보드로</a>
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

      <main className="min-h-screen bg-[#0b0d12] text-white p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold">관리자 모드</h1>
            <a href="/" className="text-[#8a8f99] text-sm hover:text-white">← 대시보드로</a>
          </div>

          {/* 가족 구성원 이름 설정 */}
          <div className="bg-[#141821] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">가족 구성원 이름 설정</h2>
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
                        {u.role === 'PARENT' ? '부모' : '자녀'}
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

          {/* 사용자 선택 */}
          <div className="bg-[#141821] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">사용자 선택</h2>
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

          {/* 전체 리셋 */}
          <div className="bg-[#141821] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-2 text-red-400">전체 진행 리셋</h2>
            <p className="text-[#8a8f99] text-sm mb-4">포인트·레벨·완료 기록·스트릭을 모두 초기화합니다.</p>
            <button
              onClick={async () => {
                if (!confirm('모든 진행 기록을 초기화할까요? 되돌릴 수 없습니다.')) return;
                await resetAllProgress();
                localStorage.removeItem('family_progress_reset_v1');
                toast.success('초기화 완료! 대시보드로 이동합니다.');
                setTimeout(() => { location.href = '/'; }, 1000);
              }}
              className="px-6 py-3 rounded-xl bg-red-900/40 text-red-400 font-semibold border border-red-900/60 min-h-[var(--touch-target)] hover:bg-red-900/60 transition-colors"
            >
              전체 리셋
            </button>
          </div>

          {/* 상점 관리 */}
          <div className="bg-[#141821] rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">상점 관리</h2>
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
                <p className="text-[#8a8f99] text-center py-4">등록된 리워드 없음</p>
              )}
            </div>

            {/* 새 리워드 추가 */}
            <div className="border-t border-[#232831] pt-4">
              <h3 className="text-sm font-semibold text-[#8a8f99] mb-3">새 리워드 추가</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setRewardIconPickerOpen(true)}
                  className="w-11 rounded-xl bg-[#232831] text-[#4f9cff] flex items-center justify-center hover:bg-[#2d3545] transition-colors shrink-0 relative group"
                  style={{ minHeight: 'var(--touch-target)' }}
                  title="아이콘 선택"
                >
                  <LucideIcon name={newRewardIcon} size={20} />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4f9cff] text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">🎨</span>
                </button>
                <input
                  type="text"
                  value={newRewardTitle}
                  onChange={e => setNewRewardTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addReward()}
                  placeholder="리워드 이름"
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
                  추가
                </button>
              </div>
            </div>
          </div>

          {/* Task 목록 */}
          {selectedUser && (
            <div className="bg-[#141821] rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">
                {selectedUser.name}의 태스크
              </h2>
              <div className="space-y-3 mb-6">
                {tasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`relative p-4 rounded-xl bg-[#232831] ${t.active === 0 ? 'opacity-50' : ''}`}
                  >
                    {/* 번호 뱃지 */}
                    <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[#4f9cff] text-white text-xs font-bold flex items-center justify-center leading-none select-none">
                      {idx + 1}
                    </span>

                    {/* 아이콘 + 제목 행 */}
                    <div className="flex items-center gap-2 mb-2 pl-6">
                      <button
                        onClick={() => setIconPickerTaskId(t.id)}
                        className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#4f9cff] flex items-center justify-center hover:bg-[#2d3545] transition-colors shrink-0 relative group"
                        title="아이콘 변경"
                      >
                        <LucideIcon name={t.icon} size={18} />
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4f9cff] text-white text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          🎨
                        </span>
                      </button>

                      {editingTaskId === t.id ? (
                        <>
                          <input
                            type="text"
                            value={editingTaskTitle}
                            onChange={e => setEditingTaskTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') confirmEditTask(t.id);
                              if (e.key === 'Escape') cancelEditTask();
                            }}
                            autoFocus
                            className="flex-1 rounded-xl bg-[#1a1f2a] text-white px-3 outline-none border border-[#4f9cff]"
                            style={{ minHeight: 44, fontSize: 16 }}
                          />
                          <button
                            onClick={() => confirmEditTask(t.id)}
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
                          <span className="flex-1 font-medium text-sm leading-snug">{t.title}</span>
                          <button
                            onClick={() => startEditTask(t)}
                            className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors shrink-0 text-base"
                          >
                            ✏️
                          </button>
                        </>
                      )}
                    </div>

                    {/* 순서 + 포인트 + 토글 + 삭제 행 */}
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
                          value={t.basePoints}
                          onChange={e => setTasks(prev => prev.map(x => x.id === t.id ? { ...x, basePoints: Number(e.target.value) } : x))}
                          onBlur={e => updateTaskPoints(t.id, Number(e.target.value))}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          min={1}
                          max={999}
                          className="w-16 rounded-lg bg-[#1a1f2a] text-white text-center text-sm outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[44px]"
                        />
                        <span className="text-[#8a8f99] text-xs">pt</span>
                      </div>
                      <button
                        onClick={() => toggleTask(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[44px] ${
                          t.active === 1 ? 'bg-[#3ddc97]/20 text-[#3ddc97]' : 'bg-[#8a8f99]/20 text-[#8a8f99]'
                        }`}
                      >
                        {t.active === 1 ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => deleteTask(t.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-900/30 text-red-400 min-h-[44px]"
                      >
                        삭제
                      </button>
                    </div>

                    {/* 반복 주기 행 */}
                    <div className="flex gap-2 mb-2">
                      {([
                        { value: 'daily',    label: '매일' },
                        { value: 'weekdays', label: '주중만' },
                        { value: 'weekend',  label: '주말만' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setRecurrence(t, opt.value)}
                          className={`flex-1 rounded-lg text-sm font-semibold min-h-[44px] transition-colors ${
                            t.recurrence === opt.value
                              ? 'bg-[#4f9cff] text-white'
                              : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* 시간대 설정 행 */}
                    <div className="flex gap-2">
                      {([
                        { value: null,       label: '종일' },
                        { value: 'morning',  label: '🌅 아침' },
                        { value: 'evening',  label: '🌙 저녁' },
                      ] as const).map(opt => {
                        const isActive = (opt.value === null ? !t.timeWindow : t.timeWindow === opt.value);
                        return (
                          <button
                            key={String(opt.value)}
                            onClick={() => setTimeWindow(t, opt.value)}
                            className={`flex-1 rounded-lg text-sm font-semibold min-h-[44px] transition-colors ${
                              isActive
                                ? 'bg-[#f59e0b] text-[#1a1200]'
                                : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {tasks.length === 0 && (
                  <p className="text-[#8a8f99] text-center py-4">태스크 없음</p>
                )}
              </div>

              {/* 새 태스크 추가 */}
              <div className="border-t border-[#232831] pt-4">
                <h3 className="text-sm font-semibold text-[#8a8f99] mb-3">새 태스크 추가</h3>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="태스크 이름"
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
                    추가
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="w-full py-4 mt-8 rounded-2xl bg-[#141821] border border-red-900/30 text-red-400 hover:bg-red-900/10 font-semibold transition-colors"
          >
            로그아웃
          </button>
        </div>
      </main>
    </>
  );
}
