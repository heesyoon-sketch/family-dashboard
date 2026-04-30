'use client';

import { RotateCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function RefreshDataButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/15 disabled:cursor-wait disabled:opacity-60"
    >
      <RotateCw size={16} className={pending ? 'animate-spin' : undefined} />
      {pending ? 'Refreshing' : 'Refresh Data'}
    </button>
  );
}
