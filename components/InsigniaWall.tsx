'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Award, Check, Flame, Medal, Pin, Search, Sparkles, Trophy } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { InsigniaBadge } from '@/components/InsigniaBadge';
import {
  ACHIEVEMENTS,
  VISUAL_STYLE_DEFINITIONS,
  type AchievementCategory,
  type AchievementRarity,
} from '@/lib/achievements/definitions';
import {
  loadAchievementState,
  setEquippedInsignia,
  subscribeToShieldState,
  syncAchievementsOnce,
  togglePinnedAchievement,
  type ChildAchievementState,
} from '@/lib/achievements/storage';
import type { AchievementProgress } from '@/lib/achievements/engine';
import {
  archetypeColor,
  archetypeFor,
  archetypeLabel,
  buildLoadoutSummary,
  insigniaSlotsForLevel,
  TOTAL_BONUS_CAP,
} from '@/lib/progression';

const rarityOrder: AchievementRarity[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const categoryFilters: Array<AchievementCategory | 'All'> = [
  'All',
  'Weekly Quests',
  'Monthly Quests',
  'Year Journey',
  'Combo Shields',
  'Team Shields',
  'Secret Shields',
];

// Card accent colors — pulled from the badge rim palette so the chrome
// stays visually consistent with the SVG insignia inside it.
const rarityAccent: Record<AchievementRarity, { ring: string; glow: string; track: string }> = {
  common:    { ring: 'rgba(201,133,83,0.6)',   glow: 'rgba(201,133,83,0.18)',  track: '#f6c393' },
  rare:      { ring: 'rgba(91,141,239,0.7)',   glow: 'rgba(91,141,239,0.24)',  track: '#9ec1ff' },
  epic:      { ring: 'rgba(169,139,255,0.7)',  glow: 'rgba(169,139,255,0.24)', track: '#d6c5ff' },
  legendary: { ring: 'rgba(245,197,66,0.85)',  glow: 'rgba(245,197,66,0.28)',  track: '#ffe28a' },
  mythic:    { ring: 'rgba(232,90,28,0.85)',   glow: 'rgba(232,90,28,0.32)',   track: '#ff9a5a' },
};

// Single source of truth for rarity display. The chips on the filter row,
// the badge cards, the detail dialog, and the unlock overlay all read this
// — so the label and the ring color always agree.
const rarityLabel: Record<AchievementRarity, string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

function pct(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function sortBadges(a: AchievementProgress, b: AchievementProgress) {
  if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
  const rarity = rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
  if (rarity !== 0) return rarity;
  return a.displayOrder - b.displayOrder;
}

function childStateFor(state: ReturnType<typeof loadAchievementState> | null, childId: string): ChildAchievementState | undefined {
  return state?.children[childId];
}

function BadgeCard({
  badge,
  pinned,
  equipped,
  onOpen,
  onPin,
  onToggleEquip,
  canEquip,
}: {
  badge: AchievementProgress;
  pinned: boolean;
  equipped: boolean;
  onOpen: () => void;
  onPin: () => void;
  onToggleEquip: () => void;
  canEquip: boolean;
}) {
  const locked = !badge.isUnlocked;
  const secretLocked = Boolean(locked && badge.isSecret);
  const accent = rarityAccent[badge.rarity];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative min-h-[152px] overflow-hidden rounded-xl border p-3 text-left transition hover:-translate-y-0.5"
      style={{
        borderColor: accent.ring,
        background: `linear-gradient(140deg, rgba(255,255,255,0.04), rgba(255,255,255,0.012) 60%), #14172a`,
        boxShadow: locked
          ? '0 10px 24px rgba(0,0,0,0.28)'
          : `0 12px 30px rgba(0,0,0,0.32), 0 0 0 1px ${accent.glow} inset, 0 0 24px ${accent.glow}`,
      }}
    >
      <div className="absolute right-2 top-2 flex gap-1">
        {equipped && (
          <span className="rounded-full border border-emerald-300/55 bg-emerald-300/16 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-200">
            Equipped
          </span>
        )}
        <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/75">
          {secretLocked ? 'secret' : rarityLabel[badge.rarity]}
        </span>
      </div>
      <div className="flex items-start gap-3">
        <InsigniaBadge
          rarity={badge.rarity}
          icon={badge.icon}
          seed={badge.achievementId}
          locked={locked}
          size={56}
          ariaLabel={secretLocked ? 'Secret shield' : badge.title}
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="pr-12 text-sm font-black leading-tight text-white">
            {secretLocked ? 'Secret Shield' : badge.title}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-white/55">
            {secretLocked ? 'Keep showing up to reveal this surprise.' : badge.description}
          </div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${badge.progressPercent}%`,
            background: badge.isUnlocked
              ? `linear-gradient(90deg, ${accent.track}, #ffffff)`
              : accent.track,
          }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-black text-white/65">
        <span>{badge.progressCurrent}/{badge.progressTarget}</span>
        <span>{badge.isUnlocked ? 'Unlocked' : `${badge.progressPercent}%`}</span>
      </div>
      {badge.isUnlocked && (
        <span className="absolute bottom-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-400 text-slate-950">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      {badge.isUnlocked && (
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation();
            onPin();
          }}
          className={`absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full ${pinned ? 'bg-amber-300 text-slate-950' : 'bg-black/40 text-white/65'}`}
          title={pinned ? 'Pinned' : 'Pin shield'}
        >
          <Pin size={13} />
        </span>
      )}
      {badge.isUnlocked && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!canEquip && !equipped) return;
            onToggleEquip();
          }}
          disabled={!canEquip && !equipped}
          className={[
            'absolute bottom-2 left-9 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider transition',
            equipped
              ? 'bg-emerald-300 text-slate-950 hover:brightness-95'
              : canEquip
                ? 'border border-white/20 bg-black/40 text-white/72 hover:bg-white/10'
                : 'border border-white/10 bg-black/30 text-white/30 cursor-not-allowed',
          ].join(' ')}
          title={equipped ? 'Unequip' : canEquip ? 'Equip to active loadout' : 'No free slot — unequip another first'}
        >
          {equipped ? 'Equipped' : 'Equip'}
        </button>
      )}
    </button>
  );
}

function BadgeDetail({
  badge,
  onClose,
  equipped,
  canEquip,
  onToggleEquip,
}: {
  badge: AchievementProgress;
  onClose: () => void;
  equipped: boolean;
  canEquip: boolean;
  onToggleEquip?: () => void;
}) {
  const secretLocked = Boolean(!badge.isUnlocked && badge.isSecret);
  const accent = rarityAccent[badge.rarity];
  const archetype = archetypeFor(badge.category);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border p-6 shadow-2xl"
        style={{
          borderColor: accent.ring,
          background: 'linear-gradient(160deg, #1a1d33 0%, #0f1120 100%)',
          boxShadow: `0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px ${accent.glow} inset, 0 0 32px ${accent.glow}`,
        }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <InsigniaBadge
            rarity={badge.rarity}
            icon={badge.icon}
            seed={badge.achievementId}
            locked={!badge.isUnlocked}
            size={104}
            showSparkles
            ariaLabel={secretLocked ? 'Secret shield' : badge.title}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">
              {secretLocked ? 'Secret' : rarityLabel[badge.rarity]}
            </div>
            <h2 className="mt-0.5 text-2xl font-black text-white">{secretLocked ? 'Secret Shield' : badge.title}</h2>
            <div className="text-sm font-bold text-white/55">{badge.category}</div>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-white/72">
          {secretLocked ? 'This shield stays hidden until it is earned.' : badge.description}
        </p>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full"
            style={{ width: `${badge.progressPercent}%`, background: `linear-gradient(90deg, ${accent.track}, #ffffff)` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-sm font-black text-white/70">
          <span>{badge.progressCurrent}/{badge.progressTarget}</span>
          <span>+{badge.rewardPoints ?? 0}pt</span>
        </div>
        <div
          className="mt-4 rounded-lg border p-3 text-sm font-bold text-white/72"
          style={{ borderColor: `${archetypeColor(archetype)}45`, background: `${archetypeColor(archetype)}10` }}
        >
          <div className="text-[10px] font-black uppercase tracking-wider text-white/55">Playstyle archetype</div>
          <div className="mt-0.5 text-base font-black text-white">{archetypeLabel(archetype)}</div>
        </div>
        {badge.unlocksVisualStyleIds?.length ? (
          <div className="mt-2 rounded-lg border border-white/10 bg-black/30 p-3 text-sm font-bold text-white/75">
            Visual unlock: {badge.unlocksVisualStyleIds.map(id => VISUAL_STYLE_DEFINITIONS.find(v => v.visualStyleId === id)?.name ?? id).join(', ')}
          </div>
        ) : null}
        {badge.isUnlocked && onToggleEquip && (
          <button
            type="button"
            onClick={onToggleEquip}
            disabled={!canEquip && !equipped}
            className={[
              'mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-black transition',
              equipped
                ? 'bg-emerald-300 text-slate-950 hover:brightness-95'
                : canEquip
                  ? 'bg-white text-slate-950 hover:bg-white/90'
                  : 'border border-white/10 bg-white/[0.04] text-white/40 cursor-not-allowed',
            ].join(' ')}
          >
            {equipped ? 'Unequip shield' : canEquip ? 'Equip to active loadout' : 'Loadout full — unequip another shield first'}
          </button>
        )}
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-black text-white/72 transition hover:bg-white/10 hover:text-white">
          Close
        </button>
      </div>
    </div>
  );
}

export function InsigniaWall() {
  const familyId = useFamilyStore(s => s.familyId);
  const users = useFamilyStore(s => s.users);
  const tasksByUser = useFamilyStore(s => s.tasksByUser);
  const levelsByUser = useFamilyStore(s => s.levelsByUser);
  const momentumByUser = useFamilyStore(s => s.momentumByUser);
  const harmony = useFamilyStore(s => s.harmony);
  const hydrate = useFamilyStore(s => s.hydrate);
  const hydrated = useFamilyStore(s => s.hydrated);
  const searchParams = useSearchParams();
  const memberQuery = searchParams.get('member');
  // Everyone in the family — kids and parents — can earn insignias and
  // appears in the member picker.
  const members = useMemo(() => {
    return users.slice().sort((a, b) => {
      if (a.role !== b.role) return a.role === 'CHILD' ? -1 : 1;
      return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
    });
  }, [users]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(memberQuery);
  const [state, setState] = useState<ReturnType<typeof loadAchievementState> | null>(null);
  const [achievementsByChild, setAchievementsByChild] = useState<Record<string, AchievementProgress[]>>({});
  const [category, setCategory] = useState<AchievementCategory | 'All'>('All');
  const [rarity, setRarity] = useState<AchievementRarity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<AchievementProgress | null>(null);

  useEffect(() => {
    hydrate().catch(console.error);
  }, [hydrate]);

  // syncAchievements fetches fresh tasks + completions internally; tasksByUser
  // and levelsByUser are only used as fallback maps. Subscribing the effect
  // to those map references would re-run the (heavy) sync on every hydrate,
  // even when no relevant data changed. Key on the stable member ID list
  // instead so the sync runs once per actual member-set change.
  const memberSignature = members.map(m => m.id).join(',');
  useEffect(() => {
    if (!familyId || members.length === 0) return;
    syncAchievementsOnce({ familyId, children: members, tasksByUser, levelsByUser })
      .then(result => {
        setState(result.state);
        setAchievementsByChild(result.achievementsByChild);
      })
      .catch(console.error);
    // tasksByUser / levelsByUser intentionally omitted — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, memberSignature]);

  useEffect(() => subscribeToShieldState(detail => {
    if (!familyId || detail.familyId !== familyId) return;
    setState(detail.state);
    if (detail.achievementsByChild) {
      setAchievementsByChild(detail.achievementsByChild);
    }
  }), [familyId]);

  const selectedChild = members.find(member => member.id === selectedChildId) ?? members[0];
  const childState = selectedChild ? childStateFor(state, selectedChild.id) : undefined;
  const allBadges = selectedChild ? (achievementsByChild[selectedChild.id] ?? []) : [];
  const filtered = allBadges
    .filter(badge => category === 'All' || badge.category === category)
    .filter(badge => rarity === 'all' || badge.rarity === rarity)
    .filter(badge => !query.trim() || `${badge.title} ${badge.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort(sortBadges);
  const unlocked = allBadges.filter(badge => badge.isUnlocked);
  const almostThere = allBadges.filter(badge => !badge.isUnlocked && badge.progressPercent >= 70).sort((a, b) => b.progressPercent - a.progressPercent).slice(0, 6);
  const recent = unlocked.slice().sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')).slice(0, 6);
  const pinned = childState?.pinnedAchievementIds ?? [];
  const topBadges = pinned.length > 0
    ? pinned.map(id => allBadges.find(badge => badge.achievementId === id)).filter((badge): badge is AchievementProgress => Boolean(badge))
    : unlocked.slice().sort((a, b) => rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity)).slice(0, 5);
  const activeDays = allBadges.find(badge => badge.achievementId === 'year-active-days-365')?.progressCurrent ?? 0;
  const memberLevel = selectedChild ? (levelsByUser[selectedChild.id]?.currentLevel ?? 1) : 1;
  const slotCapacity = insigniaSlotsForLevel(memberLevel);
  const equippedIds = childState?.equippedInsigniaIds ?? [];
  // React Compiler memoizes this automatically; explicit useMemo here would
  // fight the compiler, so we compute directly.
  const loadout = buildLoadoutSummary(equippedIds, allBadges);
  const memberMomentum = selectedChild ? momentumByUser[selectedChild.id] : undefined;
  const totalBonus = Math.min(
    TOTAL_BONUS_CAP,
    loadout.loadoutBonusPercent
      + (memberMomentum?.bonusPercent ?? 0)
      + (harmony?.bonusPercent ?? 0),
  );

  const pinBadge = (achievementId: string) => {
    if (!familyId || !selectedChild) return;
    setState(togglePinnedAchievement(familyId, members, selectedChild.id, achievementId));
  };

  const toggleEquip = (achievementId: string) => {
    if (!familyId || !selectedChild) return;
    const isEquipped = equippedIds.includes(achievementId);
    setState(setEquippedInsignia(
      familyId,
      members,
      selectedChild.id,
      achievementId,
      !isEquipped,
      slotCapacity,
    ));
  };

  if (!hydrated || !familyId) {
    return <div className="min-h-full bg-[#0b0d12]" />;
  }

  return (
    <div className="min-h-full bg-[#0b0d12] text-white">
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_18%_10%,rgba(255,209,102,0.18),transparent_28%),linear-gradient(135deg,#151827,#10121d)] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#FFD166]">
                <Medal size={14} /> Shield Wall
              </div>
              <h1 className="mt-1 truncate text-2xl font-black">Year-long growth and rare shields</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-white/58">
                Built for resilience: showing up day after day, helping each other, and collecting premium shield rewards without chasing perfect days.
              </p>
            </div>
            <div className="hidden rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-right sm:block">
              <div className="text-[10px] font-black uppercase text-white/40">Progress</div>
              <div className="text-sm font-black">{unlocked.length}/{ACHIEVEMENTS.length}</div>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="grid grid-cols-2 gap-2">
              {members.map(member => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedChildId(member.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-black ${member.id === selectedChild?.id ? 'border-[#4EEDB0]/60 bg-[#4EEDB0]/14' : 'border-white/10 bg-white/[0.04]'}`}
                >
                  <div className="truncate">{member.name}</div>
                  <div className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-white/45">
                    {member.role === 'PARENT' ? 'Parent' : 'Kid'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Active Loadout</h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-white/45">
                Lv.{memberLevel} · {equippedIds.length}/{slotCapacity} slots
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {Array.from({ length: 3 }).map((_, idx) => {
                const isUnlockedSlot = idx < slotCapacity;
                const slotBadge = loadout.equipped[idx]?.badge;
                const archetype = loadout.equipped[idx]?.archetype;
                if (!isUnlockedSlot) {
                  const unlockAt = idx === 1 ? 5 : 10;
                  return (
                    <div
                      key={`slot-locked-${idx}`}
                      className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/12 bg-white/[0.02] text-center text-[10px] font-black text-white/45"
                      title={`This slot unlocks at Lv.${unlockAt}`}
                    >
                      <span>
                        🔒
                        <span className="mt-0.5 block">Lv.{unlockAt}</span>
                      </span>
                    </div>
                  );
                }
                if (!slotBadge) {
                  return (
                    <div
                      key={`slot-empty-${idx}`}
                      className="grid aspect-square place-items-center rounded-lg border border-dashed border-white/12 bg-white/[0.02] text-[10px] font-bold text-white/40"
                    >
                      Empty
                    </div>
                  );
                }
                return (
                  <button
                    key={slotBadge.achievementId}
                    type="button"
                    onClick={() => setDetail(slotBadge)}
                    className="group relative grid aspect-square place-items-center rounded-lg border bg-black/24 transition hover:bg-black/40"
                    style={{ borderColor: archetype ? `${archetypeColor(archetype)}55` : 'rgba(255,255,255,0.10)' }}
                    title={`${slotBadge.title} · ${archetype ? archetypeLabel(archetype) : ''}`}
                  >
                    <InsigniaBadge
                      rarity={slotBadge.rarity}
                      icon={slotBadge.icon}
                      seed={slotBadge.achievementId}
                      size={42}
                      ariaLabel={slotBadge.title}
                    />
                  </button>
                );
              })}
            </div>
            {slotCapacity < 3 && (
              <p className="mt-3 text-[11px] font-bold leading-snug text-white/45">
                Reach Lv.{slotCapacity === 1 ? 5 : 10} to unlock the next slot.
              </p>
            )}
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-black/24 p-2 text-center">
              <BonusMeter label="Loadout"  value={loadout.loadoutBonusPercent} />
              <BonusMeter label="Momentum" value={memberMomentum?.bonusPercent ?? 0} />
              <BonusMeter label="Harmony"  value={harmony?.bonusPercent ?? 0} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-black text-white/65">
              <span>Total bonus</span>
              <span className="text-emerald-300">+{Math.round(totalBonus * 10) / 10}%</span>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Metric icon={<Trophy size={16} />} label="Unlocked" value={`${unlocked.length}/${ACHIEVEMENTS.length}`} />
              <Metric icon={<Sparkles size={16} />} label="Complete" value={`${pct(unlocked.length, ACHIEVEMENTS.length)}%`} />
              <Metric icon={<Flame size={16} />} label="Perfect Days" value={`${allBadges.filter(b => b.category === 'Perfect Days' && b.isUnlocked).length}`} />
              <Metric icon={<Award size={16} />} label="Year Days" value={`${activeDays}/365`} />
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <h2 className="text-sm font-black">Top Shields</h2>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {topBadges.map(badge => (
                <button
                  key={badge.achievementId}
                  type="button"
                  onClick={() => setDetail(badge)}
                  className="grid aspect-square place-items-center rounded-lg p-1 transition hover:bg-white/[0.04]"
                >
                  <InsigniaBadge
                    rarity={badge.rarity}
                    icon={badge.icon}
                    seed={badge.achievementId}
                    locked={!badge.isUnlocked}
                    size={48}
                    ariaLabel={badge.title}
                  />
                </button>
              ))}
              {topBadges.length === 0 && (
                <div className="col-span-5 rounded-lg border border-dashed border-white/10 p-3 text-center text-[11px] font-bold text-white/45">
                  Earn your first shield to see it here.
                </div>
              )}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid gap-3 xl:grid-cols-2">
            <Panel title="Recently Unlocked" items={recent} onOpen={setDetail} />
            <Panel title="Almost There" items={almostThere} onOpen={setDetail} />
          </div>

          <div className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/36" size={16} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search shields"
                  className="w-full rounded-lg border border-white/10 bg-black/18 py-2 pl-9 pr-3 text-sm font-bold outline-none focus:border-[#4EEDB0]/60"
                />
              </div>
              <select value={rarity} onChange={event => setRarity(event.target.value as AchievementRarity | 'all')} className="rounded-lg border border-white/10 bg-black/18 px-3 py-2 text-sm font-bold">
                <option value="all">All rarities</option>
                {rarityOrder.map(r => <option key={r} value={r}>{rarityLabel[r]}</option>)}
              </select>
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categoryFilters.map(filter => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setCategory(filter)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black ${category === filter ? 'border-[#4EEDB0]/60 bg-[#4EEDB0]/14 text-[#4EEDB0]' : 'border-white/10 bg-white/[0.04] text-white/62'}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(badge => {
              const isEquipped = equippedIds.includes(badge.achievementId);
              return (
                <BadgeCard
                  key={badge.achievementId}
                  badge={badge}
                  pinned={pinned.includes(badge.achievementId)}
                  equipped={isEquipped}
                  canEquip={equippedIds.length < slotCapacity}
                  onOpen={() => setDetail(badge)}
                  onPin={() => pinBadge(badge.achievementId)}
                  onToggleEquip={() => toggleEquip(badge.achievementId)}
                />
              );
            })}
          </div>
        </section>
      </main>

      {detail && (
        <BadgeDetail
          badge={detail}
          equipped={equippedIds.includes(detail.achievementId)}
          canEquip={equippedIds.length < slotCapacity}
          onToggleEquip={() => toggleEquip(detail.achievementId)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/18 p-3">
      <div className="flex items-center gap-2 text-white/42">{icon}<span className="text-[10px] font-black uppercase">{label}</span></div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function BonusMeter({ label, value }: { label: string; value: number }) {
  const dim = value <= 0;
  return (
    <div className="rounded-md bg-white/[0.04] p-2">
      <div className="text-[9px] font-black uppercase tracking-wider text-white/45">{label}</div>
      <div className={`mt-0.5 text-sm font-black tabular-nums ${dim ? 'text-white/35' : 'text-emerald-300'}`}>+{Math.round(value * 10) / 10}%</div>
    </div>
  );
}

function Panel({ title, items, onOpen }: { title: string; items: AchievementProgress[]; onOpen: (badge: AchievementProgress) => void }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
      <h2 className="text-sm font-black">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <div className="rounded-lg bg-white/[0.04] p-3 text-xs font-bold text-white/42">Keep going. Progress will appear here.</div>}
        {items.slice(0, 4).map(item => {
          const secretLocked = Boolean(item.isSecret && !item.isUnlocked);
          return (
            <button
              key={item.achievementId}
              type="button"
              onClick={() => onOpen(item)}
              className="flex w-full items-center gap-3 rounded-lg bg-white/[0.04] p-2 text-left transition hover:bg-white/[0.08]"
            >
              <InsigniaBadge
                rarity={item.rarity}
                icon={item.icon}
                seed={item.achievementId}
                locked={!item.isUnlocked}
                size={36}
                ariaLabel={secretLocked ? 'Secret shield' : item.title}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black">{secretLocked ? 'Secret Shield' : item.title}</span>
                <span className="block text-[10px] font-bold text-white/45">{item.progressPercent}% · {rarityLabel[item.rarity]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
