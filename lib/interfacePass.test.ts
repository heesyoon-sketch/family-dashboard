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
  assert.doesNotMatch(tabs, /IntersectionObserver|getElementById|scrollTo/);
});

test('member panels combine morning and evening counts into compact tabs', () => {
  const panel = read('components/MemberPanel.tsx');
  assert.match(panel, /morningDone\}\/\{morningTasks\.length\}/);
  assert.match(panel, /eveningDone\}\/\{eveningTasks\.length\}/);
  assert.match(panel, /grid h-9 shrink-0 grid-cols-2/);
  assert.match(panel, /reference only/);
  assert.doesNotMatch(panel, /Morning routines|Evening routines/);
});

test('past completed reference routines use visual completion styling', () => {
  const card = read('components/RoutineReferenceCard.tsx');
  assert.match(card, /line-through decoration-2/);
  assert.match(card, /bg-\[var\(--bg-card\)\]\/35 opacity-55/);
  assert.match(card, /CheckCircle2/);
  assert.match(card, /!completed &&/);
});

test('automatic sale status appears in admin and family store', () => {
  const adminStore = read('components/admin/AdminStorePanel.tsx');
  const familyStore = read('components/StoreModal.tsx');
  for (const source of [adminStore, familyStore]) {
    assert.match(source, /No automatic sale today/);
    assert.match(source, /nextAutomaticSaleStatus/);
    assert.match(source, /formatAutomaticSaleDate/);
  }
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
