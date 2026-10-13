'use client';

import { BookHeart } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

/** A direct route to this member's real history, available from the first day. */
export function EquippedInsigniaStrip({ userId }: { userId: string }) {
  const { lang } = useLanguage();
  const label = lang === 'en' ? 'Open growth album' : '성장 앨범 열기';
  return <Link href={`/stats?view=growth&member=${encodeURIComponent(userId)}`} title={label} aria-label={label} className="inline-flex h-8 shrink-0 max-[380px]:h-7 items-center justify-center gap-1 rounded-lg border border-[var(--border)] px-2 text-[var(--secondary)] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2">
    <BookHeart size={17} aria-hidden /><span className="text-[10px] font-semibold">{lang === 'en' ? 'Album' : '앨범'}</span>
  </Link>;
}
