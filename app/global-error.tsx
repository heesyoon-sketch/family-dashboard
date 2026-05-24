'use client';

import { useEffect } from 'react';

// Last-resort error UI for failures inside the root layout itself. Bundles
// minimal styles inline so it survives even when globals.css can't load.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#0D0E1C',
          color: '#FFFFFF',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🛟</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 16px' }}>
            앱이 완전히 멈췄어요
          </h1>
          <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 24px' }}>
            새로고침으로도 안 풀리면 잠시 후에 다시 열어주세요.
          </p>
          {error.digest && (
            <p style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.3, margin: '0 0 16px' }}>
              ref: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              borderRadius: 999,
              backgroundColor: '#4EEDB0',
              color: '#0D0E1C',
              border: 0,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
