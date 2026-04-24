'use client';

import { createBrowserSupabase } from './supabase';
import { hashPin, verifyPin } from './pin';
import type { User } from './db';

async function fetchSettingsPinHash(): Promise<string | null> {
  try {
    const supabase = createBrowserSupabase();
    // RLS automatically scopes this to the current user's family
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
 *  1. family_settings table  (DB — per-family)
 *  2. users.pin_hash for PARENT users  (legacy backward-compat)
 *  3. NEXT_PUBLIC_ADMIN_PIN env variable  (initial-setup fallback)
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
 * Hashes newPin and upserts it into family_settings for the current family.
 * Returns the new hash so the caller can update local state immediately.
 */
export async function saveAdminPin(newPin: string): Promise<string> {
  const hash = await hashPin(newPin);
  const supabase = createBrowserSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!family) throw new Error('No family found');

  const { error } = await supabase
    .from('family_settings')
    .upsert(
      {
        key:        'admin_pin_hash',
        value:      hash,
        updated_at: new Date().toISOString(),
        family_id:  family.id,
      },
      { onConflict: 'key,family_id' },
    );
  if (error) throw error;
  return hash;
}

export { verifyPin };
