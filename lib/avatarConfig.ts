/**
 * Fambit avatar config + cosmetic catalog.
 *
 * Storage strategy:
 *   - Per-user config is persisted in localStorage. Kids share a kiosk
 *     laptop (see CLAUDE.md memory), so device-local is acceptable for v1.
 *   - Point deductions go through `spendPointsOnCosmetic`, backed by the
 *     purchase_avatar_cosmetic RPC so balance checks and debits are atomic.
 */

import { createBrowserSupabase } from './supabase';

export type AvatarKind = 'dino' | 'spaceman' | 'kitty' | 'puppy';

export type AvatarExtra =
  | 'sparkles'
  | 'star_pin'
  | 'bow_tie'
  | 'flowers'
  | 'wings'
  | 'halo'
  | 'cape'
  | 'crown';

export interface KindOption {
  id: AvatarKind;
  ko: string;
  en: string;
  emoji: string;
  /** Suggested gender hint. UI can use this to surface a default per child. */
  hint: 'boy' | 'girl' | 'any';
}

export const KIND_CATALOG: KindOption[] = [
  { id: 'dino',     ko: '공룡 몬스터',   en: 'Dino Monster',  emoji: '🦖', hint: 'boy' },
  { id: 'spaceman', ko: '별 드래곤',     en: 'Star Dragon',   emoji: '🐉', hint: 'boy' },
  { id: 'kitty',    ko: '마법 고양이',   en: 'Mystic Cat',    emoji: '🐱', hint: 'girl' },
  { id: 'puppy',    ko: '번개 강아지',   en: 'Bolt Puppy',    emoji: '🐶', hint: 'girl' },
];

export interface TintOption {
  id: string;
  color: string;     // outfit / hood color
  shade: string;     // darker shade for outline / depth
}

export const TINT_OPTIONS: TintOption[] = [
  { id: 'mint',     color: '#A8E6A1', shade: '#6CC774' },
  { id: 'sky',      color: '#7DCBEA', shade: '#4FAED1' },
  { id: 'pink',     color: '#FFC8DD', shade: '#F49EBE' },
  { id: 'lavender', color: '#C8B6FF', shade: '#9C84F0' },
  { id: 'sun',      color: '#FFE066', shade: '#F5B82B' },
  { id: 'coral',    color: '#FFB199', shade: '#F38971' },
  { id: 'mauve',    color: '#E5A0E0', shade: '#C277BC' },
  { id: 'sage',     color: '#B8E0B0', shade: '#7CC178' },
];

export interface BgOption {
  id: string;
  ko: string;
  en: string;
  from: string;
  to: string;
}

export const BG_OPTIONS: BgOption[] = [
  { id: 'sunset',     ko: '노을',  en: 'Sunset',  from: '#FFD580', to: '#FFADAD' },
  { id: 'sea',        ko: '바다',  en: 'Sea',     from: '#A8D8EA', to: '#AA96DA' },
  { id: 'forest',     ko: '숲',    en: 'Forest',  from: '#D6F5C8', to: '#7CC178' },
  { id: 'galaxy',     ko: '은하',  en: 'Galaxy',  from: '#3A2B66', to: '#FFD3A5' },
  { id: 'candy',      ko: '캔디',  en: 'Candy',   from: '#FFC8DD', to: '#C8B6FF' },
  { id: 'mint_cream', ko: '민트',  en: 'Mint',    from: '#E0F8E2', to: '#FFFAEC' },
];

export interface ExtraOption {
  id: AvatarExtra;
  ko: string;
  en: string;
  cost: number;     // spendable points; kept intentionally cheap
  emoji: string;
}

export const EXTRA_CATALOG: ExtraOption[] = [
  { id: 'sparkles', ko: '반짝임',      en: 'Sparkles',     cost: 3,  emoji: '✨' },
  { id: 'star_pin', ko: '별 핀',       en: 'Star Pin',     cost: 5,  emoji: '⭐' },
  { id: 'bow_tie',  ko: '나비 넥타이', en: 'Bow Tie',      cost: 8,  emoji: '🎀' },
  { id: 'flowers',  ko: '꽃관',        en: 'Flower Crown', cost: 10, emoji: '🌸' },
  { id: 'wings',    ko: '천사 날개',   en: 'Angel Wings',  cost: 15, emoji: '🪽' },
  { id: 'halo',     ko: '후광',        en: 'Halo',         cost: 15, emoji: '😇' },
  { id: 'cape',     ko: '망토',        en: 'Cape',         cost: 18, emoji: '🦸' },
  { id: 'crown',    ko: '왕관',        en: 'Crown',        cost: 25, emoji: '👑' },
];

export interface AvatarConfig {
  kind: AvatarKind;
  tint: string;            // tint id, e.g. 'mint'
  bg: string;              // bg id
  extras: AvatarExtra[];   // currently equipped
  owned: AvatarExtra[];    // owned (always a superset of `extras`)
}

export const DEFAULT_CONFIG: AvatarConfig = {
  kind: 'dino',
  tint: 'mint',
  bg: 'sunset',
  extras: [],
  owned: [],
};

const STORAGE_KEY = (userId: string) => `fambit_avatar_v1:${userId}`;

// Per-userId cache so useSyncExternalStore receives stable references between
// re-renders (it bails on referential inequality and would otherwise infinite-loop).
const _configCache = new Map<string, AvatarConfig>();

export function loadAvatarConfig(userId: string): AvatarConfig {
  const cached = _configCache.get(userId);
  if (cached) return cached;
  const fresh = readFromStorage(userId);
  _configCache.set(userId, fresh);
  return fresh;
}

function readFromStorage(userId: string): AvatarConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AvatarConfig>;
    const extras = Array.isArray(parsed.extras) ? parsed.extras as AvatarExtra[] : [];
    const owned = Array.isArray(parsed.owned) ? parsed.owned as AvatarExtra[] : [];
    return {
      kind:    (parsed.kind ?? DEFAULT_CONFIG.kind) as AvatarKind,
      tint:    parsed.tint ?? DEFAULT_CONFIG.tint,
      bg:      parsed.bg ?? DEFAULT_CONFIG.bg,
      extras,
      owned:   Array.from(new Set([...owned, ...extras])),
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveAvatarConfig(userId: string, cfg: AvatarConfig) {
  _configCache.set(userId, cfg);
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(cfg));
  // Notify same-tab listeners (storage event only fires across tabs).
  try {
    window.dispatchEvent(new CustomEvent('fambit:avatar-changed', { detail: { userId } }));
  } catch {
    /* no-op */
  }
}

/** Subscribes to avatar-config changes for a single user. */
export function subscribeAvatarConfig(userId: string, callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ userId: string }>).detail;
    if (detail?.userId === userId) {
      _configCache.delete(userId); // force fresh read on next loadAvatarConfig
      callback();
    }
  };
  window.addEventListener('fambit:avatar-changed', handler);
  return () => window.removeEventListener('fambit:avatar-changed', handler);
}

export function tintById(id: string): TintOption {
  return TINT_OPTIONS.find(t => t.id === id) ?? TINT_OPTIONS[0];
}

export function bgById(id: string): BgOption {
  return BG_OPTIONS.find(b => b.id === id) ?? BG_OPTIONS[0];
}


/**
 * Deducts `cost` from this user's spendable_balance and logs a SYSTEM_MESSAGE
 * activity describing the cosmetic purchase. Throws if the balance is
 * insufficient.
 *
 * Returns the new balance.
 */
export async function spendPointsOnCosmetic(
  userId: string,
  familyId: string,
  cost: number,
  cosmeticLabel: string,
): Promise<number> {
  if (cost <= 0) return -1;
  const supabase = createBrowserSupabase();
  const safeCost = Math.max(1, Math.round(cost));

  const { data, error } = await supabase.rpc('purchase_avatar_cosmetic', {
    p_user_id: userId,
    p_cost: safeCost,
    p_cosmetic_label: cosmeticLabel,
  });
  if (error) throw new Error(error.message);

  const result = data as { spendableBalance?: number; spendable_balance?: number } | null;
  const nextBalance = Number(result?.spendableBalance ?? result?.spendable_balance);
  if (!Number.isFinite(nextBalance)) throw new Error('잔액을 확인할 수 없어요');

  void familyId;
  return nextBalance;
}
