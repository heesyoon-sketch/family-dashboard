import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

test('mobile member tabs select one mounted member dashboard', () => {
  const dashboard = read('app/page.tsx');
  const tabs = read('components/MobileMemberTabs.tsx');
  assert.match(dashboard, /activeMobileUser && <MemberPanel key=\{activeMobileUser\.id\}/);
  assert.match(tabs, /activeUserId: string \| null/);
  assert.match(tabs, /onSelectUser\(user\.id\)/);
  assert.match(tabs, /currentTaskIds\.has\(taskId\)/);
  assert.match(tabs, /role="tablist"/);
  assert.doesNotMatch(tabs, /IntersectionObserver|getElementById|scrollTo/);
});

test('member panels combine morning and evening counts into compact tabs', () => {
  const panel = read('components/MemberPanel.tsx');
  assert.match(panel, /morningDone\}\/\{morningTasks\.length\}/);
  assert.match(panel, /eveningDone\}\/\{eveningTasks\.length\}/);
  assert.match(panel, /grid h-9 shrink-0 grid-cols-2/);
  assert.match(panel, /morningPct/);
  assert.match(panel, /eveningPct/);
  assert.match(panel, /reference only/);
  assert.doesNotMatch(panel, /ProgressRing/);
  assert.doesNotMatch(panel, /Morning routines|Evening routines/);
});

test('member panels show the next reachable shield instead of a static loadout', () => {
  const panel = read('components/MemberPanel.tsx');
  const nextGoal = read('components/NextAchievementChip.tsx');
  assert.match(panel, /NextAchievementChip/);
  assert.doesNotMatch(panel, /EquippedInsigniaStrip/);
  assert.match(nextGoal, /selectNextAchievementGoals/);
  assert.match(nextGoal, /achievementRemaining/);
});

test('past completed reference routines use visual completion styling', () => {
  const card = read('components/RoutineReferenceCard.tsx');
  assert.match(card, /line-through decoration-2/);
  assert.match(card, /bg-\[var\(--bg-card\)\]\/35 opacity-55/);
  assert.match(card, /CheckCircle2/);
  assert.match(card, /data-reference-state/);
  assert.match(card, /visualState === 'missed'/);
  assert.match(card, /: 'future'/);
  assert.doesNotMatch(card, /LockKeyhole/);
});

test('automatic sale status appears in admin and family store', () => {
  const adminStore = read('components/admin/AdminStorePanel.tsx');
  const familyStore = read('components/StoreModal.tsx');
  assert.match(adminStore, /No automatic sale today/);
  assert.match(familyStore, /Next automatic sale/);
  for (const source of [adminStore, familyStore]) assert.match(source, /nextAutomaticSaleStatus/);
  for (const source of [adminStore, familyStore]) assert.match(source, /formatAutomaticSaleDate/);
});

test('perfect day reward uses one ticket design and shows a redeemed stamp', () => {
  const ticket = read('components/PerfectDayTicket.tsx');
  const wallet = read('components/PerfectDayCouponModal.tsx');
  const celebration = read('components/PerfectDayCelebrationOverlay.tsx');
  assert.match(ticket, /Perfect Day Pass/);
  assert.match(ticket, /사용 완료/);
  assert.match(wallet, /justRedeemed/);
  assert.match(wallet, /state="redeemed"/);
  assert.match(celebration, /state="awarded"/);
  assert.match(celebration, /prefers-reduced-motion/);
});

test('reward rows are compact and editing lives in a focused modal', () => {
  const panel = read('components/admin/AdminStorePanel.tsx');
  const modal = read('components/admin/RewardEditModal.tsx');
  assert.match(panel, /RewardEditModal/);
  assert.match(panel, /openRewardEditor\(reward\)/);
  assert.doesNotMatch(panel, /onBlur=\{e => \{ void updateRewardCost/);
  assert.match(modal, /Edit reward/);
  assert.match(modal, /Save reward/);
  assert.match(modal, /Manual sale/);
});

test('task pricing is selected by duration instead of arbitrary point inputs', () => {
  const panel = read('components/admin/AdminTasksPanel.tsx');
  const migration = read('supabase/migrations/102_fixed_duration_task_points.sql');
  assert.match(panel, /TASK_DURATION_OPTIONS/);
  assert.match(panel, /Estimated task duration/);
  assert.doesNotMatch(panel, /type="number"/);
  assert.match(migration, /base_points in \(10, 15, 30, 50\)/);
  assert.match(migration, /normalize_task_base_points/);
});
