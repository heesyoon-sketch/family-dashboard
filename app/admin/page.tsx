'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { CrossIcon, ToothbrushIcon, CUSTOM_ICON_MAP } from '@/components/CustomIcons';
import { AuthProfileAvatar } from '@/components/AuthProfileAvatar';
import { FamBitWordmark } from '@/components/FamBitLogo';
import { User, Task, Reward, Difficulty, DayOfWeek, ALL_DAYS, ThemeName, UserRole } from '@/lib/db';
import { legacyRecurrenceToDays } from '@/lib/db';
import { getCurrentFamilyAdminPinHash, saveAdminPin, verifyAdminPin } from '@/lib/adminPin';
import { resetAllProgress } from '@/lib/reset';
import { deleteCurrentFamilyData } from '@/lib/deleteFamilyData';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { useLanguage } from '@/contexts/LanguageContext';

function notifyDashboard() {
  const ch = new BroadcastChannel('habit_sync');
  ch.postMessage('update');
  ch.close();
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

const DAY_LABELS = {
  ko: { MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토', SUN: '일' },
  en: { MON: 'M', TUE: 'T', WED: 'W', THU: 'T', FRI: 'F', SAT: 'S', SUN: 'S' },
} as const satisfies Record<'ko' | 'en', Record<DayOfWeek, string>>;

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
                          ? 'bg-[#4f9cff] text-[#06111f]'
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

interface RewardRedemption {
  id: string;
  user_id: string;
  user_name: string;
  reward_id: string;
  reward_title: string;
  reward_icon: string;
  cost_charged: number;
  redeemed_at: string;
  refunded_at?: string | null;
  refunded_by?: string | null;
  refund_reason?: string | null;
}

function normaliseSalePercentage(value: unknown): number {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function mapReward(row: Record<string, unknown>): Reward {
  const saleName = typeof row.sale_name === 'string' && row.sale_name.trim()
    ? row.sale_name.trim()
    : undefined;
  const salePrice = Number(row.sale_price);
  return {
    id: row.id as string,
    title: (row.title ?? row.name ?? '') as string,
    cost_points: Number(row.cost_points ?? 0),
    icon: (row.icon ?? 'gift') as string,
    sale_enabled: Boolean(row.sale_enabled),
    sale_percentage: normaliseSalePercentage(row.sale_percentage),
    sale_price: row.sale_price == null || !Number.isFinite(salePrice) ? undefined : Math.max(0, Math.round(salePrice)),
    sale_name: saleName,
    is_hidden: Boolean(row.is_hidden),
    is_sold_out: Boolean(row.is_sold_out),
  };
}

function mapRewardRedemption(row: Record<string, unknown>): RewardRedemption {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    user_name: (row.user_name ?? '') as string,
    reward_id: row.reward_id as string,
    reward_title: (row.reward_title ?? '') as string,
    reward_icon: (row.reward_icon ?? 'gift') as string,
    cost_charged: Number(row.cost_charged ?? 0),
    redeemed_at: row.redeemed_at as string,
    refunded_at: (row.refunded_at as string | null) ?? null,
    refunded_by: (row.refunded_by as string | null) ?? null,
    refund_reason: (row.refund_reason as string | null) ?? null,
  };
}

function formatShortDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const [rewardIconPickerRewardId, setRewardIconPickerRewardId] = useState<string | null>(null);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);
  const [editingRewardTitle, setEditingRewardTitle] = useState('');
  const [savingRewardId, setSavingRewardId] = useState<string | null>(null);
  const [rewardSaveStatus, setRewardSaveStatus] = useState<Record<string, SaveStatus>>({});
  const [rewardCostDrafts, setRewardCostDrafts] = useState<Record<string, number>>({});
  const [rewardSalePercentageDrafts, setRewardSalePercentageDrafts] = useState<Record<string, number>>({});
  const [rewardSaleNameDrafts, setRewardSaleNameDrafts] = useState<Record<string, string>>({});
  const [rewardRedemptions, setRewardRedemptions] = useState<RewardRedemption[]>([]);
  const [refundInFlightId, setRefundInFlightId] = useState<string | null>(null);
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
  const adminCopy = {
    tabs: {
      settings: lang === 'en' ? 'Settings' : '설정',
      family:   lang === 'en' ? 'Family' : '가족',
      tasks:    lang === 'en' ? 'Tasks' : '습관',
      store:    lang === 'en' ? 'Store' : '상점',
    },
    familyInvitation: lang === 'en' ? 'Family Invitation' : '가족 초대',
    familyInvitationHelp: lang === 'en'
      ? 'Share this code with a family member after they sign in with Google.'
      : '가족 구성원이 Google로 로그인한 뒤 이 코드를 입력하면 합류할 수 있습니다.',
    copyInviteCode: lang === 'en' ? 'Copy invitation code' : '초대 코드 복사',
    regenerateCode: lang === 'en' ? 'Regenerate code' : '초대 코드 다시 만들기',
    generateCode: lang === 'en' ? 'Generate code' : '초대 코드 만들기',
    noInviteCode: lang === 'en'
      ? 'No invitation code yet. Use refresh to generate one.'
      : '초대 코드가 없습니다. 새로고침 버튼으로 생성하세요.',
    language: lang === 'en' ? 'Language' : '언어 설정',
    korean: lang === 'en' ? 'Korean' : '한국어',
    english: lang === 'en' ? 'English' : '영어',
    leaveFamily: lang === 'en' ? 'Leave Family' : '가족 공간에서 나가기',
    leavingFamily: lang === 'en' ? 'Leaving...' : '나가는 중...',
    addMember: lang === 'en' ? 'Add member' : '멤버 추가',
    addMemberHelp: lang === 'en'
      ? 'Add a new profile. You can link a Google account to it later.'
      : '새 프로필을 추가합니다. 나중에 이 프로필에 Google 계정을 연결할 수 있습니다.',
    memberNamePlaceholder: lang === 'en' ? 'Name, e.g. Alex' : '이름 (예: 아람, 주원)',
    adding: lang === 'en' ? 'Adding...' : '추가 중...',
    add: lang === 'en' ? 'Add' : '추가하기',
    cancel: lang === 'en' ? 'Cancel' : '취소',
    uploadAvatar: lang === 'en' ? 'Upload profile photo' : '프로필 사진 업로드',
    moveUp: lang === 'en' ? 'Move up' : '위로 이동',
    moveDown: lang === 'en' ? 'Move down' : '아래로 이동',
    deleteProfile: lang === 'en' ? 'Delete profile' : '프로필 삭제',
    linked: lang === 'en' ? 'Account linked' : '계정 연결됨',
    notLinked: lang === 'en' ? 'No account' : '계정 없음',
    saleOff: lang === 'en' ? 'Sale off' : '세일 꺼짐',
    hidden: lang === 'en' ? 'Hidden' : '숨김',
    visible: lang === 'en' ? 'Visible' : '공개',
    soldOut: lang === 'en' ? 'Sold out' : '품절',
    inStock: lang === 'en' ? 'In stock' : '재고',
    saleLabel: lang === 'en' ? 'Sale label' : '세일 이유 또는 명칭',
    rewardHistory: lang === 'en' ? 'Purchase history' : '구매 내역',
    refresh: lang === 'en' ? 'Refresh' : '새로고침',
    refunded: lang === 'en' ? 'Refunded' : '환불됨',
    refund: lang === 'en' ? 'Refund' : '환불',
    refundComplete: lang === 'en' ? 'Refund complete' : '환불 완료',
    processing: lang === 'en' ? 'Processing...' : '처리중…',
    noPurchases: lang === 'en' ? 'No purchases yet' : '아직 구매 내역이 없습니다',
  };

  async function loadRewardRedemptions() {
    const supabase = createBrowserSupabase();
    const { data, error } = await supabase.rpc('admin_list_reward_redemptions', {
      p_limit: 80,
    });
    if (error) {
      console.warn('Failed to load reward redemptions', error);
      return;
    }
    setRewardRedemptions(Array.isArray(data)
      ? data.map(row => mapRewardRedemption(row as Record<string, unknown>))
      : []);
  }

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
      const { data: familyInfo } = await supabase.rpc('get_my_family_info');
      const resolvedFamilyId = (familyInfo as { id: string; name: string } | null)?.id ?? null;
      if (!resolvedFamilyId) { router.replace('/setup'); return; }
      setFamilyId(resolvedFamilyId);
      useFamilyStore.setState({ familyName: (familyInfo as { id: string; name: string }).name ?? null });

      const [hash, inviteRes] = await Promise.all([
        getCurrentFamilyAdminPinHash(),
        supabase.from('families').select('invite_code').eq('id', resolvedFamilyId).maybeSingle(),
      ]);
      if (!hash) {
        router.replace('/setup/set-pin');
        return;
      }
      setAdminPinHash(hash);
      setFamilyInviteCode(inviteRes.data?.invite_code ?? null);

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
      await loadRewardRedemptions();
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
    if (adminPinHash) {
      const { ok, upgradedHash } = await verifyAdminPin(pin, adminPinHash);
      if (ok) {
        if (upgradedHash) setAdminPinHash(upgradedHash);
        setView('dashboard');
        return;
      }
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
    if (!isFamilyOwner && adminPinHash) {
      const { ok } = await verifyAdminPin(currentPinInput, adminPinHash);
      if (!ok) {
        toast.error(t('pin_incorrect'));
        return;
      }
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

  const sortedUsers = useMemo(
    () => [...allUsers].sort((a, b) =>
      a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime()
    ),
    [allUsers]
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

  const loadTasks = useCallback(async (user: User) => {
    setSelectedUser(user);
    setTasks([]);
    const supabase = createBrowserSupabase();
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('sort_order');
    setTasks((data ?? []).map(r => mapTask(r as Record<string, unknown>)));
  }, []);

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
        p_icon: previous.icon,
        p_sale_enabled: Boolean(previous.sale_enabled),
        p_is_hidden: Boolean(previous.is_hidden),
        p_is_sold_out: Boolean(previous.is_sold_out),
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
      p_icon: previous.icon,
      p_sale_enabled: Boolean(previous.sale_enabled),
      p_is_hidden: Boolean(previous.is_hidden),
      p_is_sold_out: Boolean(previous.is_sold_out),
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
      p_icon: previous.icon,
      p_sale_enabled: Boolean(previous.sale_enabled),
      p_is_hidden: Boolean(previous.is_hidden),
      p_is_sold_out: Boolean(previous.is_sold_out),
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

  const updateRewardIcon = async (rewardId: string, icon: string) => {
    const previous = rewards.find(r => r.id === rewardId);
    if (!previous) return;
    if (previous.icon === icon) {
      setRewardIconPickerRewardId(null);
      return;
    }

    setSavingRewardId(rewardId);
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saving' }));
    setRewards(prev => prev.map(r => r.id === rewardId ? { ...r, icon } : r));
    setRewardIconPickerRewardId(null);

    const supabase = createBrowserSupabase();
    const response = await supabase.rpc('admin_update_reward', {
      p_reward_id: rewardId,
      p_title: previous.title,
      p_cost_points: previous.cost_points,
      p_sale_percentage: normaliseSalePercentage(previous.sale_percentage ?? 0),
      p_sale_name: previous.sale_name?.trim() || null,
      p_icon: icon,
      p_sale_enabled: Boolean(previous.sale_enabled),
      p_is_hidden: Boolean(previous.is_hidden),
      p_is_sold_out: Boolean(previous.is_sold_out),
    });

    if (response.error || !response.data) {
      setRewards(prev => prev.map(r => r.id === rewardId ? previous : r));
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

  const updateRewardFlags = async (
    rewardId: string,
    patch: Partial<Pick<Reward, 'sale_enabled' | 'is_hidden' | 'is_sold_out'>>,
  ) => {
    const previous = rewards.find(r => r.id === rewardId);
    if (!previous) return;

    const nextSalePercentage = patch.sale_enabled === true && normaliseSalePercentage(previous.sale_percentage ?? 0) === 0
      ? 10
      : normaliseSalePercentage(previous.sale_percentage ?? 0);
    const next: Reward = { ...previous, ...patch, sale_percentage: nextSalePercentage };
    if (
      Boolean(previous.sale_enabled) === Boolean(next.sale_enabled) &&
      Boolean(previous.is_hidden) === Boolean(next.is_hidden) &&
      Boolean(previous.is_sold_out) === Boolean(next.is_sold_out)
    ) return;

    setSavingRewardId(rewardId);
    setRewardSaveStatus(prev => ({ ...prev, [rewardId]: 'saving' }));
    setRewards(prev => prev.map(r => r.id === rewardId ? next : r));

    const supabase = createBrowserSupabase();
    const response = await supabase.rpc('admin_update_reward', {
      p_reward_id: rewardId,
      p_title: previous.title,
      p_cost_points: previous.cost_points,
      p_sale_percentage: nextSalePercentage,
      p_sale_name: previous.sale_name?.trim() || null,
      p_icon: previous.icon,
      p_sale_enabled: Boolean(next.sale_enabled),
      p_is_hidden: Boolean(next.is_hidden),
      p_is_sold_out: Boolean(next.is_sold_out),
    });

    if (response.error || !response.data) {
      setRewards(prev => prev.map(r => r.id === rewardId ? previous : r));
      setRewardSaveStatus(prev => ({ ...prev, [rewardId]: response.error ? 'error' : 'not_found' }));
      setSavingRewardId(null);
      toast.error(`${t('reward_save_failed')}: ${response.error?.message ?? `NOT FOUND (${rewardId})`}`);
      return;
    }

    const saved = mapReward(response.data as Record<string, unknown>);
    setRewards(prev => prev.map(r => r.id === rewardId ? saved : r).sort((a, b) => a.cost_points - b.cost_points));
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

  const refundRedemption = async (redemption: RewardRedemption) => {
    if (refundInFlightId || redemption.refunded_at) return;
    const confirmed = confirm(
      `${redemption.user_name}의 "${redemption.reward_title}" 구매를 환불할까요?\n\n${redemption.cost_charged}pt가 다시 지급됩니다.`
    );
    if (!confirmed) return;

    setRefundInFlightId(redemption.id);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_refund_reward_redemption', {
      p_redemption_id: redemption.id,
      p_reason: 'admin_refund',
    });

    if (error) {
      setRefundInFlightId(null);
      toast.error(`환불 실패: ${error.message}`);
      return;
    }

    await loadRewardRedemptions();
    await storeHydrate();
    router.refresh();
    notifyDashboard();
    setRefundInFlightId(null);
    toast.success('환불 완료');
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
  const pickerReward = rewardIconPickerRewardId
    ? rewards.find(reward => reward.id === rewardIconPickerRewardId)
    : null;

  if (view === 'pin') {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0D0E1C] px-4 py-8 text-white sm:px-6">
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-44 border-b border-white/8 bg-[#111224]" />
        <div className="relative z-10 w-full max-w-md">
          <Link href="/home" aria-label="FamBit home" className="mx-auto mb-5 flex w-fit">
            <FamBitWordmark compact />
          </Link>
          <section className="rounded-lg border border-white/8 bg-[#14162A]/95 p-6 text-center shadow-2xl shadow-black/35 sm:p-7">
          <div className="mb-5 flex justify-center">
            <FamBitWordmark markSize={52} showText={false} />
          </div>
          <p className="mb-2 text-center text-xs font-black uppercase text-[#4EEDB0]">
            Admin protection
          </p>
          <h1 className="text-2xl font-black leading-tight text-white">
            {familyName ? `${t('admin_mode')} - ${familyName}` : t('admin_mode')}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/62">{t('enter_parent_pin')}</p>
          {isParentAdmin && adminPinHash === null && (
            <p className="mt-4 rounded-lg border border-[#4EEDB0]/35 bg-[#4EEDB0]/10 px-3 py-2 text-sm leading-5 text-[#4EEDB0]">
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
            onKeyDown={e => { if (e.key === 'Enter') void handlePinSubmit(); }}
            placeholder="••••"
            className="mt-6 w-full rounded-lg border border-white/10 bg-[#111224] p-4 text-center text-2xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
            style={{ minHeight: 'var(--touch-target)' }}
          />
          {error && (
            <p className="mt-3 rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
              {error}
            </p>
          )}
          <button
            onClick={handlePinSubmit}
            disabled={adminPinHash === undefined}
            className="mt-4 w-full rounded-lg bg-[#4EEDB0] p-4 font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
            style={{ minHeight: 'var(--touch-target)' }}
          >
            {adminPinHash === undefined ? '…' : t('confirm')}
          </button>
          {!isParentAdmin && !isFamilyOwner && adminPinHash !== undefined && (
            <p className="mt-3 text-xs leading-5 text-white/42">
              부모 계정으로 로그인해야 관리자 설정을 변경할 수 있습니다.
            </p>
          )}
          {/* PIN reset escape hatch — only visible to the family creator */}
          {isFamilyOwner && adminPinHash !== null && adminPinHash !== undefined && (
            pinResetStep === 'idle' ? (
              <button
                onClick={() => { void handlePinReset(); }}
                disabled={pinResetLoading}
                className="mt-4 text-sm font-bold text-[#5B8EFF] transition-colors hover:text-[#8EAFFF] disabled:opacity-50"
              >
                {pinResetLoading ? '인증 코드 발송 중…' : 'PIN을 잊으셨나요? 이메일로 초기화'}
              </button>
            ) : (
              <div className="mt-5 text-left">
                <p className="mb-3 text-center text-xs leading-5 text-white/48">
                  <span className="text-[#4EEDB0]">{authProfile.email}</span>로 발송된<br />
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
                  className="mb-2 w-full rounded-lg border border-white/10 bg-[#111224] p-4 text-center text-2xl font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  style={{ minHeight: 'var(--touch-target)' }}
                  autoFocus
                />
                {otpError && <p className="mb-2 text-center text-xs text-[#FFB8CF]">{otpError}</p>}
                <button
                  onClick={() => { void handleOtpVerify(); }}
                  disabled={otpLoading || otpCode.length !== 6}
                  className="mb-2 w-full rounded-lg bg-[#4EEDB0] p-4 font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
                  style={{ minHeight: 'var(--touch-target)' }}
                >
                  {otpLoading ? '확인 중…' : '코드 확인 및 PIN 초기화'}
                </button>
                <button
                  onClick={() => { setPinResetStep('idle'); setOtpCode(''); setOtpError(''); }}
                  className="w-full py-2 text-sm font-bold text-white/50 transition-colors hover:text-white"
                >
                  {adminCopy.cancel}
                </button>
              </div>
            )
          )}
          <Link href="/" className="mt-5 block text-sm font-bold text-white/50 transition-colors hover:text-white">← {t('back_to_dashboard')}</Link>
          <button
            onClick={() => { void handleLogout(); }}
            className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.045] p-3 text-sm font-bold text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/35 hover:bg-[#FF7BAC]/10"
          >
            {t('logout')}
          </button>
          </section>
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
      {pickerReward && (
        <IconPicker
          currentIcon={pickerReward.icon}
          onSelect={icon => { void updateRewardIcon(pickerReward.id, icon); }}
          onClose={() => setRewardIconPickerRewardId(null)}
        />
      )}

      <main className="min-h-screen bg-[#0D0E1C] text-white">
        {/* Header */}
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pb-3 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            <FamBitWordmark
              compact
              markSize={32}
              textClassName="hidden text-lg font-black text-white sm:inline"
            />
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-[#4EEDB0]">{adminCopy.tabs.settings}</p>
              <h1 className="min-w-0 truncate text-xl font-black sm:text-2xl">
                {familyName ? `${t('admin_mode')} - ${familyName}` : t('admin_mode')}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <a
              href="https://forms.gle/KgxsBSBHwkdrwdTz7"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('feedback')}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.045] text-sm font-bold text-white/54 transition-colors hover:border-[#4EEDB0]/45 hover:text-white sm:w-auto sm:px-3"
            >
              <Icons.MessageCircle size={15} />
              <span className="hidden sm:inline">{t('feedback')}</span>
            </a>
            <Link href="/" className="whitespace-nowrap text-sm font-bold text-white/54 transition-colors hover:text-white">← {t('back_to_dashboard')}</Link>
            <AuthProfileAvatar email={authProfile.email} avatarUrl={authProfile.avatarUrl} size={32} />
          </div>
        </div>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-40 border-b border-white/8 bg-[#0D0E1C]/95 backdrop-blur">
          <div className="mx-auto max-w-4xl px-4">
            <div className="flex gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
              {([
                { key: 'settings', label: adminCopy.tabs.settings, icon: Icons.Settings2 },
                { key: 'family',   label: adminCopy.tabs.family, icon: Icons.UsersRound },
                { key: 'tasks',    label: adminCopy.tabs.tasks, icon: Icons.ListChecks },
                { key: 'store',    label: adminCopy.tabs.store, icon: Icons.Store },
              ] as const).map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      const hasSelectedUser = selectedUser
                        ? sortedUsers.some(u => u.id === selectedUser.id)
                        : false;
                      if (tab.key === 'tasks' && !hasSelectedUser && sortedUsers[0]) {
                        void loadTasks(sortedUsers[0]);
                      }
                    }}
                    className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-black transition-colors ${
                      activeTab === tab.key
                        ? 'bg-[#4EEDB0] text-[#07120E]'
                        : 'text-white/54 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    <TabIcon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div key={activeTab} className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">

          {/* ─── SETTINGS & SECURITY ─── */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              {/* Family invitation */}
              <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-white">{adminCopy.familyInvitation}</h2>
                    <p className="mt-1 text-sm leading-6 text-white/54">
                      {adminCopy.familyInvitationHelp}
                    </p>
                  </div>
                  <Icons.UsersRound className="shrink-0 text-[#4EEDB0]" size={20} />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-lg border border-white/10 bg-[#111224] px-3">
                    <span className="truncate text-lg font-black tracking-[0.22em] text-white sm:text-xl">
                      {familyInviteCode ?? '------'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copyInviteCode}
                      disabled={!familyInviteCode}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#4EEDB0]/14 px-3 text-sm font-black text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/20 disabled:cursor-not-allowed disabled:opacity-40"
                      title={adminCopy.copyInviteCode}
                    >
                      <Icons.Copy size={16} />
                      <span className="hidden sm:inline">{adminCopy.copyInviteCode}</span>
                    </button>
                    <button
                      onClick={generateInviteCode}
                      disabled={generatingCode}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/56 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
                      title={familyInviteCode ? adminCopy.regenerateCode : adminCopy.generateCode}
                    >
                      <Icons.RefreshCw size={16} className={generatingCode ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>
                {!familyInviteCode && (
                  <p className="mt-2 text-xs text-[#FFB830]">
                    ↑ {adminCopy.noInviteCode}
                  </p>
                )}
              </div>

              {/* Language */}
              <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Icons.Languages size={18} className="text-[#5B8EFF]" />
                  <h2 className="text-base font-black text-white">{adminCopy.language}</h2>
                </div>
                <div className="inline-flex w-full rounded-lg border border-white/10 bg-[#111224] p-1 sm:w-auto">
                  <button
                    onClick={() => setLang('ko')}
                    className={`h-9 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:min-w-24 ${
                      lang === 'ko' ? 'bg-[#5B8EFF] text-white' : 'text-white/50 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    {adminCopy.korean}
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`h-9 flex-1 rounded-md px-4 text-sm font-black transition-colors sm:min-w-24 ${
                      lang === 'en' ? 'bg-[#5B8EFF] text-white' : 'text-white/50 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    {adminCopy.english}
                  </button>
                </div>
              </div>

              {/* Change Admin PIN */}
              <div className="rounded-lg border border-white/8 bg-[#14162A] p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Icons.LockKeyhole size={18} className="text-[#FFB830]" />
                  <h2 className="text-base font-black text-white">{t('change_admin_pin')}</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={currentPinInput}
                    onChange={e => setCurrentPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('current_pin')}
                    className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={newPinInput}
                    onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('new_pin')}
                    className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPinInput}
                    onChange={e => setConfirmPinInput(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('confirm_new_pin')}
                    className="h-11 w-full rounded-lg border border-white/10 bg-[#111224] px-3 text-center text-lg font-black tracking-widest text-white outline-none transition-colors placeholder:text-white/32 focus:border-[#4EEDB0]"
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleChangePin}
                    disabled={pinChanging || !currentPinInput || !newPinInput || !confirmPinInput}
                    className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-[#4EEDB0] px-4 text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-white/36 sm:w-auto"
                  >
                    {pinChanging ? '…' : t('change_pin_btn')}
                  </button>
                </div>
              </div>

              {/* Progress Reset */}
              <div className="flex flex-col gap-3 rounded-lg border border-white/8 bg-[#14162A] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                    <Icons.RotateCcw size={17} className="text-[#FFB830]" />
                    <h2 className="text-base font-black text-white">{t('reset_all_progress')}</h2>
                  </div>
                  <p className="text-sm leading-6 text-white/54">{t('reset_description')}</p>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(t('reset_confirm'))) return;
                    await resetAllProgress();
                    localStorage.removeItem('family_progress_reset_v1');
                    toast.success(t('reset_success'));
                    setTimeout(() => { location.href = '/'; }, 1000);
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#FFB830]/30 bg-[#FFB830]/10 px-4 text-sm font-bold text-[#FFE0A0] transition-colors hover:bg-[#FFB830]/15"
                >
                  {t('reset_full')}
                </button>
              </div>

              {/* Danger Zone — permanent family data deletion */}
              <div className="rounded-lg border border-[#FF7BAC]/22 bg-[#FF7BAC]/8 p-4 sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Icons.TriangleAlert size={18} className="text-[#FF7BAC]" />
                  <h2 className="text-base font-black text-[#FFD5E3]">{t('danger_zone')}</h2>
                </div>
                <p className="text-sm leading-6 text-white/62">{t('danger_zone_description')}</p>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={handleLeaveFamily}
                    disabled={leavingFamily || deletingFamily}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#FFB830]/30 bg-[#FFB830]/10 px-4 text-sm font-bold text-[#FFE0A0] transition-colors hover:bg-[#FFB830]/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {leavingFamily ? adminCopy.leavingFamily : adminCopy.leaveFamily}
                  </button>
                  <button
                    onClick={handleDeleteFamilyData}
                    disabled={deletingFamily || leavingFamily}
                    className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/14 px-4 text-sm font-bold text-[#FFD5E3] transition-colors hover:bg-[#FF7BAC]/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingFamily ? t('danger_zone_deleting') : t('danger_zone_button')}
                  </button>
                </div>
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
                  {adminCopy.addMember}
                </button>
              </div>

              {/* Add member form */}
              {addingMember && (
                <div className="bg-[#232831] rounded-xl p-4 mb-4 space-y-3 border border-[#4f9cff]/30">
                  <p className="text-sm text-[#8a8f99]">{adminCopy.addMemberHelp}</p>
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
                    placeholder={adminCopy.memberNamePlaceholder}
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
                        newMemberRole === 'PARENT' ? 'bg-[#4f9cff] text-[#06111f]' : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
                      }`}
                    >
                      {t('parent_role')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewMemberRole('CHILD')}
                      disabled={isAddingMember}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                        newMemberRole === 'CHILD' ? 'bg-[#4f9cff] text-[#06111f]' : 'bg-[#1a1f2a] text-[#8a8f99] hover:bg-[#2d3545]'
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
                      className="flex-1 py-3 rounded-xl bg-[#4f9cff] text-[#06111f] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {isAddingMember ? adminCopy.adding : adminCopy.add}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingMember(false)}
                      disabled={isAddingMember}
                      className="flex-1 py-3 rounded-xl bg-[#1a1f2a] text-[#8a8f99] font-semibold hover:bg-[#2d3545] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {adminCopy.cancel}
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
                          title={adminCopy.uploadAvatar}
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
                          {u.authUserId ? adminCopy.linked : adminCopy.notLinked}
                        </span>
                        <button
                          onClick={() => moveMember(u.id, -1)}
                          disabled={index === 0}
                          className="w-10 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          style={{ minHeight: '48px', fontSize: '18px' }}
                          title={adminCopy.moveUp}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveMember(u.id, 1)}
                          disabled={index === sortedUsers.length - 1}
                          className="w-10 rounded-xl bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                          style={{ minHeight: '48px', fontSize: '18px' }}
                          title={adminCopy.moveDown}
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
                            title={adminCopy.deleteProfile}
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
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                            <button
                              onClick={() => setIconPickerTaskId(task.id)}
                              className="group flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#5B8EFF]/24 bg-[#5B8EFF]/10 text-[#8EAFFF] transition-colors hover:border-[#5B8EFF]/50 hover:bg-[#5B8EFF]/16"
                              title={t('icon_change')}
                              aria-label={t('icon_change')}
                            >
                              <LucideIcon name={task.icon} size={21} />
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
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
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => confirmEditTask(task.id)}
                                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#4EEDB0]/18 text-[#4EEDB0] transition-colors hover:bg-[#4EEDB0]/26"
                                        title={t('confirm')}
                                      >
                                        <Icons.Check size={18} />
                                      </button>
                                      <button
                                        onClick={cancelEditTask}
                                        className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                                        title={adminCopy.cancel}
                                      >
                                        <Icons.X size={18} />
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="flex h-6 min-w-6 items-center justify-center rounded-md bg-[#4EEDB0]/14 px-1.5 text-xs font-black text-[#4EEDB0]">
                                          {idx + 1}
                                        </span>
                                        <h3 className="min-w-0 truncate text-base font-black text-white">{task.title}</h3>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => startEditTask(task)}
                                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.045] text-white/54 transition-colors hover:bg-white/[0.08] hover:text-white"
                                      title={lang === 'en' ? 'Edit habit' : '습관 이름 수정'}
                                      aria-label={lang === 'en' ? 'Edit habit' : '습관 이름 수정'}
                                    >
                                      <Icons.Pencil size={16} />
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
                                </div>

                                <div className="grid gap-2 sm:grid-cols-[112px_minmax(0,1fr)]">
                                  <label className="flex h-10 items-center gap-2 rounded-lg border border-white/8 bg-[#111224] px-2">
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

                                  <div className="grid grid-cols-7 gap-1">
                                    {ALL_DAYS.map(day => {
                                      const isOn = task.daysOfWeek.includes(day);
                                      const isWeekend = day === 'SAT' || day === 'SUN';
                                      return (
                                        <button
                                          key={day}
                                          onClick={() => toggleDay(task, day)}
                                          className={`h-10 rounded-lg text-xs font-black transition-colors ${
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
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => toggleTask(task)}
                                    className={`flex h-10 min-w-20 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-black transition-colors ${
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
                                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#FF7BAC]/14 text-[#FFB8CF] transition-colors hover:bg-[#FF7BAC]/22"
                                    title={t('delete')}
                                    aria-label={t('delete')}
                                  >
                                    <Icons.Trash2 size={15} />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-white/8 bg-[#111224] p-1">
                                {([
                                  { value: null, label: t('all_day'), icon: Icons.Clock3 },
                                  { value: 'morning', label: t('morning'), icon: Icons.Sun },
                                  { value: 'evening', label: t('evening'), icon: Icons.Moon },
                                ] as const).map(opt => {
                                  const isActive = opt.value === null ? !task.timeWindow : task.timeWindow === opt.value;
                                  const TimeIcon = opt.icon;
                                  return (
                                    <button
                                      key={String(opt.value)}
                                      onClick={() => setTimeWindow(task, opt.value)}
                                      className={`flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-black transition-colors sm:text-sm ${
                                        isActive
                                          ? 'bg-[#4EEDB0] text-[#07120E]'
                                          : 'text-white/45 hover:bg-white/[0.055] hover:text-white'
                                      }`}
                                    >
                                      <TimeIcon size={14} />
                                      <span className="truncate">{opt.label}</span>
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
          )}

          {/* ─── STORE ─── */}
          {activeTab === 'store' && (
            <div className="bg-[#141821] rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 text-[#4f9cff]">{t('store_management')}</h2>
              <div className="space-y-3 mb-6">
                {rewards.map(r => (
                  <div key={r.id} className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-[#232831]">
                    <button
                      type="button"
                      onClick={() => setRewardIconPickerRewardId(r.id)}
                      disabled={savingRewardId === r.id}
                      className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#4f9cff] flex items-center justify-center shrink-0 hover:bg-[#2d3545] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title={t('icon_change')}
                      aria-label={t('icon_change')}
                    >
                      <LucideIcon name={r.icon} size={18} />
                    </button>
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
                          aria-label={adminCopy.saleLabel}
                          value={rewardSaleNameDrafts[r.id] ?? r.sale_name ?? ''}
                          onChange={e => {
                            setRewardSaleNameDrafts(prev => ({ ...prev, [r.id]: e.target.value }));
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') void saveRewardEdit(r.id);
                            if (e.key === 'Escape') setEditingRewardId(null);
                          }}
                          placeholder={adminCopy.saleLabel}
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
                              {r.sale_enabled ? (r.sale_name?.trim() || `${r.sale_percentage}% OFF`) : `${adminCopy.saleOff} · ${r.sale_percentage}%`}
                            </span>
                          )}
                          {r.is_hidden && (
                            <span className="inline-flex mt-1 ml-1 rounded-full bg-zinc-500/20 px-2 py-0.5 text-[10px] font-semibold text-zinc-300">
                              {adminCopy.hidden}
                            </span>
                          )}
                          {r.is_sold_out && (
                            <span className="inline-flex mt-1 ml-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                              {adminCopy.soldOut}
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
                          aria-label={adminCopy.saleLabel}
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
                          placeholder={adminCopy.saleLabel}
                          disabled={savingRewardId === r.id}
                          className="min-w-[140px] flex-1 rounded-lg bg-[#1a1f2a] text-white px-3 text-sm outline-none border border-[#232831] focus:border-[#4f9cff]"
                          style={{ minHeight: 44 }}
                        />
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { sale_enabled: !r.sale_enabled }); }}
                          disabled={savingRewardId === r.id}
                          className={[
                            'px-3 rounded-lg text-xs font-semibold border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed',
                            r.sale_enabled
                              ? 'bg-rose-400/15 text-rose-300 border-rose-400/30'
                              : 'bg-[#1a1f2a] text-[#8a8f99] border-[#232831]',
                          ].join(' ')}
                          style={{ minHeight: 44 }}
                        >
                          {lang === 'en' ? 'Sale' : '세일'} {r.sale_enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { is_hidden: !r.is_hidden }); }}
                          disabled={savingRewardId === r.id}
                          className={[
                            'px-3 rounded-lg text-xs font-semibold border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed',
                            r.is_hidden
                              ? 'bg-zinc-500/20 text-zinc-200 border-zinc-400/30'
                              : 'bg-[#1a1f2a] text-[#8a8f99] border-[#232831]',
                          ].join(' ')}
                          style={{ minHeight: 44 }}
                        >
                          {r.is_hidden ? adminCopy.hidden : adminCopy.visible}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void updateRewardFlags(r.id, { is_sold_out: !r.is_sold_out }); }}
                          disabled={savingRewardId === r.id}
                          className={[
                            'px-3 rounded-lg text-xs font-semibold border shrink-0 disabled:opacity-50 disabled:cursor-not-allowed',
                            r.is_sold_out
                              ? 'bg-amber-400/15 text-amber-300 border-amber-400/30'
                              : 'bg-[#1a1f2a] text-[#8a8f99] border-[#232831]',
                          ].join(' ')}
                          style={{ minHeight: 44 }}
                        >
                          {r.is_sold_out ? adminCopy.soldOut : adminCopy.inStock}
                        </button>
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
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#4f9cff] text-[#06111f] text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">🎨</span>
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
                    className="px-4 rounded-xl bg-[#4f9cff] text-[#06111f] font-semibold min-h-[var(--touch-target)]"
                  >
                    {t('add')}
                  </button>
                </div>
              </div>

              <div className="border-t border-[#232831] mt-6 pt-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-semibold text-[#8a8f99]">{adminCopy.rewardHistory}</h3>
                  <button
                    type="button"
                    onClick={() => { void loadRewardRedemptions(); }}
                    className="px-3 py-2 rounded-lg bg-[#232831] text-[#8a8f99] hover:text-white hover:bg-[#2d3545] text-xs font-semibold transition-colors"
                  >
                    {adminCopy.refresh}
                  </button>
                </div>
                <div className="space-y-2">
                  {rewardRedemptions.map(redemption => {
                    const refunded = Boolean(redemption.refunded_at);
                    return (
                      <div
                        key={redemption.id}
                        className="flex flex-wrap items-center gap-2 rounded-xl bg-[#232831] p-3"
                      >
                        <div className="w-9 h-9 rounded-lg bg-[#1a1f2a] text-[#4f9cff] flex items-center justify-center shrink-0">
                          <LucideIcon name={redemption.reward_icon} size={18} />
                        </div>
                        <div className="min-w-[160px] flex-1">
                          <div className="text-sm font-semibold text-white truncate">
                            {redemption.reward_title}
                          </div>
                          <div className="text-xs text-[#8a8f99]">
                            {redemption.user_name} · {formatShortDateTime(redemption.redeemed_at)} · {redemption.cost_charged}pt
                          </div>
                          {refunded && (
                            <div className="text-[11px] text-[#3ddc97] mt-0.5">
                              {adminCopy.refunded} · {redemption.refunded_at ? formatShortDateTime(redemption.refunded_at) : ''}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => { void refundRedemption(redemption); }}
                          disabled={refunded || refundInFlightId === redemption.id}
                          className="px-3 rounded-lg bg-[#1a1f2a] text-[#8a8f99] text-xs font-semibold border border-[#232831] hover:border-[#3ddc97]/50 hover:text-[#3ddc97] disabled:opacity-40 disabled:hover:text-[#8a8f99] disabled:hover:border-[#232831] disabled:cursor-not-allowed transition-colors"
                          style={{ minHeight: 40 }}
                        >
                          {refundInFlightId === redemption.id ? adminCopy.processing : refunded ? adminCopy.refundComplete : adminCopy.refund}
                        </button>
                      </div>
                    );
                  })}
                  {rewardRedemptions.length === 0 && (
                    <p className="text-[#8a8f99] text-center py-4 text-sm">{adminCopy.noPurchases}</p>
                  )}
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
