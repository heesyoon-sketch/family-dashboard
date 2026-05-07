'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode } from 'react';
import type { Avatar3DMood, Avatar3DSize } from './Avatar3D';

const Avatar3D = dynamic(() => import('./Avatar3D'), {
  ssr: false,
});

type Avatar3DCardProps = {
  mood?: Avatar3DMood;
  size?: Avatar3DSize;
  completedToday?: boolean;
  fallback: ReactNode;
  label: string;
  className?: string;
};

type BoundaryState = {
  failed: boolean;
};

class Avatar3DErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

export function Avatar3DCard({
  mood = 'idle',
  size = 'sm',
  completedToday = false,
  fallback,
  label,
  className = '',
}: Avatar3DCardProps) {
  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--border)] bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.65),transparent_36%),var(--accent-glow)] ${className}`}
      aria-label={label}
    >
      <Avatar3DErrorBoundary fallback={fallback}>
        <Avatar3D mood={mood} size={size} completedToday={completedToday} />
      </Avatar3DErrorBoundary>
    </div>
  );
}
