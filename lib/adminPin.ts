'use client';

import { createBrowserSupabase } from './supabase';
import { hashPin, verifyPin } from './pin';

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

export { verifyPin };
