'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { CrossIcon, ToothbrushIcon, CUSTOM_ICON_MAP } from '@/components/CustomIcons';
import { AuthProfileAvatar } from '@/components/AuthProfileAvatar';
import { User, Task, Reward, Difficulty, DayOfWeek, ALL_DAYS, WEEKDAYS, WEEKEND, ThemeName, UserRole } from '@/lib/db';
import { legacyRecurrenceToDays } from '@/lib/db';
import { getCurrentFamilyAdminPinHash, saveAdminPin, verifyPin } from '@/lib/adminPin';
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
    labelKey: 'icon_group_store',
    labelKo: '상점/보상',
    icons: [
      { key: 'gift',              label: '선물' },
      { key: 'party-popper',      label: '파티' },
      { key: 'badge-percent',     label: '할인' },
      { key: 'tags',              label: '태그' },
      { key: 'ticket-percent',    label: '쿠폰' },
      { key: 'ticket',            label: '티켓' },
      { key: 'shopping-bag',      label: '쇼핑백' },
      { key: 'shopping-cart',     label: '카트' },
      { key: 'store',             label: '상점' },
      { key: 'wallet',            label: '지갑' },
      { key: 'coins',             label: '코인' },
      { key: 'gem',               label: '보석' },
      { key: 'crown',             label: '왕관' },
      { key: 'medal',             label: '메달' },
      { key: 'award',             label: '상장' },
      { key: 'ribbon',            label: '리본' },
      { key: 'sparkles',          label: '반짝' },
      { key: 'wand-sparkles',     label: '마법' },
      { key: 'ice-cream',         label: '아이스크림' },
      { key: 'cake-slice',        label: '케이크' },
      { key: 'cookie',            label: '쿠키' },
      { key: 'candy',             label: '사탕' },
      { key: 'popcorn',           label: '팝콘' },
      { key: 'pizza',             label: '피자' },
      { key: 'sandwich',          label: '간식' },
      { key: 'cup-soda',          label: '음료' },
      { key: 'milk',              label: '우유' },
      { key: 'utensils',          label: '외식' },
      { key: 'gamepad-2',         label: '게임' },
      { key: 'joystick',          label: '조이스틱' },
      { key: 'tv',                label: 'TV' },
      { key: 'film',              label: '영화' },
      { key: 'clapperboard',      label: '극장' },
      { key: 'headphones',        label: '음악' },
      { key: 'music',             label: '노래' },
      { key: 'book-open',         label: '책' },
      { key: 'paintbrush',        label: '미술' },
      { key: 'palette',           label: '팔레트' },
      { key: 'puzzle',            label: '퍼즐' },
      { key: 'blocks',            label: '블록' },
      { key: 'car',               label: '드라이브' },
      { key: 'bike',              label: '자전거' },
      { key: 'plane',             label: '여행' },
      { key: 'map',               label: '나들이' },
      { key: 'tent',              label: '캠핑' },
      { key: 'trees',             label: '공원' },
      { key: 'camera',            label: '사진' },
      { key: 'shirt',             label: '옷' },
      { key: 'heart-handshake',   label: '약속' },
      { key: 'smile-plus',        label: '기쁨' },
    ],
  },
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
      { key: 'bed',             label: '침대정리' },
      { key: 'bath',            label: '목욕' },
      { key: 'washing-machine', label: '빨래' },
      { key: 'spray-can',       label: '청소' },
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
      { key: 'footprints',      label: '산책' },
      { key: 'salad',           label: '채소' },
      { key: 'glass-water',     label: '물마시기' },
      { key: 'shield-check',    label: '안전' },
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
      { key: 'languages',       label: '언어' },
      { key: 'palette',         label: '미술' },
      { key: 'notebook-pen',    label: '숙제' },
      { key: 'brain',           label: '암기' },
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
      { key: 'leaf',            label: '식물' },
      { key: 'shopping-basket', label: '장보기' },
      { key: 'chef-hat',        label: '요리' },
      { key: 'hand-heart',      label: '도움' },
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
      { key: 'smile',           label: '친절' },
      { key: 'message-circle',  label: '대화' },
      { key: 'timer',           label: '집중' },
      { key: 'calendar-check',  label: '계획' },
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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'not_found';

function normaliseSalePercentage(value: unknown): number {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function mapReward(row: Record<string, unknown>): Reward {
  const saleName = typeof row.sale_name === 'string' && row.sale_name.trim()
    ? row.sale_name.trim()
    : undefined;
  return {
    id: row.id as string,
    title: (row.title ?? row.name ?? '') as string,
    cost_points: Number(row.cost_points ?? 0),
    icon: (row.icon ?? 'gift') as string,
    sale_percentage: normaliseSalePercentage(row.sale_percentage),
    sale_name: saleName,
  };
}

function withAvatarCache(url: string | undefined, version: number): string | undefined {
  if (!url) return undefined;
  return `${url}${url.includes('?') ? '&' : '?'}v=${version}`;
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
    streakCount: (r.streak_count as number | null) ?? 0,
    lastCompletedAt: r.last_completed_at ? new Date(r.last_completed_at as string) : null,
  };
}

export default function AdminPage() {
  const { lang, setLang, t } = useLanguage();
  const [view, setView] = useState<View>('pin');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isParentAdmin, setIsParentAdmin] = useState(false);
  const [isFamilyOwner, setIsFamilyOwner] = useState(false);
  const [pinResetLoading, setPinResetLoading] = useState(false);
  const [pinResetStep, setPinResetStep] = useState<'idle' | 'otp_sent'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [authProfile, setAuthProfile] = useState<{ email: string | null; avatarUrl: string | null }>({
    email: null,
    avatarUrl: null,
  });
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
  const [newRewardTitle, setNewRewardTitle] = useState('');
  const [newRewardPoints, setNewRewardPoints] = useState(300);
  const [newRewardIcon, setNewRewardIcon] = useState('star');
  const [rewardIconPickerOpen, setRewardIconPickerOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editingRewardTitle, setEditingRewardTitle] = useState('');
  const [savingRewardId, setSavingRewardId] = useState<string | null>(null);
  const [rewardSaveStatus, setRewardSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [rewardCostDrafts, setRewardCostDrafts] = useState<Record<string, number>>({});
  const [rewardSalePercentageDrafts, setRewardSalePercentageDrafts] = useState<Record<string, number>>({});
  const [rewardSaleNameDrafts, setRewardSaleNameDrafts] = useState<Record<string, string>>({});
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
  const [leavingFamily, setLeavingFamily] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'family' | 'tasks' | 'store'>('settings');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<UserRole>('CHILD');
  const [avatarUploadingUserId, setAvatarUploadingUserId] = useState<string | null>(null);
  const [avatarUploadTargetId, setAvatarUploadTargetId] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const addMemberInFlightRef = useRef(false);
  const addTaskInFlightRef = useRef(false);
  const storeHydrate = useFamilyStore(s => s.hydrate);
  const familyName = useFamilyStore(s => s.familyName);
  const rewards = useFamilyStore(s => s.rewards);
  const setRewards = (updater: Reward[] | ((prev: Reward[]) => Reward[])) => {
    useFamilyStore.setState(state => ({
      rewards: typeof updater === 'function'
        ? (updater as (prev: Reward[]) => Reward[])(state.rewards)
        : updater,
    }));
  };
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const supabase = createBrowserSupabase();

      // Resolve family for INSERT operations; redirect if setup is incomplete
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setCurrentAuthUserId(user.id);
      setAuthProfile({
        email: user.email ?? null,
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
      const { data: resolvedFamilyId } = await supabase.rpc('get_my_family_id');
      if (!resolvedFamilyId) { router.replace('/setup'); return; }
      setFamilyId(resolvedFamilyId);
      const hash = await getCurrentFamilyAdminPinHash();
      if (!hash) {
        router.replace('/setup/set-pin');
        return;
      }
      setAdminPinHash(hash);

      const { data: family } = await supabase
        .from('families')
        .select('id, invite_code, name')
        .eq('id', resolvedFamilyId)
        .maybeSingle();
      const { data: resolvedFamilyName } = await supabase.rpc('get_my_family_name');
      setFamilyInviteCode(family?.invite_code ?? null);
      useFamilyStore.setState({ familyName: (resolvedFamilyName as string | null) ?? family?.name ?? null });

      await supabase.rpc('claim_owner_parent_profile');

      const [userRes, rewardRes] = await Promise.all([
        supabase.from('users').select('*').eq('family_id', resolvedFamilyId).order('display_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('rewards').select('*').eq('family_id', resolvedFamilyId).order('cost_points'),
      ]);
      const users: User[] = (userRes.data ?? []).map(r => ({
        id: r.id, name: r.name, role: r.role, theme: r.theme,
        avatarUrl: r.avatar_url ?? undefined, pinHash: r.pin_hash ?? undefined,
        email: r.email ?? undefined,
        authUserId: r.auth_user_id ?? undefined,
        loginMethod: r.login_method ?? undefined,
        displayOrder: r.display_order ?? 0,
        createdAt: new Date(r.created_at),
      }));
      setAllUsers(users);
      setRewards((rewardRes.data ?? []).map(r => mapReward(r as Record<string, unknown>)));
      const [{ data: parentAllowed }, { data: ownerAllowed }] = await Promise.all([
        supabase.rpc('is_my_family_parent'),
        supabase.rpc('is_family_owner'),
      ]);
      setIsParentAdmin(Boolean(parentAllowed));
      setIsFamilyOwner(Boolean(ownerAllowed));
    };
    init();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleDeleteFamilyData = async () => {
    if (deletingFamily) return;
    const confirmed = confirm(t('danger_zone_confirm'));
    if (!confirmed) return;

    setDeletingFamily(true);
    try {
      const supabase = createBrowserSupabase();
      if (isFamilyOwner) {
        // Use owner-privileged RPC — bypasses is_my_family_parent check
        const { error } = await supabase.rpc('admin_delete_family');
        if (error) throw error;
      } else {
        await deleteCurrentFamilyData();
      }
      localStorage.clear();
      useFamilyStore.getState().reset();
      window.location.href = '/setup';
    } catch (error) {
      console.error(error);
      toast.error(t('danger_zone_delete_failed'));
      setDeletingFamily(false);
    }
  };

  const handleLeaveFamily = async () => {
    if (leavingFamily) return;
    const confirmed = confirm(
      '가족 공간에서 나가시겠습니까?\n\n현재 Google 계정과 이 가족 멤버 프로필의 연결만 해제됩니다. 가족 데이터는 삭제되지 않습니다.'
    );
    if (!confirmed) return;

    setLeavingFamily(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.rpc('leave_current_family');
      if (error) throw error;

      localStorage.clear();
      useFamilyStore.getState().reset();
      window.location.href = '/setup';
    } catch (error) {
      console.error(error);
      toast.error('가족 공간에서 나갈 수 없습니다');
      setLeavingFamily(false);
    }
  };

  const handlePinSubmit = async () => {
    if (adminPinHash === undefined) return; // still loading
    setError('');
    if (!isParentAdmin && !isFamilyOwner) {
      setError('Parent account required');
      setPin('');
      return;
    }
    if (adminPinHash && await verifyPin(pin, adminPinHash)) {
      setView('dashboard');
      return;
    }
    setError(t('pin_incorrect'));
    setPin('');
  };

  const handlePinReset = async () => {
    if (!isFamilyOwner || pinResetLoading) return;
    const email = authProfile.email;
    if (!email) {
      toast.error('이메일 주소를 확인할 수 없습니다.');
      return;
    }
    setPinResetLoading(true);
    try {
      const supabase = createBrowserSupabase();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      setPinResetStep('otp_sent');
      setOtpCode('');
      setOtpError('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'OTP 전송 실패');
    } finally {
      setPinResetLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otpLoading || !authProfile.email) return;
    if (!/^\d{6}$/.test(otpCode)) {
      setOtpError('6자리 숫자를 입력하세요.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const supabase = createBrowserSupabase();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: authProfile.email,
        token: otpCode,
        type: 'email',
      });
      if (verifyError) throw verifyError;
      const { error: rpcError } = await supabase.rpc('admin_clear_pin_for_owner');
      if (rpcError) throw rpcError;
      setAdminPinHash(null);
      window.location.href = '/setup/set-pin';
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : '인증 실패. 코드를 다시 확인하세요.');
    } finally {
      setOtpLoading(false);
    }
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
    // Family owner can set a new PIN without knowing the old one
    if (!isFamilyOwner && adminPinHash && !await verifyPin(currentPinInput, adminPinHash)) {
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

  const generateInviteCode = async () => {
    if (generatingCode || !familyId) return;
    setGeneratingCode(true);
    try {
      const supabase = createBrowserSupabase();
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const { error } = await supabase.from('families').update({ invite_code: code }).eq('id', familyId);
      if (error) throw error;
      setFamilyInviteCode(code);
      toast.success('새 초대 코드가 생성되었습니다');
    } catch {
      toast.error('코드 생성에 실패했습니다');
    } finally {
      setGeneratingCode(false);
    }
  };

  const addMember = async () => {
    if (addMemberInFlightRef.current) return;
    const trimmed = newMemberName.trim();
    if (!trimmed || !familyId) return;

    addMemberInFlightRef.current = true;
    setIsAddingMember(true);
    try {
      const supabase = createBrowserSupabase();
      const usedThemes = new Set(allUsers.map(u => u.theme));
      const allThemes: ThemeName[] = ['dark_minimal', 'warm_minimal', 'robot_neon', 'pastel_cute'];
      const theme = allThemes.find(t => !usedThemes.has(t)) ?? 'pastel_cute';
      const nextDisplayOrder = allUsers.reduce((max, u) => Math.max(max, u.displayOrder), -1) + 1;
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: crypto.randomUUID(),
          name: trimmed,
          role: newMemberRole,
          theme,
          family_id: familyId,
          login_method: 'device',
          display_order: nextDisplayOrder,
          created_at: new Date().toISOString(),
        })
        .select().single();
      if (error) { toast.error(`멤버 추가 실패: ${error.message}`); return; }
      const newUser: User = {
        id: data.id, name: data.name, role: data.role as UserRole, theme: data.theme as ThemeName,
        avatarUrl: data.avatar_url ?? undefined, pinHash: data.pin_hash ?? undefined,
        email: data.email ?? undefined,
        authUserId: data.auth_user_id ?? undefined,
        loginMethod: data.login_method ?? undefined,
        displayOrder: data.display_order ?? nextDisplayOrder,
        createdAt: new Date(data.created_at),
      };
      setAllUsers(prev => (
        prev.some(u => u.id === newUser.id)
          ? prev
          : [...prev, newUser].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime())
      ));
      setNewMemberName('');
      setAddingMember(false);
      await storeHydrate();
      notifyDashboard();
      toast.success(`'${trimmed}' 프로필이 추가되었습니다`);
    } finally {
      addMemberInFlightRef.current = false;
      setIsAddingMember(false);
    }
  };

  const removeMember = async (userId: string) => {
    const target = allUsers.find(u => u.id === userId);
    if (!target) return;
    if (target.authUserId && target.authUserId === currentAuthUserId) {
      toast.error('현재 로그인한 관리자 본인 프로필은 삭제할 수 없습니다');
      return;
    }
    // First confirmation
    if (!confirm(
      `⚠️ '${target.name}' 멤버를 삭제하려고 합니다.\n\n` +
      `• 이 멤버의 모든 습관, 기록, 포인트가 영구 삭제됩니다.\n` +
      `• 공동 관리자 계정에서도 함께 삭제됩니다.\n` +
      `• 복구가 불가능합니다.\n\n` +
      `계속하려면 확인을 누르세요.`
    )) return;
    // Second confirmation — type the name to confirm
    const typed = window.prompt(
      `정말 삭제하시겠습니까?\n아래 칸에 '${target.name}'을(를) 직접 입력하면 삭제됩니다.`
    );
    if (typed?.trim() !== target.name) {
      if (typed !== null) toast.error('이름이 일치하지 않아 삭제가 취소되었습니다.');
      return;
    }
    const supabase = createBrowserSupabase();
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    await storeHydrate();
    notifyDashboard();
  };

  const sortedUsers = [...allUsers].sort((a, b) =>
    a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime()
  );

  const moveMember = async (userId: string, direction: -1 | 1) => {
    const currentIndex = sortedUsers.findIndex(u => u.id === userId);
    const swapIndex = currentIndex + direction;
    if (currentIndex < 0 || swapIndex < 0 || swapIndex >= sortedUsers.length) return;

    const current = sortedUsers[currentIndex];
    const other = sortedUsers[swapIndex];
    const currentOrder = current.displayOrder;
    const otherOrder = other.displayOrder;
    const reordered = sortedUsers.map(u => {
      if (u.id === current.id) return { ...u, displayOrder: otherOrder };
      if (u.id === other.id) return { ...u, displayOrder: currentOrder };
      return u;
    }).sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime());

    setAllUsers(reordered);
    try {
      const supabase = createBrowserSupabase();
      const { error: firstError } = await supabase
        .from('users')
        .update({ display_order: otherOrder })
        .eq('id', current.id);
      if (firstError) throw firstError;

      const { error: secondError } = await supabase
        .from('users')
        .update({ display_order: currentOrder })
        .eq('id', other.id);
      if (secondError) throw secondError;

      await storeHydrate();
      router.refresh();
      notifyDashboard();
    } catch (error) {
      console.error('Failed to reorder members', error);
      setAllUsers(sortedUsers);
      toast.error('순서 변경에 실패했습니다');
    }
  };

  const openAvatarUpload = (userId: string) => {
    setAvatarUploadTargetId(userId);
    avatarInputRef.current?.click();
  };

  const handleAvatarUpload = async (file: File | undefined) => {
    const userId = avatarUploadTargetId;
    if (!file || !userId || !familyId || avatarUploadingUserId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일을 선택해주세요');
      return;
    }

    setAvatarUploadingUserId(userId);
    try {
      const supabase = createBrowserSupabase();
      const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${familyId}/${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('member-avatars')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('member-avatars').getPublicUrl(path);
      const avatarUrl = data.publicUrl;
      const { error: updateError } = await supabase.rpc('update_member_avatar', {
        p_member_id: userId,
        p_avatar_url: avatarUrl,
      });
      if (updateError) throw updateError;

      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, avatarUrl } : u));
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, avatarUrl } : prev);
      setAvatarVersion(Date.now());
      await storeHydrate();
      router.refresh();
      notifyDashboard();
      toast.success('프로필 사진이 업데이트되었습니다');
    } catch (err) {
      const sbErr = err as { message?: string; error?: string; statusCode?: string | number };
      console.error('Avatar upload failed', {
        message:    sbErr?.message,
        error:      sbErr?.error,
        statusCode: sbErr?.statusCode,
        raw:        err,
      });
      toast.error(`프로필 사진 업로드에 실패했습니다: ${sbErr?.message ?? String(err)}`);
    } finally {
      setAvatarUploadingUserId(null);
      setAvatarUploadTargetId(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const loadTasks = async (user: User) => {
    setSelectedUser(user);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('sort_order');
    setTasks((data ?? []).map(r => mapTask(r as Record<string, unknown>)));
  };

  const addTask = async () => {
    if (addTaskInFlightRef.current) return;
    if (!selectedUser || !newTaskTitle.trim()) return;

    addTaskInFlightRef.current = true;
    setIsAddingTask(true);
    try {
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
        const newTask = mapTask(data as Record<string, unknown>);
        setTasks(prev => (
          prev.some(task => task.id === newTask.id)
            ? prev
            : [...prev, newTask].sort((a, b) => a.sortOrder - b.sortOrder)
        ));
        await storeHydrate();
        router.refresh();
        notifyDashboard();
      }
      setNewTaskTitle('');
      setNewTaskPoints(10);
    } finally {
      addTaskInFlightRef.current = false;
      setIsAddingTask(false);
    }
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
      p_sale_percentage: 0,
      p_sale_name: null,
    });
    if (error) { toast.error(`${t('reward_add_failed')}: ${error.message}`); return; }
    if (data) {
      const inserted = mapReward(data as Record<string, unknown>);
      setRewards(prev => [...prev, inserted].sort((a, b) => a.cost_points - b.cost_points));
    }
    setNewRewardTitle('');
    setNewRewardPoints(300);
    setNewRewardIcon('star');
    await storeHydrate();
    router.refresh();
    notifyDashboard();
    toast.success(t('reward_added'));
  };

  const saveRewardEdit = async (
    rewardId: string,
    nextTitle = editingRewardTitle,
    closeEditor = true,
  ) => {
    if (savingRewardId === rewardId) return;
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    const previous = rewards.find(r => r.id === rewardId);
    if (!previous) return;
    const nextCost = Math.max(1, Math.round(Number(rewardCostDrafts[rewardId] ?? previous.cost_points)) || 1);
    const nextSalePercentage = normaliseSalePercentage(rewardSalePercentageDrafts[rewardId] ?? previous.sale_percentage ?? 0);
    const nextSaleNameRaw = rewardSaleNameDrafts[rewardId] ?? previous.sale_name ?? '';
    const nextSaleName = nextSaleNameRaw.trim() || null;
    setSavingRewardId(rewardId);
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saving' }));
    const supabase = createBrowserSupabase();
    try {
      const { data, error } = await supabase.rpc('admin_update_reward', {
        p_reward_id: rewardId,
        p_title: trimmed,
        p_cost_points: nextCost,
        p_sale_percentage: nextSalePercentage,
        p_sale_name: nextSaleName,
      });

      if (error) {
        setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'error' }));
        toast.error(`${t('reward_save_failed')}: ${error.message}`);
        return;
      }
      if (!data) {
        setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'not_found' }));
        toast.error(t('reward_save_failed'));
        return;
      }

      const updated = mapReward(data as Record<string, unknown>);
      setRewards(prev => prev.map(r => r.id === rewardId ? updated : r).sort((a, b) => a.cost_points - b.cost_points));
      setRewardCostDrafts(prev => ({ ...prev, [rewardId]: updated.cost_points }));
      setRewardSalePercentageDrafts(prev => ({ ...prev, [rewardId]: updated.sale_percentage ?? 0 }));
      setRewardSaleNameDrafts(prev => ({ ...prev, [rewardId]: updated.sale_name ?? '' }));
      setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saved' }));
      if (closeEditor) setEditingRewardId(null);
      await storeHydrate();
      router.refresh();
      notifyDashboard();
      setTimeout(() => {
        setRewardSaveStatus(prev => {
          if (prev[rewardId] !== 'saved') return prev;
          return { ...prev, [rewardId]: 'idle' };
        });
      }, 1500);
    } finally {
      setSavingRewardId(null);
    }
  };

  const updateRewardCost = async (rewardId: string, rawCost: number) => {
    const previous = rewards.find(r => r.id === rewardId);
    if (!previous) return;

    const newCost = Math.max(1, Math.round(rawCost) || 1);
    if (previous.cost_points === newCost) return;

    setSavingRewardId(rewardId);
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saving' }));
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, cost_points: newCost } : r));

    const supabase = createBrowserSupabase();
    const response = await supabase.rpc('admin_update_reward', {
      p_reward_id: rewardId,
      p_title: previous.title,
      p_cost_points: newCost,
      p_sale_percentage: normaliseSalePercentage(previous.sale_percentage ?? 0),
      p_sale_name: previous.sale_name?.trim() || null,
    });

    if (response.error) {
      setRewards(prev => prev.map(r => r.id === rewardId ? previous : r));
      setRewardCostDrafts(prev => ({ ...prev, [rewardId]: previous.cost_points }));
      setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'error' }));
      setSavingRewardId(null);
      toast.error(`${t('reward_save_failed')}: ${response.error.message}`);
      return;
    }

    if (!response.data) {
      setRewards(prev => prev.map(r => r.id === rewardId ? previous : r));
      setRewardCostDrafts(prev => ({ ...prev, [rewardId]: previous.cost_points }));
      setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'not_found' }));
      setSavingRewardId(null);
      toast.error(`${t('reward_save_failed')}: NOT FOUND (${rewardId})`);
      return;
    }

    const saved = mapReward(response.data as Record<string, unknown>);
    setRewards(prev => prev.map(r => r.id === rewardId ? saved : r).sort((a, b) => a.cost_points - b.cost_points));
    setRewardCostDrafts(prev => ({ ...prev, [rewardId]: saved.cost_points }));
    setRewardSalePercentageDrafts(prev => ({ ...prev, [rewardId]: saved.sale_percentage ?? 0 }));
    setRewardSaleNameDrafts(prev => ({ ...prev, [rewardId]: saved.sale_name ?? '' }));
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saved' }));
    setSavingRewardId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();

    setTimeout(() => {
      setRewardSaveStatus(prev => {
        if (prev[rewardId] !== 'saved') return prev;
        return { ...prev, [rewardId]: 'idle' };
      });
    }, 1500);
  };

  const updateRewardSale = async (rewardId: string, rawPercentage: number, rawName: string) => {
    const previous = rewards.find(r => r.id === rewardId);
    if (!previous) return;

    const nextSalePercentage = normaliseSalePercentage(rawPercentage);
    const nextSaleName = rawName.trim() || undefined;
    const previousSalePercentage = normaliseSalePercentage(previous.sale_percentage ?? 0);
    const previousSaleName = previous.sale_name?.trim() || undefined;
    if (previousSalePercentage === nextSalePercentage && previousSaleName === nextSaleName) return;

    setSavingRewardId(rewardId);
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saving' }));
    setRewards(prev => prev.map(r => r.id === rewardId ? {
      ...r,
      sale_percentage: nextSalePercentage,
      sale_name: nextSaleName,
    } : r));

    const supabase = createBrowserSupabase();
    const response = await supabase.rpc('admin_update_reward', {
      p_reward_id: rewardId,
      p_title: previous.title,
      p_cost_points: previous.cost_points,
      p_sale_percentage: nextSalePercentage,
      p_sale_name: nextSaleName ?? null,
    });

    if (response.error || !response.data) {
      setRewards(prev => prev.map(r => r.id === rewardId ? previous : r));
      setRewardSalePercentageDrafts(prev => ({ ...prev, [rewardId]: previousSalePercentage }));
      setRewardSaleNameDrafts(prev => ({ ...prev, [rewardId]: previousSaleName ?? '' }));
      setRewardSaveStatus(prev => ({ ...prev, [rewardId]: response.error ? 'error' : 'not_found' }));
      setSavingRewardId(null);
      toast.error(`${t('reward_save_failed')}: ${response.error?.message ?? `NOT FOUND (${rewardId})`}`);
      return;
    }

    const saved = mapReward(response.data as Record<string, unknown>);
    setRewards(prev => prev.map(r => r.id === rewardId ? saved : r).sort((a, b) => a.cost_points - b.cost_points));
    setRewardCostDrafts(prev => ({ ...prev, [rewardId]: saved.cost_points }));
    setRewardSalePercentageDrafts(prev => ({ ...prev, [rewardId]: saved.sale_percentage ?? 0 }));
    setRewardSaleNameDrafts(prev => ({ ...prev, [rewardId]: saved.sale_name ?? '' }));
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saved' }));
    setSavingRewardId(null);
    await storeHydrate();
    router.refresh();
    notifyDashboard();

    setTimeout(() => {
      setRewardSaveStatus(prev => {
        if (prev[rewardId] !== 'saved') return prev;
        return { ...prev, [rewardId]: 'idle' };
      });
    }, 1500);
  };

  const deleteReward = async (rewardId: string) => {
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_delete_reward', { p_reward_id: rewardId });
    if (error) { toast.error(error.message); return; }
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
          <h1 className="text-2xl font-bold text-white mb-2">
            {familyName ? `${t('admin_mode')} - ${familyName}` : t('admin_mode')}
          </h1>
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
          {!isParentAdmin && !isFamilyOwner && adminPinHash !== undefined && (
            <p className="text-[#8a8f99] text-xs mt-3">
              부모 계정으로 로그인해야 관리자 설정을 변경할 수 있습니다.
            </p>
          )}
          {/* PIN reset escape hatch — only visible to the family creator */}
          {isFamilyOwner && adminPinHash !== null && adminPinHash !== undefined && (
            pinResetStep === 'idle' ? (
              <button
                onClick={() => { void handlePinReset(); }}
                disabled={pinResetLoading}
                className="mt-4 text-[#4f9cff] text-sm hover:underline disabled:opacity-50"
              >
                {pinResetLoading ? '인증 코드 발송 중…' : 'PIN을 잊으셨나요? 이메일로 초기화'}
              </button>
            ) : (
              <div className="mt-5 text-left">
                <p className="text-[#8a8f99] text-xs mb-3 text-center">
                  <span className="text-[#3ddc97]">{authProfile.email}</span>로 발송된<br />
                  6자리 인증 코드를 입력하세요
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '')); setOtpError(''); }}
                  onKeyDown={e => e.key === 'Enter' && void handleOtpVerify()}
                  placeholder="000000"
                  className="w-full rounded-xl bg-[#232831] text-white text-center text-2xl tracking-widest p-4 outline-none border border-[#232831] focus:border-[#4f9cff] mb-2"
                  style={{ minHeight: 'var(--touch-target)' }}
                  autoFocus
                />
                {otpError && <p className="text-red-400 text-xs mb-2 text-center">{otpError}</p>}
                <button
                  onClick={() => { void handleOtpVerify(); }}
                  disabled={otpLoading || otpCode.length !== 6}
                  className="w-full rounded-xl bg-[#3ddc97] text-[#0b0d12] font-semibold p-4 min-h-[var(--touch-target)] disabled:opacity-50 transition-opacity mb-2"
                >
                  {otpLoading ? '확인 중…' : '코드 확인 및 PIN 초기화'}
                </button>
                <button
                  onClick={() => { setPinResetStep('idle'); setOtpCode(''); setOtpError(''); }}
                  className="w-full text-[#8a8f99] text-sm py-2 hover:text-white transition-colors"
                >
                  취소
                </button>
              </div>
            )
          )}
          <Link href="/" className="block mt-4 text-[#8a8f99] text-sm">← {t('back_to_dashboard')}</Link>
          <button
            onClick={() => { void handleLogout(); }}
            className="mt-3 w-full rounded-xl bg-[#232831] text-red-400 font-semibold p-3 text-sm hover:bg-[#2d3545] transition-colors"
          >
            로그아웃
          </button>
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
          <h1 className="text-2xl font-bold">
            {familyName ? `${t('admin_mode')} - ${familyName}` : t('admin_mode')}
          </h1>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="text-[#8a8f99] text-sm hover:text-white whitespace-nowrap">← {t('back_to_dashboard')}</Link>
            <AuthProfileAvatar email={authProfile.email} avatarUrl={authProfile.avatarUrl} size={32} />
          </div>
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
                  <button
                    onClick={generateInviteCode}
                    disabled={generatingCode}
                    className="w-14 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center disabled:opacity-40 hover:bg-[#2d3545] hover:text-white transition-colors"
                    style={{ minHeight: 'var(--touch-target)' }}
                    title={familyInviteCode ? 'Regenerate code' : 'Generate code'}
                  >
                    <Icons.RefreshCw size={18} className={generatingCode ? 'animate-spin' : ''} />
                  </button>
                </div>
                {!familyInviteCode && (
                  <p className="text-[#f59e0b] text-xs mt-2">
                    ↑ 초대 코드가 없습니다. 새로고침 버튼으로 생성하세요.
                  </p>
                )}
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
                  onClick={handleLeaveFamily}
                  disabled={leavingFamily || deletingFamily}
                  className="mb-3 w-full rounded-xl border border-amber-600/70 bg-amber-900/25 px-5 py-4 font-bold text-amber-100 transition-colors hover:bg-amber-800/40 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ minHeight: 'var(--touch-target)' }}
                >
                  {leavingFamily ? '나가는 중...' : 'Leave Family (가족 공간에서 나가기)'}
                </button>
                <button
                  onClick={handleDeleteFamilyData}
                  disabled={deletingFamily || leavingFamily}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#4f9cff]">{t('set_family_names')}</h2>
                <button
                  onClick={() => { setAddingMember(true); setNewMemberName(''); setNewMemberRole('CHILD'); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#4f9cff]/15 text-[#4f9cff] text-sm font-semibold hover:bg-[#4f9cff]/25 transition-colors"
                >
                  <Icons.UserPlus size={15} />
                  멤버 추가
                </button>
              </div>

              {/* Add member form */}
              {addingMember && (
                <div className="bg-[#232831] rounded-xl p-4 mb-4 space-y-3 border border-[#4f9cff]/30">
                  <p className="text-sm text-[#8a8f99]">새 프로필을 추가합니다. 나중에 이 프로필에 Google 계정을 연결할 수 있습니다.</p>
                  <input
                    type="text"
                    value={newMemberName}
                    onChange={e => setNewMemberName(e.target.value)}
                    disabled={isAddingMember}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void addMember();
                      }
                    }}
                    placeholder="이름 (예: 아람, 주원)"
                    autoFocus
                    className="w-full rounded-xl bg-[#1a1f2a] text-white px-4 outline-none border border-[#2d3545] focus:border-[#4f9cff]"
                    style={{ minHeight: '48px', fontSize: '16px' }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewMemberRole('PARENT')}
                      disabled={isAddingMember}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        newMemberRole === 'PARENT' ? 'bg-[#4f9cff] text-white' : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                      }`}
                    >
                      {t('parent_role')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMemberRole('CHILD')}
                      disabled={isAddingMember}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        newMemberRole === 'CHILD' ? 'bg-[#4f9cff] text-white' : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                      }`}
                    >
                      {t('child_role')}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { void addMember(); }}
                      disabled={isAddingMember || !newMemberName.trim()}
                      className="flex-1 py-3 rounded-xl bg-[#4f9cff] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {isAddingMember ? '추가 중...' : '추가하기'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingMember(false)}
                      disabled={isAddingMember}
                      className="flex-1 py-3 rounded-xl bg-[#1a1f2a] text-[#8a8f99] font-semibold hover:bg-[#2d3545] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { void handleAvatarUpload(e.target.files?.[0]); }}
              />

              <div className="space-y-3">
                {sortedUsers.map((u, index) => (
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
                        <button
                          type="button"
                          onClick={() => openAvatarUpload(u.id)}
                          disabled={avatarUploadingUserId === u.id}
                          className="relative w-10 h-10 rounded-full shrink-0 ring-2 ring-[#2d3545] overflow-hidden bg-[#232831] flex items-center justify-center text-[#8a8f99] font-bold text-base hover:ring-[#4f9cff] transition disabled:opacity-60"
                          title="프로필 사진 업로드"
                        >
                          {u.avatarUrl ? (
                            <Image
                              src={withAvatarCache(u.avatarUrl, avatarVersion) ?? u.avatarUrl}
                              alt={u.name}
                              width={40}
                              height={40}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 object-cover"
                            />
                          ) : (
                            u.name.charAt(0)
                          )}
                          <span className="absolute inset-x-0 bottom-0 h-4 bg-black/55 text-white flex items-center justify-center">
                            {avatarUploadingUserId === u.id
                              ? <Icons.Loader2 size={10} className="animate-spin" />
                              : <Icons.Camera size={10} />}
                          </span>
                        </button>
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
                          onClick={() => moveMember(u.id, -1)}
                          disabled={index === 0}
                          className="w-10 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          style={{ minHeight: '48px', fontSize: '18px' }}
                          title="위로 이동"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveMember(u.id, 1)}
                          disabled={index === sortedUsers.length - 1}
                          className="w-10 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          style={{ minHeight: '48px', fontSize: '18px' }}
                          title="아래로 이동"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => startEditName(u)}
                          className="w-11 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors"
                          style={{ minHeight: '48px', fontSize: '20px' }}
                        >
                          ✏️
                        </button>
                        {!(u.authUserId && u.authUserId === currentAuthUserId) && (
                          <button
                            onClick={() => removeMember(u.id)}
                            className="w-11 rounded-xl bg-red-900/20 text-red-400 flex items-center justify-center hover:bg-red-900/40 transition-colors shrink-0"
                            style={{ minHeight: '48px' }}
                            title="프로필 삭제"
                          >
                            <Icons.Trash2 size={15} />
                          </button>
                        )}
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
                  {sortedUsers.map(u => (
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
                        disabled={isAddingTask}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addTask();
                          }
                        }}
                        placeholder={t('task_name_placeholder')}
                        className="flex-1 rounded-xl bg-[#232831] text-white p-3 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                      />
                      <input
                        type="number"
                        value={newTaskPoints}
                        onChange={e => setNewTaskPoints(Number(e.target.value))}
                        min={1}
                        max={100}
                        disabled={isAddingTask}
                        className="w-20 rounded-xl bg-[#232831] text-white p-3 outline-none text-center border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
                      />
                      <button
                        type="button"
                        onClick={() => { void addTask(); }}
                        disabled={isAddingTask || !newTaskTitle.trim()}
                        className="px-5 rounded-xl bg-[#4f9cff] text-white font-semibold min-h-[var(--touch-target)] disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAddingTask ? '...' : t('add')}
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
                  <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#232831]">
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
                          value={rewardCostDrafts[r.id] ?? r.cost_points}
                          onChange={e => {
                            const nextPoints = Number(e.target.value);
                            setRewardCostDrafts(prev => ({ ...prev, [r.id]: nextPoints }));
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          min={1}
                          className="w-20 rounded-xl bg-[#1a1f2a] text-white px-2 outline-none text-center border border-[#4f9cff]"
                          style={{ minHeight: 44 }}
                        />
                        <span className="text-[#8a8f99] text-xs shrink-0">pt</span>
                        <input
                          type="number"
                          aria-label="할인율 (%)"
                          title="할인율 (%)"
                          value={rewardSalePercentageDrafts[r.id] ?? r.sale_percentage ?? 0}
                          onChange={e => {
                            setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }));
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          min={0}
                          max={100}
                          className="w-24 rounded-xl bg-[#1a1f2a] text-white px-2 outline-none text-center border border-[#4f9cff]"
                          style={{ minHeight: 44 }}
                        />
                        <span className="text-[#8a8f99] text-xs shrink-0">%</span>
                        <input
                          type="text"
                          aria-label="세일 이유 또는 명칭"
                          value={rewardSaleNameDrafts[r.id] ?? r.sale_name ?? ''}
                          onChange={e => {
                            setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: e.target.value }));
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          placeholder="세일 이유 또는 명칭"
                          className="w-32 rounded-xl bg-[#1a1f2a] text-white px-3 outline-none border border-[#4f9cff]"
                          style={{ minHeight: 44, fontSize: 15 }}
                        />
                        <span className="w-5 text-center text-xs shrink-0">
                          {savingRewardId === r.id || rewardSaveStatus[r.id] === 'saving'
                            ? '…'
                            : rewardSaveStatus[r.id] === 'saved'
                              ? '✓'
                              : rewardSaveStatus[r.id] === 'not_found'
                                ? 'NOT FOUND'
                              : rewardSaveStatus[r.id] === 'error'
                                ? '!'
                                : ''}
                        </span>
                        <button
                          onClick={() => saveRewardEdit(r.id)}
                          disabled={savingRewardId === r.id}
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
                        <div className="flex-1 min-w-[120px]">
                          <span className="block font-medium text-sm truncate">{r.title}</span>
                          {(r.sale_percentage ?? 0) > 0 && (
                            <span className="inline-flex mt-1 rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                              {r.sale_name?.trim() || `${r.sale_percentage}% OFF`}
                            </span>
                          )}
                        </div>
                        <input
                          type="number"
                          value={rewardCostDrafts[r.id] ?? r.cost_points}
                          onChange={e => {
                            const nextPoints = Number(e.target.value);
                            setRewardCostDrafts(prev => ({ ...prev, [r.id]: nextPoints }));
                          }}
                          onBlur={e => { void updateRewardCost(r.id, Number(e.target.value)); }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                              setRewardCostDrafts(prev => ({ ...prev, [r.id]: r.cost_points }));
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          min={1}
                          disabled={savingRewardId === r.id}
                          className="w-20 rounded-lg bg-[#1a1f2a] text-white text-center text-sm outline-none border border-[#232831] focus:border-[#4f9cff] shrink-0"
                          style={{ minHeight: 44 }}
                        />
                        <span className="text-[#8a8f99] text-xs shrink-0">pt</span>
                        <input
                          type="number"
                          aria-label="할인율 (%)"
                          title="할인율 (%)"
                          value={rewardSalePercentageDrafts[r.id] ?? r.sale_percentage ?? 0}
                          onChange={e => {
                            setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: Number(e.target.value) }));
                          }}
                          onBlur={e => {
                            void updateRewardSale(
                              r.id,
                              Number(e.target.value),
                              rewardSaleNameDrafts[r.id] ?? r.sale_name ?? '',
                            );
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                              setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: r.sale_percentage ?? 0 }));
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          min={0}
                          max={100}
                          disabled={savingRewardId === r.id}
                          className="w-24 rounded-lg bg-[#1a1f2a] text-white text-center text-sm outline-none border border-[#232831] focus:border-[#4f9cff] shrink-0"
                          style={{ minHeight: 44 }}
                        />
                        <span className="text-[#8a8f99] text-xs shrink-0">%</span>
                        <input
                          type="text"
                          aria-label="세일 이유 또는 명칭"
                          value={rewardSaleNameDrafts[r.id] ?? r.sale_name ?? ''}
                          onChange={e => {
                            setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: e.target.value }));
                          }}
                          onBlur={e => {
                            void updateRewardSale(
                              r.id,
                              rewardSalePercentageDrafts[r.id] ?? r.sale_percentage ?? 0,
                              e.target.value,
                            );
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') {
                              setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: r.sale_name ?? '' }));
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          placeholder="세일 이유 또는 명칭"
                          disabled={savingRewardId === r.id}
                          className="min-w-[140px] flex-1 rounded-lg bg-[#1a1f2a] text-white px-3 text-sm outline-none border border-[#232831] focus:border-[#4f9cff]"
                          style={{ minHeight: 44 }}
                        />
                        <span className="w-5 text-center text-xs shrink-0">
                          {savingRewardId === r.id || rewardSaveStatus[r.id] === 'saving'
                            ? '…'
                            : rewardSaveStatus[r.id] === 'saved'
                              ? '✓'
                              : rewardSaveStatus[r.id] === 'not_found'
                                ? 'NOT FOUND'
                              : rewardSaveStatus[r.id] === 'error'
                                ? '!'
                                : ''}
                        </span>
                        <button
                          onClick={() => {
                            setEditingRewardId(r.id);
                            setEditingRewardTitle(r.title);
                            setRewardCostDrafts(prev => ({ ...prev, [r.id]: r.cost_points }));
                            setRewardSalePercentageDrafts(prev => ({ ...prev, [r.id]: r.sale_percentage ?? 0 }));
                            setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: r.sale_name ?? '' }));
                          }}
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
                <div className="flex flex-wrap gap-2">
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
                    className="min-w-[180px] flex-1 rounded-xl bg-[#232831] text-white p-3 outline-none border border-[#232831] focus:border-[#4f9cff] min-h-[var(--touch-target)]"
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
