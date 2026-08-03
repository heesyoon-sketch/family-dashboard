import type { AutomaticSaleConfig, AutomaticSaleStatus, Reward } from './db';

const MAX_PERCENTAGE = 100;

function clampPercentage(value: unknown): number {
  const parsed = Math.round(Number(value ?? 0));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_PERCENTAGE, Math.max(0, parsed));
}

function browserTimezone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function defaultAutomaticSaleConfig(): AutomaticSaleConfig {
  const timezone = browserTimezone();
  const korean = timezone === 'Asia/Seoul';
  return {
    weekendEnabled: false,
    holidayEnabled: false,
    percentage: 20,
    countryCode: korean ? 'KR' : 'CA',
    subdivisionCode: korean ? '' : 'ON',
    timezone,
    holidayDates: [],
    generatedThrough: 0,
  };
}

export function normalizeAutomaticSaleConfig(value: unknown): AutomaticSaleConfig {
  const defaults = defaultAutomaticSaleConfig();
  if (!value || typeof value !== 'object') return defaults;
  const raw = value as Record<string, unknown>;
  const holidayDates = Array.isArray(raw.holidayDates)
    ? raw.holidayDates.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
    : [];
  return {
    weekendEnabled: Boolean(raw.weekendEnabled),
    holidayEnabled: Boolean(raw.holidayEnabled),
    percentage: clampPercentage(raw.percentage),
    countryCode: typeof raw.countryCode === 'string' && raw.countryCode ? raw.countryCode : defaults.countryCode,
    subdivisionCode: typeof raw.subdivisionCode === 'string' ? raw.subdivisionCode : defaults.subdivisionCode,
    timezone: typeof raw.timezone === 'string' && raw.timezone ? raw.timezone : defaults.timezone,
    holidayDates: [...new Set(holidayDates)].sort(),
    generatedThrough: Math.max(0, Math.round(Number(raw.generatedThrough ?? 0)) || 0),
  };
}

export function parseAutomaticSaleSetting(value: string | null | undefined): AutomaticSaleConfig {
  if (!value) return defaultAutomaticSaleConfig();
  try {
    return normalizeAutomaticSaleConfig(JSON.parse(value));
  } catch {
    return defaultAutomaticSaleConfig();
  }
}

function dateParts(date: Date, timezone: string): { dateKey: string; weekday: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
    return {
      dateKey: `${get('year')}-${get('month')}-${get('day')}`,
      weekday: get('weekday'),
    };
  } catch {
    return dateParts(date, 'UTC');
  }
}

export function automaticSaleStatus(
  config: AutomaticSaleConfig,
  date = new Date(),
): AutomaticSaleStatus {
  const { dateKey, weekday } = dateParts(date, config.timezone);
  const weekend = config.weekendEnabled && (weekday === 'Sat' || weekday === 'Sun');
  const holiday = config.holidayEnabled && config.holidayDates.includes(dateKey);
  const reason = weekend && holiday
    ? 'weekend_holiday'
    : weekend
      ? 'weekend'
      : holiday
        ? 'holiday'
        : null;
  return {
    active: reason !== null && config.percentage > 0,
    percentage: reason === null ? 0 : config.percentage,
    reason,
    localDate: dateKey,
  };
}

export function automaticSaleLabel(status: AutomaticSaleStatus, lang: 'en' | 'ko'): string {
  if (status.reason === 'holiday') return lang === 'en' ? 'Holiday Sale' : '공휴일 세일';
  if (status.reason === 'weekend_holiday') return lang === 'en' ? 'Holiday Weekend Sale' : '공휴일 주말 세일';
  return lang === 'en' ? 'Weekend Sale' : '주말 세일';
}

export function withAutomaticSale(
  reward: Reward,
  status: AutomaticSaleStatus,
  lang: 'en' | 'ko' = 'en',
): Reward {
  if (!status.active) {
    return {
      ...reward,
      automatic_sale_active: false,
      automatic_sale_percentage: 0,
      automatic_sale_name: undefined,
      automatic_sale_reason: null,
    };
  }
  return {
    ...reward,
    automatic_sale_active: true,
    automatic_sale_percentage: status.percentage,
    automatic_sale_name: automaticSaleLabel(status, lang),
    automatic_sale_reason: status.reason,
  };
}

export function rewardEffectiveCost(reward: Reward): number {
  const base = Math.max(0, Math.round(reward.cost_points));
  const manualPercentage = reward.sale_enabled ? clampPercentage(reward.sale_percentage) : 0;
  const manualCost = reward.sale_enabled && reward.sale_price != null
    ? Math.max(0, Math.min(base, Math.round(reward.sale_price)))
    : Math.max(0, Math.floor(base * (100 - manualPercentage) / 100));
  const automaticPercentage = reward.automatic_sale_active
    ? clampPercentage(reward.automatic_sale_percentage)
    : 0;
  const automaticCost = Math.max(0, Math.floor(base * (100 - automaticPercentage) / 100));
  return Math.min(manualCost, automaticCost);
}

export function rewardEffectiveSaleLabel(reward: Reward, lang: 'en' | 'ko' = 'en'): string {
  const base = Math.max(0, Math.round(reward.cost_points));
  const automaticCost = reward.automatic_sale_active
    ? Math.max(0, Math.floor(base * (100 - clampPercentage(reward.automatic_sale_percentage)) / 100))
    : base;
  const manualCost = reward.sale_enabled && reward.sale_price != null
    ? Math.max(0, Math.min(base, Math.round(reward.sale_price)))
    : Math.max(0, Math.floor(base * (100 - (reward.sale_enabled ? clampPercentage(reward.sale_percentage) : 0)) / 100));
  if (reward.automatic_sale_active && automaticCost < manualCost) {
    if (reward.automatic_sale_reason) {
      return automaticSaleLabel({
        active: true,
        percentage: clampPercentage(reward.automatic_sale_percentage),
        reason: reward.automatic_sale_reason,
        localDate: '',
      }, lang);
    }
    return reward.automatic_sale_name ?? `${clampPercentage(reward.automatic_sale_percentage)}% OFF`;
  }
  const custom = reward.sale_name?.trim();
  if (custom) return custom;
  if (reward.sale_enabled && reward.sale_price != null) return 'SALE';
  return `${reward.sale_enabled ? clampPercentage(reward.sale_percentage) : 0}% OFF`;
}

export function rewardHasEffectiveSale(reward: Reward): boolean {
  return rewardEffectiveCost(reward) < Math.max(0, Math.round(reward.cost_points));
}
