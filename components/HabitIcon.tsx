'use client';

import * as Icons from 'lucide-react';
import { CUSTOM_ICON_MAP } from './CustomIcons';

type IconComponent = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
const LUCIDE = Icons as unknown as Record<string, IconComponent>;
const pascalCase = (value: string) => value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');

/** A habit's stored icon name (e.g. "dumbbell") rendered as its icon. */
export function HabitIcon({ name, size = 18, className }: { name: string; size?: number; className?: string }) {
  const Icon = CUSTOM_ICON_MAP[name] ?? LUCIDE[pascalCase(name)] ?? Icons.Circle;
  return <Icon size={size} className={className} aria-hidden />;
}
