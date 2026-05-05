'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { X, Check, Lock, Sparkles } from 'lucide-react';
import { User } from '@/lib/db';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  AvatarConfig,
  AvatarExtra,
  AvatarKind,
  BG_OPTIONS,
  EXTRA_CATALOG,
  KIND_CATALOG,
  TINT_OPTIONS,
  loadAvatarConfig,
  saveAvatarConfig,
  spendPointsOnCosmetic,
} from '@/lib/avatarConfig';
import { Avatar } from './Avatars';

type Tab = 'character' | 'color' | 'background' | 'extras';

const TABS: { id: Tab; ko: string; en: string; emoji: string }[] = [
  { id: 'character',  ko: '몬스터', en: 'Monster',    emoji: '🐉' },
  { id: 'color',      ko: '색상',  en: 'Color',      emoji: '🎨' },
  { id: 'background', ko: '배경',  en: 'Background', emoji: '🌈' },
  { id: 'extras',     ko: '꾸미기', en: 'Extras',     emoji: '✨' },
];

export function AvatarStudioModal({
  user,
  familyId,
  balance,
  onClose,
}: {
  user: User;
  familyId: string;
  balance: number;
  onClose: () => void;
}) {
  const { lang } = useLanguage();
  const updateBalance = useFamilyStore(s => s.applyBalance);
  const [config, setConfig] = useState<AvatarConfig>(() => loadAvatarConfig(user.id));
  const [tab, setTab] = useState<Tab>('character');
  const [busy, setBusy] = useState(false);
  const [balanceOverride, setBalanceOverride] = useState<number | null>(null);
  const localBalance = balanceOverride ?? balance;

  // Persist config whenever it changes — applies the look immediately on the dashboard.
  useEffect(() => {
    saveAvatarConfig(user.id, config);
  }, [config, user.id]);

  const t = useMemo(() => ({
    title:        lang === 'en' ? `${user.name}'s Studio` : `${user.name}의 아바타 스튜디오`,
    save:         lang === 'en' ? 'Done' : '완료',
    pickKind:     lang === 'en' ? 'Pick a monster — free' : '몬스터 선택 — 무료',
    pickColor:    lang === 'en' ? 'Monster color aura — free' : '몬스터 색상 오라 — 무료',
    pickBg:       lang === 'en' ? 'Background — free' : '배경 — 무료',
    extras:       lang === 'en' ? 'Cosmetics' : '꾸미기 아이템',
    owned:        lang === 'en' ? 'Owned' : '보유',
    equipped:     lang === 'en' ? 'Equipped' : '장착중',
    available:    lang === 'en' ? 'Available' : '구매 가능',
    equip:        lang === 'en' ? 'Equip' : '장착',
    unequip:      lang === 'en' ? 'Unequip' : '벗기',
    buy:          lang === 'en' ? 'Buy' : '구매',
    insufficient: lang === 'en' ? 'Not enough points' : '포인트가 부족해요',
    bought:       (n: string) => lang === 'en' ? `Got it: ${n}!` : `${n} 구매 완료!`,
    failed:       lang === 'en' ? 'Purchase failed' : '구매 실패',
    balance:      lang === 'en' ? 'Your points' : '내 포인트',
    cheapHint:    lang === 'en' ? 'Cosmetics are cheap — try one!' : '꾸미기는 저렴해요. 하나 사볼까요?',
  }), [lang, user.name]);

  const setKind     = (kind: AvatarKind) => setConfig(c => ({ ...c, kind }));
  const setTint     = (tint: string)     => setConfig(c => ({ ...c, tint }));
  const setBg       = (bg: string)       => setConfig(c => ({ ...c, bg }));

  const toggleExtra = (id: AvatarExtra) => {
    setConfig(c => {
      if (!c.owned.includes(id)) return c; // can't equip what you don't own
      const equipped = c.extras.includes(id);
      return { ...c, extras: equipped ? c.extras.filter(x => x !== id) : [...c.extras, id] };
    });
  };

  const buyExtra = async (id: AvatarExtra, cost: number) => {
    if (busy) return;
    if (localBalance < cost) {
      toast.error(t.insufficient);
      return;
    }
    setBusy(true);
    try {
      const label = EXTRA_CATALOG.find(e => e.id === id)?.[lang] ?? id;
      const next = await spendPointsOnCosmetic(user.id, familyId, cost, label);
      setBalanceOverride(next);
      updateBalance(user.id, next);
      // mark owned + auto-equip
      setConfig(c => ({
        ...c,
        owned: Array.from(new Set([...c.owned, id])),
        extras: Array.from(new Set([...c.extras, id])),
      }));
      toast.success(t.bought(label));
    } catch (err) {
      console.error('[avatar:buy]', err);
      toast.error(err instanceof Error ? err.message : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="avatar-modal"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="relative w-full max-w-[460px] overflow-hidden rounded-3xl bg-[var(--bg)] text-[var(--fg)] shadow-2xl ring-1 ring-white/10"
          onClick={e => e.stopPropagation()}
          data-theme={user.theme}
        >
          {/* header */}
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">{t.title}</h2>
              <p className="text-[11px] font-medium text-[var(--fg-muted)]">
                {t.balance}: <span className="font-bold text-[var(--accent)]">{localBalance}pt</span>
              </p>
            </div>
            <button
              type="button"
              aria-label="close"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-[var(--bg-card)] hover:brightness-110"
            >
              <X size={16} />
            </button>
          </div>

          {/* preview */}
          <div className="px-4">
            <div className="relative mx-auto aspect-square w-[210px] overflow-hidden rounded-3xl">
              <Avatar config={config} size={210} />
            </div>
          </div>

          {/* tabs */}
          <div className="mt-3 flex items-center gap-1 px-3">
            {TABS.map(tabDef => {
              const active = tab === tabDef.id;
              return (
                <button
                  key={tabDef.id}
                  type="button"
                  onClick={() => setTab(tabDef.id)}
                  className={`flex-1 rounded-xl px-1 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? 'bg-[var(--accent)] text-gray-950 shadow'
                      : 'bg-[var(--bg-card)] text-[var(--fg-muted)] hover:brightness-110'
                  }`}
                >
                  <span className="mr-1">{tabDef.emoji}</span>
                  {lang === 'en' ? tabDef.en : tabDef.ko}
                </button>
              );
            })}
          </div>

          {/* tab body */}
          <div className="max-h-[44vh] overflow-y-auto px-4 pb-4 pt-3">
            {tab === 'character' && (
              <Section label={t.pickKind}>
                <div className="grid grid-cols-2 gap-2">
                  {KIND_CATALOG.map(k => {
                    const active = config.kind === k.id;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => setKind(k.id)}
                        className={`flex items-center gap-2 rounded-2xl border-2 p-2 text-left transition ${
                          active
                            ? 'border-[var(--accent)] bg-[var(--accent-glow)]'
                            : 'border-transparent bg-[var(--bg-card)] hover:brightness-110'
                        }`}
                      >
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                          <Avatar
                            config={{ ...config, kind: k.id }}
                            size={40}
                            showBg={false}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-bold">
                            {k.emoji} {lang === 'en' ? k.en : k.ko}
                          </div>
                          <div className="text-[10px] text-[var(--fg-muted)]">
                            {lang === 'en' ? 'Free' : '무료'}
                          </div>
                        </div>
                        {active && <Check size={14} className="ml-auto text-[var(--accent)]" />}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {tab === 'color' && (
              <Section label={t.pickColor}>
                <div className="grid grid-cols-4 gap-2">
                  {TINT_OPTIONS.map(t => {
                    const active = config.tint === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTint(t.id)}
                        className={`relative h-14 rounded-2xl border-2 transition ${
                          active ? 'border-[var(--accent)]' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ background: t.color }}
                        aria-label={t.id}
                      >
                        {active && (
                          <div className="absolute inset-0 grid place-items-center">
                            <Check size={18} className="text-white drop-shadow" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {tab === 'background' && (
              <Section label={t.pickBg}>
                <div className="grid grid-cols-3 gap-2">
                  {BG_OPTIONS.map(b => {
                    const active = config.bg === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setBg(b.id)}
                        className={`relative h-16 rounded-2xl border-2 transition ${
                          active ? 'border-[var(--accent)]' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ background: `linear-gradient(180deg, ${b.from}, ${b.to})` }}
                        aria-label={b.id}
                      >
                        <span className="absolute inset-x-0 bottom-1 text-[10px] font-bold text-white drop-shadow">
                          {lang === 'en' ? b.en : b.ko}
                        </span>
                        {active && (
                          <Check size={14} className="absolute right-1 top-1 text-white drop-shadow" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </Section>
            )}

            {tab === 'extras' && (
              <Section label={t.extras}>
                <p className="mb-2 flex items-center gap-1 text-[11px] text-[var(--fg-muted)]">
                  <Sparkles size={12} /> {t.cheapHint}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EXTRA_CATALOG.map(e => {
                    const owned    = config.owned.includes(e.id);
                    const equipped = config.extras.includes(e.id);
                    const canAfford = localBalance >= e.cost;
                    const previewConfig: AvatarConfig = {
                      ...config,
                      extras: Array.from(new Set([...config.extras, e.id])),
                    };
                    return (
                      <div
                        key={e.id}
                        className={`flex flex-col gap-1 rounded-2xl border-2 p-2 transition ${
                          equipped ? 'border-[var(--accent)] bg-[var(--accent-glow)]' : 'border-transparent bg-[var(--bg-card)]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--bg)] ring-1 ring-[var(--border)] ${owned || canAfford ? '' : 'opacity-55 grayscale'}`}>
                            <Avatar config={previewConfig} size={48} showBg={false} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-base">{e.emoji}</span>
                              <span className="truncate text-[12px] font-bold">
                                {lang === 'en' ? e.en : e.ko}
                              </span>
                            </div>
                            <div className="text-[10px] font-semibold text-[var(--fg-muted)]">
                              {owned ? t.owned : `${e.cost}pt`}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-[var(--fg-muted)]">
                          {equipped ? (
                            <span className="min-w-0 truncate text-[var(--accent)]">{t.equipped}</span>
                          ) : owned ? (
                            <span className="min-w-0 truncate text-emerald-400">{t.owned}</span>
                          ) : canAfford ? (
                            <span className="min-w-0 truncate">{t.available}</span>
                          ) : (
                            <span className="min-w-0 truncate text-rose-300">{t.insufficient}</span>
                          )}
                          {owned ? (
                            <button
                              type="button"
                              onClick={() => toggleExtra(e.id)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                equipped
                                  ? 'bg-[var(--bg)] text-[var(--fg)]'
                                  : 'bg-[var(--accent)] text-gray-950'
                              }`}
                            >
                              {equipped ? t.unequip : t.equip}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={busy || !canAfford}
                              onClick={() => buyExtra(e.id, e.cost)}
                              className="flex items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-gray-950 transition disabled:opacity-40"
                            >
                              {!canAfford && <Lock size={10} />}
                              {t.buy}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}
          </div>

          {/* footer */}
          <div className="border-t border-[var(--border)] bg-[var(--bg-card)]/50 p-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-bold text-gray-950 transition hover:brightness-95"
            >
              {t.save}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-[var(--fg-muted)]">{label}</h3>
      {children}
    </section>
  );
}
