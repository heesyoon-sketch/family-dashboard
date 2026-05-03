'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, SkipForward, Sparkles } from 'lucide-react';
import { FamBitAuthShell } from '@/components/FamBitAuthShell';
import { createBrowserSupabase } from '@/lib/supabase';
import { familyHasAdminPin } from '@/lib/adminPin';

interface SeedMember {
  id: string;
  name: string;
  role: 'PARENT' | 'CHILD';
  theme: string;
  displayOrder: number;
}

const PLACEHOLDER_NAMES = new Set(['Dad', 'Mom', 'Child 1', 'Child 2']);

export default function WelcomePage() {
  const router = useRouter();
  const [members, setMembers] = useState<SeedMember[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      const supabase = createBrowserSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }
      const { data: familyId } = await supabase.rpc('get_my_family_id');
      if (!familyId) {
        router.replace('/setup');
        return;
      }
      if (!await familyHasAdminPin()) {
        router.replace('/setup/set-pin');
        return;
      }

      const { data: rows, error } = await supabase
        .from('users')
        .select('id, name, role, theme, display_order')
        .eq('family_id', familyId)
        .order('display_order', { ascending: true });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }
      const list: SeedMember[] = (rows ?? []).map(r => ({
        id: r.id as string,
        name: r.name as string,
        role: r.role as 'PARENT' | 'CHILD',
        theme: r.theme as string,
        displayOrder: (r.display_order as number) ?? 0,
      }));
      setMembers(list);
      setEdits(Object.fromEntries(list.map(m => [m.id, m.name])));
      setLoading(false);
    };
    load().catch(err => {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load family');
      setLoading(false);
    });
  }, [router]);

  const finish = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('family_onboarding_complete', '1');
    }
    router.replace('/');
  };

  const handleSkip = () => finish();

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const supabase = createBrowserSupabase();
      const updates = members
        .map(m => ({ id: m.id, original: m.name, next: (edits[m.id] ?? '').trim() }))
        .filter(u => u.next.length > 0 && u.next !== u.original);

      for (const u of updates) {
        const { error } = await supabase
          .from('users')
          .update({ name: u.next })
          .eq('id', u.id);
        if (error) throw error;
      }
      finish();
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save names');
      setSaving(false);
    }
  };

  const changedCount = useMemo(() => {
    return members.reduce((n, m) => {
      const next = (edits[m.id] ?? '').trim();
      return next.length > 0 && next !== m.name ? n + 1 : n;
    }, 0);
  }, [members, edits]);

  if (loading) return <div className="min-h-screen bg-[#0D0E1C]" />;

  return (
    <FamBitAuthShell
      eyebrow="Welcome"
      title="Meet your family"
      description="We seeded your dashboard with placeholder members. Rename them to your real family — you can always edit more later in admin."
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-[#4EEDB0]/25 bg-[#4EEDB0]/8 p-3 text-xs leading-5 text-[#9af2ce]">
          <Sparkles size={15} className="shrink-0 text-[#4EEDB0]" />
          <span>Default tasks and rewards are already set up. You can swap or add more later.</span>
        </div>

        <ul className="space-y-2">
          {members.map(member => {
            const next = edits[member.id] ?? '';
            const isPlaceholder = PLACEHOLDER_NAMES.has(member.name);
            return (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#111224] p-3"
              >
                <div
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-black text-white/90"
                  style={{ background: themeAccent(member.theme) }}
                >
                  {(next || member.name).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={next}
                    onChange={e => setEdits(prev => ({ ...prev, [member.id]: e.target.value }))}
                    maxLength={20}
                    placeholder={member.name}
                    className="h-9 w-full rounded-md border border-white/10 bg-[#0D0E1C] px-2 text-sm font-bold text-white outline-none transition-colors placeholder:text-white/30 focus:border-[#4EEDB0]"
                  />
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/45">
                    <span>{member.role === 'PARENT' ? 'Parent' : 'Child'}</span>
                    {isPlaceholder && (
                      <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-white/55">
                        placeholder
                      </span>
                    )}
                  </div>
                </div>
                {!isPlaceholder && next === member.name && (
                  <Check size={16} className="shrink-0 text-[#4EEDB0]" />
                )}
              </li>
            );
          })}
        </ul>

        {errorMsg && (
          <p className="rounded-lg border border-[#FF7BAC]/35 bg-[#FF7BAC]/10 px-3 py-2 text-sm leading-5 text-[#FFB8CF]">
            {errorMsg}
          </p>
        )}

        <button
          onClick={() => { void handleSave(); }}
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#4EEDB0] text-sm font-black text-[#07120E] transition-colors hover:bg-[#71F4C0] disabled:bg-white/[0.055] disabled:text-white/36"
        >
          {saving ? (
            'Saving…'
          ) : (
            <>
              {changedCount > 0
                ? `Save ${changedCount} ${changedCount === 1 ? 'name' : 'names'} & continue`
                : 'Continue to dashboard'}
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          disabled={saving}
          className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] text-xs font-bold text-white/58 transition-colors hover:bg-white/10"
        >
          <SkipForward size={14} />
          Skip — I&apos;ll edit names in admin
        </button>
      </div>
    </FamBitAuthShell>
  );
}

function themeAccent(theme: string): string {
  switch (theme) {
    case 'dark_minimal': return '#4f9cff';
    case 'warm_minimal': return '#d97757';
    case 'robot_neon':   return '#00e5ff';
    case 'pastel_cute':  return '#ff8fab';
    default:             return '#4EEDB0';
  }
}
