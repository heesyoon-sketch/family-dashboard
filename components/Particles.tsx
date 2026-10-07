'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ThemeName } from '@/lib/db';

export interface ParticleData {
  id: number;
  dx: number;
  dy: number;
  color: string;
  shape: 'spark' | 'dot' | 'symbol';
  symbol?: string;
  size: number;
  angle: number;  // degrees — used for spark rotation
}

export function buildParticles(theme: ThemeName): ParticleData[] {
  if (theme === 'robot_neon') {
    const colors = ['#4EEDB0', '#5B8EFF', '#FF7BAC', '#ffffff', '#4EEDB0', '#5B8EFF', '#FF7BAC', '#4EEDB0', '#ffffff', '#5B8EFF'];
    return Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const dist = 55 + Math.random() * 45;
      return {
        id: i,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        color: colors[i],
        shape: 'spark',
        size: 2 + Math.random() * 2,
        angle: (angle * 180) / Math.PI,
      };
    });
  }

  if (theme === 'pastel_cute') {
    const symbols = ['♡', '★', '✦', '♡', '★', '✦', '♡', '★'];
    const colors = ['#FF7BAC', '#5B8EFF', '#4EEDB0', '#FFFFFF', '#FF7BAC', '#5B8EFF', '#4EEDB0', '#FFFFFF'];
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      dx: -45 + Math.random() * 90,
      dy: -(45 + Math.random() * 70),
      color: colors[i],
      shape: 'symbol',
      symbol: symbols[i],
      size: 14 + Math.random() * 8,
      angle: -15 + Math.random() * 30,
    }));
  }

  // dark_minimal / warm_minimal
  const colors = theme === 'warm_minimal'
    ? ['#FF7BAC', '#4EEDB0', '#5B8EFF', '#FFFFFF', '#FF7BAC']
    : ['#5B8EFF', '#4EEDB0', '#FF7BAC', '#FFFFFF', '#5B8EFF'];
  return Array.from({ length: 5 }, (_, i) => {
    const angle = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist = 28 + Math.random() * 28;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      color: colors[i],
      shape: 'dot',
      size: 3 + Math.random() * 3,
      angle: 0,
    };
  });
}

interface Props {
  particles: ParticleData[] | null;
  theme: ThemeName;
}

export function Particles({ particles, theme }: Props) {
  const duration = theme === 'dark_minimal' || theme === 'warm_minimal' ? 0.3 : 0.85;

  return (
    <AnimatePresence>
      {particles?.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: p.dx, y: p.dy, opacity: 0, scale: 1 }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={{ duration, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            pointerEvents: 'none',
            zIndex: 40,
            translateX: '-50%',
            translateY: '-50%',
          }}
        >
          {p.shape === 'spark' && (
            <div
              style={{
                width: 14,
                height: p.size,
                background: p.color,
                borderRadius: 1,
                transform: `rotate(${p.angle}deg)`,
                boxShadow: `0 0 6px 1px ${p.color}`,
              }}
            />
          )}
          {p.shape === 'dot' && (
            <div
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                borderRadius: '50%',
              }}
            />
          )}
          {p.shape === 'symbol' && (
            <span
              style={{
                fontSize: p.size,
                color: p.color,
                display: 'block',
                transform: `rotate(${p.angle}deg)`,
                lineHeight: 1,
                textShadow: `0 0 4px ${p.color}`,
              }}
            >
              {p.symbol}
            </span>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
