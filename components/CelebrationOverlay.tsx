'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Celebration, useFamilyStore } from '@/lib/store';
import { useEffect } from 'react';

export function CelebrationOverlay({
  data,
  onDismiss,
}: {
  data: Celebration;
  onDismiss: () => void;
}) {
  const user = useFamilyStore(s => s.users.find(u => u.id === data.userId));

  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!user) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 cursor-pointer"
      >
        <motion.div
          data-theme={user.theme}
          initial={{ scale: 0.5, rotate: -8, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16 }}
          className="bg-[var(--bg-card)] text-[var(--fg)] rounded-3xl p-10 text-center max-w-md mx-4"
          style={{ boxShadow: '0 0 60px var(--accent-glow)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-7xl mb-4 burst">
            {data.type === 'level_up' ? '🎉' : '🏆'}
          </div>
          <div className="text-sm font-semibold text-[var(--accent)] mb-1">
            {user.name}
          </div>
          <h2 className="text-3xl font-bold mb-3">
            {data.type === 'level_up'
              ? `레벨 ${data.newLevel}!`
              : data.badge.name}
          </h2>
          <p className="text-[var(--fg-muted)]">
            {data.type === 'level_up'
              ? '새로운 보상이 해금되었어요'
              : data.badge.description}
          </p>
          <button
            onClick={onDismiss}
            className="mt-6 px-6 py-3 rounded-xl bg-[var(--accent)] text-white font-semibold min-h-[var(--touch-target)]"
          >
            좋아!
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
