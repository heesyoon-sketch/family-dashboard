'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { BarChart2, CalendarDays, ChevronLeft, ChevronRight, LogOut, MoreHorizontal, Palmtree, Settings, Volume2, VolumeX } from 'lucide-react';
import { FamBitWordmark } from './FamBitLogo';
import { FamilyQuestChip } from './FamilyQuestCard';
import { HarmonyChip } from './HarmonyChip';
import { ConnectionStatusChip } from './ConnectionStatusChip';
import { AuthProfileAvatar } from './AuthProfileAvatar';
import { CalendarPeekChip } from './CalendarPeekChip';
import { useLanguage } from '@/contexts/LanguageContext';

const iconButton = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10 active:scale-95';
const menuItem = 'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-white/85 transition hover:bg-white/8';

interface DashboardHeaderProps {
  familyName: string | null;
  dateLabel: string;
  authProfile: { email: string | null; avatarUrl: string | null };
  soundEnabled: boolean;
  toggleSound: () => void;
  canAdmin: boolean;
  penaltyPauseEnabled: boolean;
  penaltyPauseToggling: boolean;
  onTogglePenaltyPause: () => void;
  onLogout: () => void;
  activePage: number;
  pageCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function DashboardHeader(props: DashboardHeaderProps) {
  const { lang, t } = useLanguage();
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const menu = menuRef.current;
      if (event.key === 'Escape' && menu?.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <header className="dashboard-header sticky top-0 z-20 flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[#0D0E1C]/95 px-3 backdrop-blur-md md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <FamBitWordmark markSize={28} showText={false} />
        <div className="flex min-w-0 flex-col justify-center gap-x-3 sm:flex-row sm:items-baseline">
          <h1 className="truncate text-sm font-bold tracking-tight text-white md:text-base">{props.familyName || 'FamBit'}</h1>
          <p className="truncate text-[10px] leading-tight text-white/45 sm:shrink-0 sm:text-xs">{props.dateLabel}</p>
        </div>
      </div>

      <CalendarPeekChip />

      <div className="hidden shrink-0 items-center gap-2 xl:flex">
        <FamilyQuestChip />
        <HarmonyChip />
        <ConnectionStatusChip />
      </div>

      <nav className="flex shrink-0 items-center gap-1.5" aria-label={lang === 'en' ? 'Dashboard tools' : '대시보드 도구'}>
        {props.pageCount > 1 && (
          <div className="mr-1 hidden items-center gap-1 md:flex">
            <button type="button" onClick={props.onPreviousPage} disabled={props.activePage === 0} aria-label={lang === 'en' ? 'Previous members' : '이전 가족'} className={`${iconButton} disabled:opacity-25`}><ChevronLeft size={18} /></button>
            <span className="px-1 text-xs tabular-nums text-white/60">{props.activePage + 1}/{props.pageCount}</span>
            <button type="button" onClick={props.onNextPage} disabled={props.activePage === props.pageCount - 1} aria-label={lang === 'en' ? 'Next members' : '다음 가족'} className={`${iconButton} disabled:opacity-25`}><ChevronRight size={18} /></button>
          </div>
        )}
        <Link href="/calendar" aria-label={lang === 'en' ? 'Family calendar' : '가족 달력'} title={lang === 'en' ? 'Family calendar' : '가족 달력'} className={iconButton}><CalendarDays size={19} /></Link>
        <Link href="/stats" aria-label={t('weekly_completions')} title={t('weekly_completions')} className={`${iconButton} hidden md:grid`}><BarChart2 size={19} /></Link>
        <details ref={menuRef} className="relative">
          <summary className={`${iconButton} cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label={lang === 'en' ? 'More options' : '더 보기'} title={lang === 'en' ? 'More options' : '더 보기'}><MoreHorizontal size={21} /></summary>
          <div className="absolute right-0 top-[calc(100%+10px)] w-64 max-w-[calc(100vw-24px)] rounded-2xl border border-white/15 bg-[#181a2b] p-2 shadow-[0_20px_60px_#0008]">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
              <AuthProfileAvatar email={props.authProfile.email} avatarUrl={props.authProfile.avatarUrl} size={28} />
              <span className="min-w-0 truncate text-xs text-white/60">{props.authProfile.email || props.familyName || 'FamBit'}</span>
            </div>
            <Link href="/stats" className={`${menuItem} md:hidden`}><BarChart2 size={18} />{t('weekly_completions')}</Link>
            <button type="button" onClick={props.toggleSound} aria-pressed={props.soundEnabled} className={menuItem}>{props.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}{props.soundEnabled ? t('sound_mute') : t('sound_unmute')}</button>
            <Link href="/admin" className={menuItem}><Settings size={18} />{t('admin_mode')}</Link>
            {props.canAdmin && <button type="button" onClick={props.onTogglePenaltyPause} disabled={props.penaltyPauseToggling} aria-pressed={props.penaltyPauseEnabled} className={`${menuItem} disabled:opacity-50`}><Palmtree size={18} />{props.penaltyPauseEnabled ? t('vacation_mode_off') : t('vacation_mode_on')}</button>}
            <div className="my-1 border-t border-white/10" />
            <button type="button" onClick={props.onLogout} className={`${menuItem} text-[#FFB8CF]`}><LogOut size={18} />{t('logout')}</button>
          </div>
        </details>
      </nav>
    </header>
  );
}
