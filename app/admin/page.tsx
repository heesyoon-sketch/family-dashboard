'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as Icons from 'lucide-react';
import { User, Task, Reward, DayOfWeek, ALL_DAYS, ThemeName, UserRole } from '@/lib/db';
import { getCurrentFamilyAdminPinHash, saveAdminPin, verifyAdminPin } from '@/lib/adminPin';
import { deleteCurrentFamilyData } from '@/lib/deleteFamilyData';
import { useFamilyStore } from '@/lib/store';
import { createBrowserSupabase } from '@/lib/supabase';
import { clearFamilySessionStorage } from '@/lib/localSessionStorage';
import { useLanguage } from '@/contexts/LanguageContext';
import { normalizeTimeWindow, type TaskTimeWindow, type TimeWindow } from '@/lib/timeWindows';
import { IconPicker } from '@/components/admin/IconPicker';
import { AdminHeader, AdminTabBar, type AdminTabKey } from '@/components/admin/AdminChrome';
import { AdminPinGate } from '@/components/admin/AdminPinGate';
import { AdminSettingsPanel } from '@/components/admin/AdminSettingsPanel';
import { AdminFamilyPanel } from '@/components/admin/AdminFamilyPanel';
import { AdminTasksPanel } from '@/components/admin/AdminTasksPanel';
import { AdminStorePanel } from '@/components/admin/AdminStorePanel';
import {
  buildRefundPrompt,
  mapReward,
  mapRewardRedemption,
  mapTask,
  normaliseSalePercentage,
  type RewardRedemption,
  type SaveStatus,
} from '@/lib/admin/adminHelpers';
import { buildAdminCopy } from '@/lib/admin/adminCopy';

function notifyDashboard() {
  const ch = new BroadcastChannel('habit_sync');
  ch.postMessage('update');
  ch.close();
}

type View = 'pin' | 'dashboard';

export default function AdminPage() {
  const { lang, t } = useLanguage();
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
  const [rewardProcessInFlightId, setRewardProcessInFlightId] = useState<string | null>(null);
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
  const [exportingSnapshot, setExportingSnapshot] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTabKey>('settings');
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
  const adminCopy = buildAdminCopy(lang);

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
      // Bring up the realtime channel for this family even if the user
      // landed here without first visiting the dashboard.
      useFamilyStore.getState().hydrate().catch(err => console.warn('[admin hydrate]', err));

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
        supabase.from('users').select('*').eq('family_id', resolvedFamilyId).is('deleted_at', null).order('display_order', { ascending: true }).order('created_at', { ascending: true }),
        supabase.from('rewards').select('*').eq('family_id', resolvedFamilyId).is('deleted_at', null).order('cost_points'),
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
    clearFamilySessionStorage();
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
      clearFamilySessionStorage();
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

      clearFamilySessionStorage();
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

  const exportFamilySnapshot = async () => {
    if (!familyId || exportingSnapshot) return;
    setExportingSnapshot(true);
    try {
      const supabase = createBrowserSupabase();
      const userIds = allUsers.map(user => user.id);
      const safeIds = userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'];
      const [
        tasksRes,
        rewardsRes,
        levelsRes,
        streaksRes,
        completionsRes,
        activitiesRes,
      ] = await Promise.all([
        supabase.from('tasks').select('*').eq('family_id', familyId).is('deleted_at', null).order('sort_order'),
        supabase.from('rewards').select('*').eq('family_id', familyId).is('deleted_at', null).order('cost_points'),
        supabase.from('levels').select('*').in('user_id', safeIds),
        supabase.from('streaks').select('*').in('user_id', safeIds),
        supabase.from('task_completions').select('*').in('user_id', safeIds).order('completed_at', { ascending: false }),
        supabase.from('family_activities').select('*').eq('family_id', familyId).order('created_at', { ascending: false }),
      ]);

      const firstError = [
        tasksRes.error,
        rewardsRes.error,
        levelsRes.error,
        streaksRes.error,
        completionsRes.error,
        activitiesRes.error,
      ].find(Boolean);
      if (firstError) throw firstError;

      const snapshot = {
        exportedAt: new Date().toISOString(),
        family: { id: familyId, name: familyName, inviteCode: familyInviteCode },
        users: allUsers,
        tasks: tasksRes.data ?? [],
        rewards: rewardsRes.data ?? [],
        levels: levelsRes.data ?? [],
        streaks: streaksRes.data ?? [],
        completions: completionsRes.data ?? [],
        activities: activitiesRes.data ?? [],
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fambit-family-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(adminCopy.exportSnapshotDone);
    } catch (error) {
      console.error(error);
      toast.error(adminCopy.exportSnapshotFailed);
    } finally {
      setExportingSnapshot(false);
    }
  };

  const generateInviteCode = async () => {
    if (generatingCode || !familyId) return;
    setGeneratingCode(true);
    try {
      const supabase = createBrowserSupabase();
      // Crockford-style alphabet (no 0/1/I/O) so a kid reading the code from
      // a sibling's screen is less likely to mistype it. crypto.getRandomValues
      // replaces Math.random — invite codes gate family access, so weak PRNG
      // wasn't appropriate even though the search space is small.
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const generate = (): string => {
        const bytes = new Uint8Array(6);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, b => chars[b % chars.length]).join('');
      };

      // Retry on the rare unique-constraint collision (32^6 ≈ 1B keyspace
      // makes this essentially impossible at family scale, but the loop is
      // free and turns the surprise rare-failure into clean recovery).
      let lastError: { code?: string; message: string } | null = null;
      let savedCode: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generate();
        const { error } = await supabase.from('families').update({ invite_code: candidate }).eq('id', familyId);
        if (!error) { savedCode = candidate; break; }
        lastError = error;
        if (error.code !== '23505') break; // anything other than unique-violation is a real failure
      }
      if (!savedCode) throw lastError ?? new Error('invite_code_generation_failed');
      setFamilyInviteCode(savedCode);
      toast.success('새 초대 코드가 생성되었습니다');
    } catch (e) {
      console.error('[admin] invite code generation failed', e);
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
      `'${target.name}' 멤버를 삭제하려고 합니다.\n\n` +
      `• 대시보드와 통계에서 즉시 사라집니다.\n` +
      `• 습관, 완료 기록, 포인트는 보존되며 잠시 후 알림으로 되돌릴 수 있어요.\n` +
      `• 영구 삭제는 별도로 가능합니다.\n\n` +
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
    // Soft-delete via RPC (migration 060). Server enforces parent admin auth
    // and refuses to remove the last parent.
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: userId });
    if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    setAllUsers(prev => prev.filter(u => u.id !== userId));
    await storeHydrate();
    notifyDashboard();

    toast.success(`${target.name} 삭제됨`, {
      action: {
        label: '되돌리기',
        onClick: async () => {
          const { error: restoreErr } = await supabase.rpc('admin_restore_user', { p_user_id: userId });
          if (restoreErr) { toast.error(restoreErr.message); return; }
          setAllUsers(prev => [...prev, target].sort((a, b) =>
            a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime()
          ));
          await storeHydrate();
          notifyDashboard();
          toast.success(`${target.name} 복구됨`);
        },
      },
      duration: 8000,
    });
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
      if (secondError) {
        // The swap is two non-atomic writes; if the second fails, the first
        // already landed and both members now share `otherOrder`. Compensate by
        // restoring the first member so we never leave a duplicate order behind.
        await supabase
          .from('users')
          .update({ display_order: currentOrder })
          .eq('id', current.id);
        throw secondError;
      }

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
    const { data } = await supabase.from('tasks').select('*').eq('user_id', user.id).is('deleted_at', null).order('sort_order');
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
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, active: newActive } : t));
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { active: newActive } });
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, active: task.active } : t));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const deleteTask = async (taskId: string) => {
    const target = tasks.find(t => t.id === taskId);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_delete_task', { p_task_id: taskId });
    if (error) { toast.error(error.message); return; }
    setTasks(prev => prev.filter(task => task.id !== taskId));
    await storeHydrate();
    router.refresh();
    notifyDashboard();

    if (!target) return;
    toast.success(`'${target.title}' 삭제됨`, {
      action: {
        label: '되돌리기',
        onClick: async () => {
          const { error: restoreErr } = await supabase.rpc('admin_restore_task', { p_task_id: taskId });
          if (restoreErr) { toast.error(restoreErr.message); return; }
          setTasks(prev => [...prev, target].sort((a, b) => a.sortOrder - b.sortOrder));
          await storeHydrate();
          router.refresh();
          notifyDashboard();
          toast.success(`'${target.title}' 복구됨`);
        },
      },
      duration: 8000,
    });
  };

  const moveTask = async (index: number, dir: 'up' | 'down') => {
    const other = dir === 'up' ? index - 1 : index + 1;
    if (other < 0 || other >= tasks.length) return;
    const supabase = createBrowserSupabase();
    const aOrder = tasks[index].sortOrder;
    const bOrder = tasks[other].sortOrder;
    const previousTasks = tasks;
    const updated = tasks.map((task, i) => {
      if (i === index) return { ...task, sortOrder: bOrder };
      if (i === other) return { ...task, sortOrder: aOrder };
      return task;
    });
    setTasks(updated.sort((a, b) => a.sortOrder - b.sortOrder));
    const [res1, res2] = await Promise.all([
      supabase.rpc('admin_update_task', { p_task_id: tasks[index].id, p_patch: { sort_order: bOrder } }),
      supabase.rpc('admin_update_task', { p_task_id: tasks[other].id, p_patch: { sort_order: aOrder } }),
    ]);
    const firstError = res1.error ?? res2.error;
    if (firstError) {
      // Roll back to the original order. We don't try to recover one half
      // even if the other succeeded — that would leave the DB in a stable
      // but reordered state we never intended. Let the next hydrate sync it.
      setTasks(previousTasks);
      toast.error(`${t('task_save_failed')}: ${firstError.message}`);
      return;
    }
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
    const previous = tasks.find(task => task.id === taskId);
    if (!previous) return;
    const supabase = createBrowserSupabase();
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, title: trimmed } : task));
    setEditingTaskId(null);
    setEditingTaskTitle('');
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { title: trimmed } });
    if (error) {
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, title: previous.title } : task));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const selectIcon = async (taskId: string, icon: string) => {
    const previous = tasks.find(task => task.id === taskId);
    if (!previous) return;
    const supabase = createBrowserSupabase();
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, icon } : task));
    setIconPickerTaskId(null);
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { icon } });
    if (error) {
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, icon: previous.icon } : task));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const saveDaysOfWeek = async (task: Task, daysOfWeek: DayOfWeek[]) => {
    const previousDays = task.daysOfWeek;
    const supabase = createBrowserSupabase();
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, daysOfWeek } : t));
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { days_of_week: daysOfWeek } });
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, daysOfWeek: previousDays } : t));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
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

  const selectedTimeWindows = (taskWindow: string | null | undefined): TimeWindow[] => {
    const normalized = normalizeTimeWindow(taskWindow);
    if (normalized === 'both') return ['morning', 'evening'];
    return [normalized];
  };

  const timeWindowsToTaskWindow = (windows: TimeWindow[]): TaskTimeWindow => {
    return windows.includes('morning') && windows.includes('evening')
      ? 'both'
      : windows.includes('morning')
        ? 'morning'
        : 'evening';
  };

  const toggleTimeWindow = async (task: Task, timeWindow: TimeWindow) => {
    const current = selectedTimeWindows(task.timeWindow);
    const active = current.includes(timeWindow);
    if (active && current.length === 1) {
      toast.error(lang === 'en' ? 'Select at least one time window.' : '시간대를 하나 이상 선택해주세요.');
      return;
    }
    const nextWindows = active
      ? current.filter(value => value !== timeWindow)
      : (['morning', 'evening'] as TimeWindow[]).filter(value => current.includes(value) || value === timeWindow);
    const timeWindowValue = timeWindowsToTaskWindow(nextWindows);
    const previousWindow = task.timeWindow;
    const supabase = createBrowserSupabase();
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, timeWindow: timeWindowValue } : t));
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: task.id, p_patch: { time_window: timeWindowValue } });
    if (error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, timeWindow: previousWindow } : t));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
    await storeHydrate();
    router.refresh();
    notifyDashboard();
  };

  const updateTaskPoints = async (taskId: string, rawValue: number) => {
    const pts = Math.max(1, Math.round(rawValue) || 1);
    const previous = tasks.find(task => task.id === taskId);
    if (!previous) return;
    const supabase = createBrowserSupabase();
    setTasks(prev => prev.map(task => task.id === taskId ? { ...task, basePoints: pts } : task));
    const { error } = await supabase.rpc('admin_update_task', { p_task_id: taskId, p_patch: { base_points: pts } });
    if (error) {
      setTasks(prev => prev.map(task => task.id === taskId ? { ...task, basePoints: previous.basePoints } : task));
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
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
    const target = rewards.find(r => r.id === rewardId);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_delete_reward', { p_reward_id: rewardId });
    if (error) { toast.error(error.message); return; }
    setRewards(prev => prev.filter(r => r.id !== rewardId));
    await storeHydrate();
    router.refresh();
    notifyDashboard();

    if (!target) return;
    toast.success(`'${target.title}' 삭제됨`, {
      action: {
        label: '되돌리기',
        onClick: async () => {
          const { error: restoreErr } = await supabase.rpc('admin_restore_reward', { p_reward_id: rewardId });
          if (restoreErr) { toast.error(restoreErr.message); return; }
          setRewards(prev => [...prev, target].sort((a, b) => a.cost_points - b.cost_points));
          await storeHydrate();
          router.refresh();
          notifyDashboard();
          toast.success(`'${target.title}' 복구됨`);
        },
      },
      duration: 8000,
    });
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
    const confirmed = confirm(buildRefundPrompt(redemption, lang));
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

  const markRewardProcessed = async (redemption: RewardRedemption) => {
    if (rewardProcessInFlightId || redemption.refunded_at || redemption.processed_at) return;

    setRewardProcessInFlightId(redemption.id);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_mark_reward_redemption_processed', {
      p_redemption_id: redemption.id,
    });

    if (error) {
      setRewardProcessInFlightId(null);
      toast.error(`처리 실패: ${error.message}`);
      return;
    }

    await loadRewardRedemptions();
    setRewardProcessInFlightId(null);
    toast.success('처리 완료');
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
    const previous = allUsers.find(u => u.id === userId);
    if (!previous) return;
    const supabase = createBrowserSupabase();
    const updated = allUsers.map(u => u.id === userId ? { ...u, name: trimmed } : u);
    setAllUsers(updated);
    if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, name: trimmed } : prev);
    setEditingUserId(null);
    setEditingName('');
    const { error } = await supabase.rpc('admin_update_user_name', { p_user_id: userId, p_name: trimmed });
    if (error) {
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, name: previous.name } : u));
      if (selectedUser?.id === userId) setSelectedUser(prev => prev ? { ...prev, name: previous.name } : prev);
      toast.error(`${t('task_save_failed')}: ${error.message}`);
      return;
    }
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
      <AdminPinGate
        familyName={familyName}
        adminModeLabel={t('admin_mode')}
        enterPinLabel={t('enter_parent_pin')}
        confirmLabel={t('confirm')}
        backLabel={t('back_to_dashboard')}
        logoutLabel={t('logout')}
        cancelLabel={adminCopy.cancel}
        pin={pin}
        setPin={setPin}
        error={error}
        adminPinHash={adminPinHash}
        isParentAdmin={isParentAdmin}
        isFamilyOwner={isFamilyOwner}
        onSubmit={handlePinSubmit}
        onLogout={handleLogout}
        onPinReset={handlePinReset}
        pinResetLoading={pinResetLoading}
        pinResetStep={pinResetStep}
        setPinResetStep={setPinResetStep}
        authEmail={authProfile.email}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpError={otpError}
        setOtpError={setOtpError}
        otpLoading={otpLoading}
        onOtpVerify={handleOtpVerify}
      />
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
        <AdminHeader
          familyName={familyName}
          settingsLabel={adminCopy.tabs.settings}
          adminModeLabel={t('admin_mode')}
          feedbackLabel={t('feedback')}
          feedbackSubtitle={t('feedback_subtitle')}
          backLabel={t('back_to_dashboard')}
          authProfile={authProfile}
        />

        <AdminTabBar
          activeTab={activeTab}
          labels={adminCopy.tabs}
          selectedUser={selectedUser}
          sortedUsers={sortedUsers}
          onSelectTab={setActiveTab}
          loadTasks={loadTasks}
        />

        {/* Tab content */}
        <div key={activeTab} className="max-w-4xl mx-auto px-4 py-6 animate-fade-in">

          {activeTab === 'settings' && (
            <AdminSettingsPanel
              familyInviteCode={familyInviteCode}
              generatingCode={generatingCode}
              copyInviteCode={copyInviteCode}
              generateInviteCode={generateInviteCode}
              currentPinInput={currentPinInput}
              setCurrentPinInput={setCurrentPinInput}
              newPinInput={newPinInput}
              setNewPinInput={setNewPinInput}
              confirmPinInput={confirmPinInput}
              setConfirmPinInput={setConfirmPinInput}
              pinChanging={pinChanging}
              handleChangePin={handleChangePin}
              exportingSnapshot={exportingSnapshot}
              exportFamilySnapshot={exportFamilySnapshot}
              leavingFamily={leavingFamily}
              deletingFamily={deletingFamily}
              handleLeaveFamily={handleLeaveFamily}
              handleDeleteFamilyData={handleDeleteFamilyData}
            />
          )}

          {activeTab === 'family' && (
            <AdminFamilyPanel
              sortedUsers={sortedUsers}
              addingMember={addingMember}
              setAddingMember={setAddingMember}
              newMemberName={newMemberName}
              setNewMemberName={setNewMemberName}
              newMemberRole={newMemberRole}
              setNewMemberRole={setNewMemberRole}
              isAddingMember={isAddingMember}
              addMember={addMember}
              avatarInputRef={avatarInputRef}
              handleAvatarUpload={handleAvatarUpload}
              editingUserId={editingUserId}
              editingName={editingName}
              setEditingName={setEditingName}
              confirmEditName={confirmEditName}
              cancelEditName={cancelEditName}
              avatarUploadingUserId={avatarUploadingUserId}
              openAvatarUpload={openAvatarUpload}
              avatarVersion={avatarVersion}
              currentAuthUserId={currentAuthUserId}
              moveMember={moveMember}
              startEditName={startEditName}
              removeMember={removeMember}
            />
          )}

          {activeTab === 'tasks' && (
            <AdminTasksPanel
              selectedUser={selectedUser}
              sortedUsers={sortedUsers}
              tasks={tasks}
              setTasks={setTasks}
              loadTasks={loadTasks}
              avatarVersion={avatarVersion}
              setIconPickerTaskId={setIconPickerTaskId}
              editingTaskId={editingTaskId}
              editingTaskTitle={editingTaskTitle}
              setEditingTaskTitle={setEditingTaskTitle}
              confirmEditTask={confirmEditTask}
              cancelEditTask={cancelEditTask}
              startEditTask={startEditTask}
              moveTask={moveTask}
              updateTaskPoints={updateTaskPoints}
              toggleDay={toggleDay}
              toggleTask={toggleTask}
              deleteTask={deleteTask}
              selectedTimeWindows={selectedTimeWindows}
              toggleTimeWindow={toggleTimeWindow}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskPoints={newTaskPoints}
              setNewTaskPoints={setNewTaskPoints}
              isAddingTask={isAddingTask}
              addTask={addTask}
            />
          )}

          {activeTab === 'store' && (
            <AdminStorePanel
              rewards={rewards}
              editingRewardId={editingRewardId}
              setEditingRewardId={setEditingRewardId}
              editingRewardTitle={editingRewardTitle}
              setEditingRewardTitle={setEditingRewardTitle}
              savingRewardId={savingRewardId}
              rewardSaveStatus={rewardSaveStatus}
              rewardCostDrafts={rewardCostDrafts}
              setRewardCostDrafts={setRewardCostDrafts}
              rewardSalePercentageDrafts={rewardSalePercentageDrafts}
              setRewardSalePercentageDrafts={setRewardSalePercentageDrafts}
              rewardSaleNameDrafts={rewardSaleNameDrafts}
              setRewardSaleNameDrafts={setRewardSaleNameDrafts}
              setRewardIconPickerRewardId={setRewardIconPickerRewardId}
              saveRewardEdit={saveRewardEdit}
              deleteReward={deleteReward}
              updateRewardCost={updateRewardCost}
              updateRewardSale={updateRewardSale}
              updateRewardFlags={updateRewardFlags}
              newRewardIcon={newRewardIcon}
              setRewardIconPickerOpen={setRewardIconPickerOpen}
              newRewardTitle={newRewardTitle}
              setNewRewardTitle={setNewRewardTitle}
              newRewardPoints={newRewardPoints}
              setNewRewardPoints={setNewRewardPoints}
              addReward={addReward}
              rewardRedemptions={rewardRedemptions}
              refundInFlightId={refundInFlightId}
              rewardProcessInFlightId={rewardProcessInFlightId}
              loadRewardRedemptions={loadRewardRedemptions}
              refundRedemption={refundRedemption}
              markRewardProcessed={markRewardProcessed}
            />
          )}
        </div>

        {/* Logout — always visible outside tabs */}
        <div className="mx-auto max-w-4xl px-4 pb-6">
          <button
            onClick={handleLogout}
            className="inline-flex w-full min-h-[var(--touch-target)] items-center justify-center gap-2 rounded-lg border border-[#FF7BAC]/30 bg-[#FF7BAC]/10 text-sm font-black text-[#FFB8CF] transition-colors hover:border-[#FF7BAC]/55 hover:bg-[#FF7BAC]/16"
          >
            <Icons.LogOut size={16} />
            {t('logout')}
          </button>
        </div>

      </main>
    </>
  );
}
