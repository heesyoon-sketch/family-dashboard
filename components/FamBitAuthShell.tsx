import type { ReactNode } from 'react';
import Link from 'next/link';
import { FamBitWordmark } from '@/components/FamBitLogo';

interface FamBitAuthShellProps {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
}

export function FamBitAuthShell({
  title,
  description,
  eyebrow,
  children,
  footer,
  maxWidthClassName = 'max-w-md',
}: FamBitAuthShellProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0D0E1C] px-4 py-8 text-white sm:px-6">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-44 border-b border-white/8 bg-[#111224]" />
      <div className={`relative z-10 w-full ${maxWidthClassName}`}>
        <Link href="/home" aria-label="FamBit home" className="mx-auto mb-5 flex w-fit">
          <FamBitWordmark compact />
        </Link>
        <section className="rounded-lg border border-white/8 bg-[#14162A]/95 p-6 shadow-2xl shadow-black/35 sm:p-7">
          <div className="mb-5 flex justify-center">
            <FamBitWordmark markSize={52} showText={false} />
          </div>
          {eyebrow && (
            <p className="mb-2 text-center text-xs font-black uppercase text-[#4EEDB0]">
              {eyebrow}
            </p>
          )}
          <h1 className="text-center text-2xl font-black leading-tight text-white">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm leading-6 text-white/62">
            {description}
          </p>
          <div className="mt-7">
            {children}
          </div>
        </section>
        {footer && (
          <div className="mt-4">
            {footer}
          </div>
        )}
      </div>
    </main>
  );
}
