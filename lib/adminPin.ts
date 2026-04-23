'use client';

import { createBrowserSupabase } from './supabase';
import { hashPin, verifyPin } from './pin';
import type { User } from './db';

/**
 * Fetches the admin PIN hash stored in family_settings.
 * Returns null if the table doesn't exist yet or no row is found.
 */
async function fetchSettingsPinHash(): Promise<string | null> {
  try {
    const supabase = createBrowserSupabase();
    const { data } = await supabase
      .from('family_settings')
      .select('value')
      .eq('key', 'admin_pin_hash')
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns the effective admin PIN hash, checking sources in priority order:
 *  1. family_settings table  (DB — new system)
 *  2. users.pin_hash for PARENT users  (legacy column — backward compat)
 *  3. NEXT_PUBLIC_ADMIN_PIN env variable  (initial-setup fallback)
 *
 * Returns null when no PIN is configured anywhere.
 */
export async function getEffectiveAdminPinHash(
  parents: Pick<User, 'pinHash'>[],
): Promise<string | null> {
  const dbHash = await fetchSettingsPinHash();
  if (dbHash) return dbHash;

  const legacyHash = parents.find(p => p.pinHash)?.pinHash ?? null;
  if (legacyHash) return legacyHash;

  const envPin = process.env.NEXT_PUBLIC_ADMIN_PIN;
  if (envPin) return hashPin(envPin);

  return null;
}

/**
 * Hashes newPin and upserts it into family_settings as 'admin_pin_hash'.
 * Returns the new hash so the caller can update local state immediately.
 */
export async function saveAdminPin(newPin: string): Promise<string> {
  const hash = await hashPin(newPin);
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from('family_settings')
    .upsert(
      { key: 'admin_pin_hash', value: hash, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw error;
  return hash;
}

export { verifyPin };
