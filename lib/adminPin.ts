'use client';

import { createBrowserSupabase } from './supabase';
import { hashPin, isLegacyHash, verifyPin } from './pin';

export async function getCurrentFamilyAdminPinHash(): Promise<string | null> {
  try {
    const supabase = createBrowserSupabase();
    const { data: familyId, error: familyError } = await supabase.rpc('get_my_family_id');
    if (familyError || !familyId) return null;

    const { data } = await supabase
      .from('family_settings')
      .select('value')
      .eq('key', 'admin_pin_hash')
      .eq('family_id', familyId)
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function familyHasAdminPin(): Promise<boolean> {
  return Boolean(await getCurrentFamilyAdminPinHash());
}

/**
 * Hashes newPin and upserts it into family_settings for the current family.
 * Returns the new hash so the caller can update local state immediately.
 */
export async function saveAdminPin(newPin: string): Promise<string> {
  const hash = await hashPin(newPin);
  const supabase = createBrowserSupabase();

  const { error } = await supabase.rpc('admin_upsert_family_setting', {
    p_key: 'admin_pin_hash',
    p_value: hash,
  });
  if (error) throw error;
  return hash;
}

/**
 * Verifies the PIN and silently upgrades a legacy fixed-salt hash to the
 * per-family random-salt format (v1) on the next successful login.
 * Returns { ok, upgradedHash } — if upgradedHash is set, the caller should
 * update local state so subsequent verifications use the new hash.
 */
export async function verifyAdminPin(
  pin: string,
  currentHash: string,
): Promise<{ ok: boolean; upgradedHash?: string }> {
  const ok = await verifyPin(pin, currentHash);
  if (!ok) return { ok: false };
  if (!isLegacyHash(currentHash)) return { ok: true };

  // Legacy hash verified — upgrade to v1 format silently.
  try {
    const newHash = await hashPin(pin);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.rpc('admin_upsert_family_setting', {
      p_key: 'admin_pin_hash',
      p_value: newHash,
    });
    if (!error) return { ok: true, upgradedHash: newHash };
  } catch {
    // Upgrade failed — still grant access; will retry on next login.
  }
  return { ok: true };
}

export { verifyPin };
