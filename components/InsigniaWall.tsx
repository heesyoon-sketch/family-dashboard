'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Award, Check, Flame, Medal, Pin, Search, Sparkles, Trophy } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import {
  ACHIEVEMENTS,
  TITLE_DEFINITIONS,
  VISUAL_STYLE_DEFINITIONS,
  type AchievementCategory,
  type AchievementRarity,
} from '@/lib/achievements/definitions';
import {
  loadAchievementState,
  setEquippedTitle,
  syncAchievements,
  togglePinnedAchievement,
  type ChildAchievementState,
} from '@/lib/achievements/storage';
import type { AchievementProgress } from '@/lib/achievements/engine';

const rarityOrder: AchievementRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const categoryFilters: Array<AchievementCategory | 'All'> = [
  'All',
  'Comebacks',
  'Improvement',
  'Consistency',
  'Habit Mastery',
  'Weekly Quests',
  'Monthly Quests',
  'Year Journey',
  'Team Badges',
  'Secret Badges',
];

const rarityClass: Record<AchievementRarity, string> = {
  common: 'border-[#b7794c]/45 from-[#8a5a35]/28 to-[#d99a5b]/12 text-[#ffd6a6]',
  uncommon: 'border-[#d5dbe7]/45 from-[#b7c0ce]/22 to-[#f2f5fb]/10 text-[#edf3ff]',
  rare: 'border-[#ffd166]/58 from-[#ffd166]/28 to-[#c28a19]/12 text-[#ffe7a1]',
  epic: 'border-[#c7a6ff]/55 from-[#a78bfa]/24 to-[#f0abfc]/12 text-[#eee0ff]',
  legendary: 'border-[#ffe082]/75 from-[#ffd166]/34 to-[#ff9f1c]/16 text-[#fff1b8]',
  mythic: 'border-pink-200/75 from-pink-200/30 via-fuchsia-400/18 to-cyan-300/16 text-pink-50 shadow-[0_0_26px_rgba(244,114,182,0.24)]',
};

const metalLabel: Record<AchievementRarity, string> = {
  common: 'Bronze',
  uncommon: 'Silver',
  rare: 'Gold',
  epic: 'Platinum',
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
  onOpen,
  onPin,
}: {
  badge: AchievementProgress;
  pinned: boolean;
  onOpen: () => void;
  onPin: () => void;
}) {
  const locked = !badge.isUnlocked;
  const secretLocked = Boolean(locked && badge.isSecret);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'group relative min-h-[148px] overflow-hidden rounded-lg border bg-gradient-to-br p-3 text-left shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 hover:brightness-110',
        rarityClass[badge.rarity],
        locked ? 'opacity-58 grayscale-[0.45]' : '',
      ].join(' ')}
    >
      <div className="absolute right-2 top-2 rounded-full bg-black/22 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white/72">
        {secretLocked ? 'secret' : metalLabel[badge.rarity]}
      </div>
      <div className="flex items-start gap-3">
        <InsigniaMark badge={badge} secretLocked={secretLocked} size="md" />
        <div className="min-w-0 flex-1">
          <div className="pr-12 text-sm font-black leading-tight text-white">
            {secretLocked ? 'Secret Insignia' : badge.title}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug text-white/62">
            {secretLocked ? 'Keep showing up to reveal this surprise.' : badge.description}
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
        <div className="h-full rounded-full bg-white/75 transition-[width]" style={{ width: `${badge.progressPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-black text-white/72">
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
          className={`absolute bottom-2 left-2 grid h-6 w-6 place-items-center rounded-full ${pinned ? 'bg-amber-300 text-slate-950' : 'bg-black/22 text-white/62'}`}
          title={pinned ? 'Pinned' : 'Pin badge'}
        >
          <Pin size={13} />
        </span>
      )}
    </button>
  );
}

function BadgeDetail({ badge, onClose }: { badge: AchievementProgress; onClose: () => void }) {
  const secretLocked = Boolean(!badge.isUnlocked && badge.isSecret);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`w-full max-w-md rounded-xl border bg-gradient-to-br p-5 shadow-2xl ${rarityClass[badge.rarity]}`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <InsigniaMark badge={badge} secretLocked={secretLocked} size="lg" />
          <div>
            <div className="text-xs font-black uppercase tracking-widest text-white/55">{secretLocked ? 'Secret' : metalLabel[badge.rarity]}</div>
            <h2 className="text-2xl font-black text-white">{secretLocked ? 'Secret Insignia' : badge.title}</h2>
            <div className="text-sm font-bold text-white/62">{badge.category} · {badge.tier}</div>
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold leading-relaxed text-white/76">
          {secretLocked ? 'This insignia stays hidden until it is earned.' : badge.description}
        </p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-black/25">
          <div className="h-full rounded-full bg-white/80" style={{ width: `${badge.progressPercent}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm font-black text-white/70">
          <span>{badge.progressCurrent}/{badge.progressTarget}</span>
          <span>+{badge.rewardPoints ?? 0}pt</span>
        </div>
        {badge.unlocksTitleIds?.length ? (
          <div className="mt-4 rounded-lg border border-white/14 bg-black/18 p-3 text-sm font-bold text-white/75">
            Title unlock: {badge.unlocksTitleIds.map(id => TITLE_DEFINITIONS.find(t => t.titleId === id)?.title ?? id).join(', ')}
          </div>
        ) : null}
        {badge.unlocksVisualStyleIds?.length ? (
          <div className="mt-2 rounded-lg border border-white/14 bg-black/18 p-3 text-sm font-bold text-white/75">
            Visual unlock: {badge.unlocksVisualStyleIds.map(id => VISUAL_STYLE_DEFINITIONS.find(v => v.visualStyleId === id)?.name ?? id).join(', ')}
          </div>
        ) : null}
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950">
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
  const hydrate = useFamilyStore(s => s.hydrate);
  const hydrated = useFamilyStore(s => s.hydrated);
  const children = useMemo(() => users.filter(user => user.role === 'CHILD'), [users]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [state, setState] = useState<ReturnType<typeof loadAchievementState> | null>(null);
  const [achievementsByChild, setAchievementsByChild] = useState<Record<string, AchievementProgress[]>>({});
  const [category, setCategory] = useState<AchievementCategory | 'All'>('All');
  const [rarity, setRarity] = useState<AchievementRarity | 'all'>('all');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<AchievementProgress | null>(null);

  useEffect(() => {
    hydrate().catch(console.error);
  }, [hydrate]);

  useEffect(() => {
    if (!familyId || children.length === 0) return;
    syncAchievements({ familyId, children, tasksByUser, levelsByUser, awardNew: false })
      .then(result => {
        setState(result.state);
        setAchievementsByChild(result.achievementsByChild);
      })
      .catch(console.error);
  }, [familyId, children, tasksByUser, levelsByUser]);

  const selectedChild = children.find(child => child.id === selectedChildId) ?? children[0];
  const childState = selectedChild ? childStateFor(state, selectedChild.id) : undefined;
  const allBadges = selectedChild ? (achievementsByChild[selectedChild.id] ?? []) : [];
  const filtered = allBadges
    .filter(badge => category === 'All' || badge.category === category)
    .filter(badge => rarity === 'all' || badge.rarity === rarity)
    .filter(badge => !query.trim() || `${badge.title} ${badge.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort(sortBadges);
  const unlocked = allBadges.filter(badge => badge.isUnlocked);
  const almostThere = allBadges.filter(badge => !badge.isUnlocked && badge.progressPercent >= 70).sort((a, b) => b.progressPercent - a.progressPercent).slice(0, 6);
  const comebackCorner = allBadges.filter(badge => ['Comebacks', 'Improvement'].includes(badge.category)).sort(sortBadges).slice(0, 8);
  const recent = unlocked.slice().sort((a, b) => (b.unlockedAt ?? '').localeCompare(a.unlockedAt ?? '')).slice(0, 6);
  const pinned = childState?.pinnedAchievementIds ?? [];
  const topBadges = pinned.length > 0
    ? pinned.map(id => allBadges.find(badge => badge.achievementId === id)).filter((badge): badge is AchievementProgress => Boolean(badge))
    : unlocked.slice().sort((a, b) => rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity)).slice(0, 5);
  const equippedTitle = TITLE_DEFINITIONS.find(title => title.titleId === childState?.equippedTitleId);
  const activeDays = allBadges.find(badge => badge.achievementId === 'year-active-days-365')?.progressCurrent ?? 0;

  const applyTitle = (titleId: string) => {
    if (!familyId || !selectedChild) return;
    setState(setEquippedTitle(familyId, children, selectedChild.id, titleId));
  };

  const pinBadge = (achievementId: string) => {
    if (!familyId || !selectedChild) return;
    setState(togglePinnedAchievement(familyId, children, selectedChild.id, achievementId));
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
                <Medal size={14} /> Insignia Wall
              </div>
              <h1 className="mt-1 truncate text-2xl font-black">Year-long growth, comeback wins, and rare insignias</h1>
              <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-white/58">
                Built for resilience: showing up again, improving over time, helping each other, and collecting premium badge rewards without chasing perfect days.
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
              {children.map(child => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm font-black ${child.id === selectedChild?.id ? 'border-[#4EEDB0]/60 bg-[#4EEDB0]/14' : 'border-white/10 bg-white/[0.04]'}`}
                >
                  {child.name}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-black/18 p-3">
              <div className="text-xs font-black uppercase text-white/42">Equipped Title</div>
              <div className="mt-1 text-lg font-black text-[#FFD166]">{equippedTitle?.title ?? 'No title yet'}</div>
              <select
                value={childState?.equippedTitleId ?? ''}
                onChange={event => applyTitle(event.target.value)}
                className="mt-3 w-full rounded-lg border border-white/10 bg-[#0D0E1C] px-2 py-2 text-sm font-bold"
              >
                <option value="">Choose title</option>
                {TITLE_DEFINITIONS.filter(title => childState?.unlockedTitleIds.includes(title.titleId)).map(title => (
                  <option key={title.titleId} value={title.titleId}>{title.title}</option>
                ))}
              </select>
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="grid grid-cols-2 gap-2">
              <Metric icon={<Trophy size={16} />} label="Unlocked" value={`${unlocked.length}/${ACHIEVEMENTS.length}`} />
              <Metric icon={<Sparkles size={16} />} label="Complete" value={`${pct(unlocked.length, ACHIEVEMENTS.length)}%`} />
              <Metric icon={<Flame size={16} />} label="Comebacks" value={`${allBadges.filter(b => b.category === 'Comebacks' && b.isUnlocked).length}`} />
              <Metric icon={<Award size={16} />} label="Year Days" value={`${activeDays}/365`} />
            </div>
          </section>

          <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <h2 className="text-sm font-black">Top Insignias</h2>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {topBadges.map(badge => (
                <button key={badge.achievementId} type="button" onClick={() => setDetail(badge)} className="grid aspect-square place-items-center">
                  <InsigniaMark badge={badge} secretLocked={false} />
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="grid gap-3 xl:grid-cols-3">
            <Panel title="Recently Unlocked" items={recent} onOpen={setDetail} />
            <Panel title="Almost There" items={almostThere} onOpen={setDetail} />
            <Panel title="Comeback Corner" items={comebackCorner} onOpen={setDetail} />
          </div>

          <div className="rounded-lg border border-white/10 bg-[#111224] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/36" size={16} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search badges"
                  className="w-full rounded-lg border border-white/10 bg-black/18 py-2 pl-9 pr-3 text-sm font-bold outline-none focus:border-[#4EEDB0]/60"
                />
              </div>
              <select value={rarity} onChange={event => setRarity(event.target.value as AchievementRarity | 'all')} className="rounded-lg border border-white/10 bg-black/18 px-3 py-2 text-sm font-bold">
                <option value="all">All rarities</option>
                {rarityOrder.map(r => <option key={r} value={r}>{r}</option>)}
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
            {filtered.map(badge => (
              <BadgeCard
                key={badge.achievementId}
                badge={badge}
                pinned={pinned.includes(badge.achievementId)}
                onOpen={() => setDetail(badge)}
                onPin={() => pinBadge(badge.achievementId)}
              />
            ))}
          </div>
        </section>
      </main>

      {detail && <BadgeDetail badge={detail} onClose={() => setDetail(null)} />}
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

function Panel({ title, items, onOpen }: { title: string; items: AchievementProgress[]; onOpen: (badge: AchievementProgress) => void }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#111224] p-3">
      <h2 className="text-sm font-black">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.length === 0 && <div className="rounded-lg bg-white/[0.04] p-3 text-xs font-bold text-white/42">Keep going. Progress will appear here.</div>}
        {items.slice(0, 4).map(item => (
          <button key={item.achievementId} type="button" onClick={() => onOpen(item)} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.04] p-2 text-left hover:bg-white/[0.08]">
            <InsigniaMark badge={item} secretLocked={Boolean(item.isSecret && !item.isUnlocked)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black">{item.isSecret && !item.isUnlocked ? 'Secret Insignia' : item.title}</span>
            <span className="block text-[10px] font-bold text-white/45">{item.progressPercent}% · {metalLabel[item.rarity]}</span>
          </span>
        </button>
      ))}
      </div>
    </section>
  );
}

function InsigniaMark({
  badge,
  secretLocked,
  size = 'sm',
}: {
  badge: AchievementProgress;
  secretLocked: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-4xl' : size === 'md' ? 'h-14 w-14 text-2xl' : 'h-8 w-8 text-base';
  const shapeClass = badge.category === 'Year Journey' || badge.rarity === 'legendary'
    ? 'rounded-[18px]'
    : badge.category === 'Comebacks'
      ? 'rounded-full'
      : 'rounded-[30%]';
  return (
    <span className={`relative grid shrink-0 place-items-center overflow-hidden border bg-gradient-to-br shadow-inner ${sizeClass} ${shapeClass} ${rarityClass[badge.rarity]}`}>
      <span className="absolute inset-x-2 top-1 h-1/3 rounded-full bg-white/28 blur-[1px]" />
      <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.32),transparent_36%,rgba(0,0,0,0.18)_78%)]" />
      <span className="relative z-10 font-black drop-shadow-sm">{secretLocked ? '?' : badge.icon}</span>
    </span>
  );
}
