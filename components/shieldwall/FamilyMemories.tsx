'use client';

import { useEffect, useState } from 'react';
import { Heart, LoaderCircle, Trash2 } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase';
import type { FamilyMemory } from '@/lib/analytics/useFamilyAnalytics';
import { useCopy } from '@/components/analytics/ui';

/** Optional one-line family memories (existing growth_memories table). */
export function FamilyMemoryForm({ familyId, today, onSaved }: { familyId: string; today: string; onSaved: () => void }) {
  const { en } = useCopy();
  const [authId, setAuthId] = useState('');
  const [body, setBody] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  useEffect(() => {
    let live = true;
    void createBrowserSupabase().auth.getUser().then(({ data }) => { if (live) setAuthId(data.user?.id ?? ''); });
    return () => { live = false; };
  }, []);
  const save = async () => {
    if (!authId || !body.trim() || saving) return;
    setSaving(true);
    const { error } = await createBrowserSupabase().from('growth_memories').insert({ family_id: familyId, author_id: authId, body: body.trim(), memory_date: date || today });
    setSaving(false);
    if (error) { setStatus('error'); return; }
    setBody(''); setStatus('saved'); onSaved();
  };
  return (
    <form onSubmit={e => { e.preventDefault(); void save(); }} className="rounded-2xl border border-white/[0.07] bg-black/15 p-4">
      <label htmlFor="family-memory" className="text-sm font-semibold text-white">{en ? 'Add a family memory' : '가족의 한 줄 남기기'}</label>
      <textarea id="family-memory" value={body} maxLength={500} rows={2} onChange={e => { setBody(e.target.value); setStatus('idle'); }} placeholder={en ? 'Something worth remembering…' : '기억하고 싶은 순간이 있었나요?'} className="mt-2 w-full resize-y rounded-xl border border-white/12 bg-black/25 p-3 text-sm leading-relaxed text-white placeholder:text-[#7F86A8] focus:outline-2 focus:outline-[#A5A6FF]" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[#A9AECB]">{en ? 'Date' : '날짜'}
          <input type="date" value={date || today} max={today} onChange={e => setDate(e.target.value)} className="min-h-11 rounded-lg border border-white/12 bg-[#1d2340] px-2 text-white [color-scheme:dark]" />
        </label>
        <span className="text-xs text-[#7F86A8]">{body.length}/500</span>
        <button type="submit" disabled={saving || !authId || !body.trim()} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#A5A6FF] px-4 text-sm font-semibold text-[#141733] disabled:opacity-40">
          {saving ? <LoaderCircle size={15} className="animate-spin" aria-hidden /> : <Heart size={15} aria-hidden />}{en ? 'Save' : '남기기'}
        </button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs">
        {status === 'saved' && <span className="text-[#79E8BD]">{en ? 'Saved to the family legacy.' : '가족 기록에 남겼어요.'}</span>}
        {status === 'error' && <span className="text-[#F3E3BC]">{en ? 'Not saved — your text is still here. Please try again.' : '저장하지 못했어요. 입력한 내용은 그대로 있어요.'}</span>}
      </p>
    </form>
  );
}

export function MemoryCard({ memory, mine, onDeleted }: { memory: FamilyMemory; mine: boolean; onDeleted: () => void }) {
  const { en } = useCopy();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const remove = async () => {
    setBusy(true);
    const { data, error } = await createBrowserSupabase().from('growth_memories').delete().eq('id', memory.id).select('id');
    setBusy(false);
    if (error || !data?.length) { setFailed(true); return; }
    onDeleted();
  };
  return (
    <div>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#E7E9F5]">{memory.body}</p>
      {mine && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {confirm ? (
            <>
              <span className="text-[#A9AECB]">{en ? 'Delete this memory?' : '이 기록을 지울까요?'}</span>
              <button type="button" disabled={busy} onClick={() => void remove()} className="min-h-9 rounded-lg border border-white/15 px-3 text-white hover:bg-white/10">{en ? 'Delete' : '삭제'}</button>
              <button type="button" onClick={() => setConfirm(false)} className="min-h-9 rounded-lg px-3 text-[#A9AECB] hover:bg-white/10">{en ? 'Keep' : '취소'}</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="inline-flex min-h-9 items-center gap-1 text-[#8E94B4] hover:text-white"><Trash2 size={12} aria-hidden />{en ? 'Delete my memory' : '내 기록 삭제'}</button>
          )}
          {failed && <span className="text-[#F3E3BC]">{en ? 'Could not delete.' : '삭제하지 못했어요.'}</span>}
        </div>
      )}
    </div>
  );
}

