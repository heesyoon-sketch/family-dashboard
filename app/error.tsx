'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[route error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0D0E1C] p-8 text-center text-white">
      <div className="max-w-md space-y-6">
        <div className="text-6xl">😵</div>
        <h1 className="text-2xl font-black">잠깐, 뭔가 멈췄어요</h1>
        <p className="text-sm text-white/60">
          페이지를 그리는 도중에 문제가 생겼어요. 다시 시도하면 대부분 풀려요.
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-white/30">ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="rounded-full bg-[#4EEDB0] px-6 py-3 text-sm font-black text-[#0D0E1C] transition hover:bg-[#4EEDB0]/90"
        >
          다시 시도
        </button>
      </div>
    </div>
  );
}
