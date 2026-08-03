import Holidays from 'date-holidays';

export interface HolidayRegionOption {
  code: string;
  name: string;
}

export interface PublicHolidayDate {
  date: string;
  name: string;
}

function optionsFromMap(values: Record<string, string>): HolidayRegionOption[] {
  return Object.entries(values)
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function holidayCountries(lang: 'en' | 'ko'): HolidayRegionOption[] {
  const holidays = new Holidays();
  return optionsFromMap(holidays.getCountries(lang));
}

export function holidaySubdivisions(countryCode: string, lang: 'en' | 'ko'): HolidayRegionOption[] {
  const holidays = new Holidays();
  return optionsFromMap(holidays.getStates(countryCode, lang));
}

function calendar(countryCode: string, subdivisionCode: string): Holidays {
  return subdivisionCode
    ? new Holidays(countryCode, subdivisionCode, { types: ['public'] })
    : new Holidays(countryCode, { types: ['public'] });
}

export function holidayTimezone(
  countryCode: string,
  subdivisionCode: string,
  preferredTimezone: string,
): string {
  const timezones = calendar(countryCode, subdivisionCode).getTimezones();
  if (timezones.includes(preferredTimezone)) return preferredTimezone;
  return timezones[0] ?? preferredTimezone ?? 'UTC';
}

export function publicHolidayDates(
  countryCode: string,
  subdivisionCode: string,
  startYear: number,
  endYear: number,
  lang: 'en' | 'ko',
): PublicHolidayDate[] {
  const holidays = calendar(countryCode, subdivisionCode);
  const byDate = new Map<string, string>();
  for (let year = startYear; year <= endYear; year++) {
    for (const holiday of holidays.getHolidays(year, lang)) {
      if (holiday.type !== 'public') continue;
      const date = holiday.date.slice(0, 10);
      if (!byDate.has(date)) byDate.set(date, holiday.name);
    }
  }
  return [...byDate.entries()]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
