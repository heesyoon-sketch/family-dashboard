'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, BookHeart, CalendarDays, Check, ChevronDown, Footprints, Heart, LoaderCircle, RefreshCw, Sprout, Trash2 } from 'lucide-react';
import { useFamilyStore } from '@/lib/store';
import { useLanguage } from '@/contexts/LanguageContext';
import { createBrowserSupabase } from '@/lib/supabase';
import { buildGrowth, type GrowthCompletion, type GrowthTask, type GrowthMemory } from '@/lib/growth/model';
import { loadGrowthData, loadMemories } from '@/lib/growth/data';
import { ACHIEVEMENTS } from '@/lib/achievements/definitions';

type Tab = 'week' | 'journey' | 'family';
type History = { familyId: string; tasks: GrowthTask[]; completions: GrowthCompletion[]; now: Date };
const tones = ['#adcbb3', '#e9bba6', '#b9bde7', '#e4cf8f'];
const panel = 'rounded-3xl border border-white/10 bg-white/[0.035]';
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c7dfbd] disabled:opacity-40';

export function GrowthAlbum() {
  const familyId = useFamilyStore(s => s.familyId);
  return <GrowthAlbumContent key={familyId ?? 'loading'} />;
}

function GrowthAlbumContent() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const search = useSearchParams();
  const familyId = useFamilyStore(s => s.familyId);
  const members = useFamilyStore(s => s.users);
  const timezone = useFamilyStore(s => s.automaticSaleConfig.timezone);
  const memberKey = members.map(m => m.id).join(',');
  const [tab, setTab] = useState<Tab>(search.get('member') ? 'journey' : 'week');
  const [selectedId, setSelectedId] = useState(search.get('member') ?? '');
  const [history, setHistory] = useState<History | null>(null);
  const [memories, setMemories] = useState<GrowthMemory[]>([]);
  const [error, setError] = useState('');
  const [notesError, setNotesError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [authId, setAuthId] = useState('');
  const [body, setBody] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [momentLimit, setMomentLimit] = useState(12);
  const [archive, setArchive] = useState<Array<{ user_id: string; unlocked_at_by_achievement_id: Record<string, string>; equipped_insignia_ids: string[] }> | null>(null);
  const [archiveError, setArchiveError] = useState(false);
  const familyRef = useRef(familyId);
  useEffect(() => { familyRef.current = familyId; }, [familyId]);

  useEffect(() => {
    if (!familyId || !memberKey) return;
    let current = true;
    const now = new Date();
    const db = createBrowserSupabase();
    // Separate optional memories from completion history: a notes outage must
    // never masquerade as zero completed habits, or hide the main album.
    Promise.resolve().then(() => { if (current) { setRefreshing(true); setError(''); } });
    loadGrowthData(familyId, memberKey.split(','), now).then(data => {
      if (current) setHistory({ ...data, familyId, now });
    }).catch(() => { if (current) setError(en ? 'We could not refresh your records. Please try again.' : '기록을 불러오지 못했어요. 다시 시도해주세요.'); })
      .finally(() => { if (current) setRefreshing(false); });
    loadMemories(familyId).then(data => { if (current) { setMemories(data); setNotesError(''); } }).catch(() => {
      if (current) { setMemories([]); setNotesError(en ? 'Memories could not be loaded.' : '가족 메모를 불러오지 못했어요.'); }
    });
    db.auth.getUser().then(({ data }) => { if (current) setAuthId(data.user?.id ?? ''); });
    return () => { current = false; };
  }, [familyId, memberKey, revision, en]);

  useEffect(() => {
    if (!familyId) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => setRevision(n => n + 1), 500); };
    const wake = () => { if (!document.hidden) refresh(); };
    const db = createBrowserSupabase();
    const channel = db.channel(`growth-album:${familyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, refresh)
      .subscribe();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', refresh);
    const interval = setInterval(wake, 60_000);
    return () => { clearTimeout(timer); clearInterval(interval); document.removeEventListener('visibilitychange', wake); window.removeEventListener('online', refresh); void db.removeChannel(channel); };
  }, [familyId]);

  const validHistory = history?.familyId === familyId ? history : null;
  const growth = useMemo(() => validHistory ? buildGrowth(members, validHistory.tasks, validHistory.completions, validHistory.now, timezone) : null, [validHistory, members, timezone]);
  const person = growth?.people.find(p => p.id === selectedId) ?? growth?.people[0];
  const pick = (id: string) => { setSelectedId(id); setMomentLimit(12); setTab('journey'); };
  const dateLabel = (day: string) => new Intl.DateTimeFormat(en ? 'en-CA' : 'ko-KR', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
  const titleLabel = (title: string) => title || (en ? 'A past habit' : '이전 습관');
  const saveMemory = async () => {
    if (!familyId || !authId || !body.trim() || saving || !growth) return;
    const requestedFamily = familyId;
    setSaving(true); setNotesError(''); setSaved(false);
    try {
      const { error: writeError } = await createBrowserSupabase().from('growth_memories').insert({ family_id: familyId, author_id: authId, body: body.trim(), memory_date: noteDate || growth.today });
      if (writeError) throw writeError;
      if (familyRef.current !== requestedFamily) return;
      setBody(''); setSaved(true); setRevision(n => n + 1);
    } catch { if (familyRef.current === requestedFamily) setNotesError(en ? 'Not saved. Your text is still here; please try again.' : '저장하지 못했어요. 입력한 내용은 남아 있으니 다시 시도해주세요.'); }
    finally { setSaving(false); }
  };
  const removeMemory = async (id: string) => {
    if (!familyId || deleting) return;
    setDeleting(id); setNotesError('');
    try {
      const { data, error: deleteError } = await createBrowserSupabase().from('growth_memories').delete().eq('id', id).eq('family_id', familyId).eq('author_id', authId).select('id');
      if (deleteError || !data?.length) throw deleteError ?? new Error('not deleted');
      setMemories(items => items.filter(item => item.id !== id)); setConfirmDelete(null);
    } catch { setNotesError(en ? 'Could not delete this memory. Try again.' : '메모를 삭제하지 못했어요. 다시 시도해주세요.'); }
    finally { setDeleting(null); }
  };
  const loadArchive = useCallback(async () => {
    if (!familyId) return;
    const requestedFamily = familyId;
    setArchiveError(false);
    const { data, error: archiveLoadError } = await createBrowserSupabase().from('achievement_states').select('user_id,unlocked_at_by_achievement_id,equipped_insignia_ids').eq('family_id', familyId);
    if (familyRef.current !== requestedFamily) return;
    if (archiveLoadError) { setArchiveError(true); return; }
    setArchive(data ?? []);
  }, [familyId]);

  if (!growth) return <section className="mx-auto max-w-5xl p-8 text-center text-[#e9e5db]" aria-live="polite">
    <BookHeart className="mx-auto mb-4 text-[#c7dfbd]" size={36} />
    <h1 className="text-xl font-semibold">{en ? 'Our growth album' : '우리 가족의 성장 앨범'}</h1>
    <p className="my-4 text-sm text-white/60">{error || (en ? 'Gathering the little things you have done…' : '차곡차곡 쌓인 우리 가족의 기록을 모으고 있어요…')}</p>
    {error && <button className={action} onClick={() => setRevision(n => n + 1)}>{en ? 'Try again' : '다시 시도'}</button>}
  </section>;

  return <div className="min-h-full bg-[#111814] text-[#eeeae0]">
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
      <header className="relative overflow-hidden rounded-[2rem] border border-[#c7dfbd]/15 bg-[radial-gradient(ellipse_at_top_right,rgba(174,205,153,0.15),transparent_65%)] p-6 sm:p-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-[#b7cbb0]"><Sprout size={17} /> FAMBIT · {en ? 'GROW TOGETHER' : '함께 자라는 일상'}</span>
          <button onClick={() => setRevision(n => n + 1)} disabled={refreshing} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 hover:bg-white/10" aria-label={en ? 'Refresh records' : '기록 새로고침'}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
        <h1 className="max-w-xl whitespace-pre-line text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{en ? 'Little things. Lasting growth.' : '작은 실천이 모여,\n우리의 이야기가 돼요.'}</h1>
        <p className="mt-4 max-w-xl text-sm leading-7 text-[#c1c9bd]">{en ? 'A place to notice your effort, remember your days, and begin again. Every recorded step stays with you.' : '잘한 날도, 다시 시작한 날도. 서로 비교하지 않고 각자의 노력을 기억하는 우리 가족의 성장 앨범.'}</p>
        <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/10 pt-5">
          <div><span className="text-2xl font-semibold text-[#d8e6c8]">{growth.weekTotal.toLocaleString()}</span><span className="ml-2 text-xs text-white/60">{en ? 'habits this week' : '이번 주의 실천'}</span></div>
          <div><span className="text-2xl font-semibold text-[#e8c8a9]">{growth.familyMoments.filter(m => m.day >= growth.weekStart).length}</span><span className="ml-2 text-xs text-white/60">{en ? 'shared activity records this week' : '이번 주 가족 활동 기록'}</span></div>
        </div>
      </header>
      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 p-3 text-sm text-amber-100">{error} {en ? 'Showing the last successful refresh.' : '마지막으로 불러온 기록을 표시하고 있어요.'}</p>}
      <nav aria-label={en ? 'Album sections' : '앨범 메뉴'} className="my-6 grid grid-cols-3 gap-1 rounded-2xl bg-black/20 p-1.5">
        {([{ id: 'week', label: en ? 'This week' : '이번 주', Icon: CalendarDays }, { id: 'journey', label: en ? 'My journey' : '나의 발자취', Icon: Footprints }, { id: 'family', label: en ? 'Family album' : '가족 앨범', Icon: BookHeart }] as const).map(({ id, label, Icon }) => <button key={id} onClick={() => { setTab(id); setMomentLimit(12); }} aria-pressed={tab === id} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-1 text-xs font-semibold transition sm:text-sm ${tab === id ? 'bg-[#d3dfc2] text-[#1c2d20] shadow-sm' : 'text-white/60 hover:bg-white/5'}`}><Icon size={16} className="hidden min-[380px]:block" />{label}</button>)}
      </nav>
      {tab === 'week' && <section aria-label={en ? 'This week' : '이번 주'}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><h2 className="text-xl font-semibold">{en ? 'Effort worth noticing' : '이번 주, 알아봐 주고 싶은 노력'}</h2><p className="text-xs text-white/50">{dateLabel(growth.weekStart)} – {dateLabel(growth.today)}</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {growth.people.map((p, i) => <article key={p.id} className={`${panel} p-5 sm:p-6`}>
            <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl text-lg font-semibold text-[#172018]" style={{ background: tones[i % tones.length] }}>{p.name.slice(-2)}</span><h3 className="text-lg font-semibold">{p.name}</h3></div>
            {p.week > 0 ? <><p className="mt-6 text-2xl font-semibold leading-snug">{en ? `${p.week} little steps, ${p.weekDays} active days.` : `${p.weekDays}일 동안, ${p.week}번의 실천.`}</p><p className="mt-2 min-h-10 text-sm leading-6 text-white/60">{p.previous === 0 ? (en ? 'Your effort is finding its place this week.' : '이번 주에도 나만의 기록을 쌓고 있어요.') : p.week > p.previous ? (en ? `${p.week - p.previous} more completions than the same weekdays last week.` : `지난주 같은 요일 구간보다 ${p.week - p.previous}번 더 실천했어요.`) : (en ? 'Your pace can change. The effort you made still counts.' : '속도가 달라도 괜찮아요. 해낸 노력은 그대로 남아요.')}</p></> : <><p className="mt-6 text-xl font-semibold">{en ? 'A fresh page for this week.' : '이번 주의 첫 페이지를 기다려요.'}</p><p className="mt-2 min-h-10 text-sm leading-6 text-white/60">{en ? 'Complete a habit and your record will appear here.' : '습관을 완료하면 이곳에 기록이 쌓여요.'}</p></>}
            <div className="mt-5 space-y-2 border-t border-white/10 pt-4">{p.habits.filter(h => h.week > 0).slice(0, 3).map(h => <div key={h.id} className="flex items-start justify-between gap-4 text-sm"><span className="min-w-0 break-words text-white/75">{titleLabel(h.title)}</span><span className="shrink-0 text-[#c7dfbd]">{h.week}{en ? ' times' : '회'}</span></div>)}</div>
            <button className="mt-5 flex min-h-11 items-center gap-2 text-sm font-semibold text-[#c7dfbd] hover:underline" onClick={() => pick(p.id)}>{en ? 'See the journey' : '발자취 펼쳐보기'}<ArrowRight size={16} /></button>
          </article>)}
        </div>
        <p className="mt-4 text-xs leading-6 text-white/45">{en ? 'Comparison uses Monday through today versus the same weekdays last week. Today is still in progress; these are counts, not completion rates.' : '월요일부터 오늘까지와 지난주 같은 요일 구간을 비교해요. 오늘은 진행 중이며, 완료율이 아닌 실천 횟수예요.'}</p>
      </section>}
      {tab === 'journey' && <section aria-label={en ? 'My journey' : '나의 발자취'}>
        <div className="mb-6 flex flex-wrap gap-2" aria-label={en ? 'Choose family member' : '가족 구성원 선택'}>{growth.people.map((p, i) => <button key={p.id} className={`${action} ${person?.id === p.id ? 'bg-white/10' : ''}`} aria-pressed={person?.id === p.id} onClick={() => pick(p.id)}><span className="h-2 w-2 rounded-full" style={{ background: tones[i % tones.length] }} />{p.name}</button>)}</div>
        {person && <>
          <div className={`${panel} p-6`}><p className="text-sm text-[#b7cbb0]">{en ? `${person.name}'s journey` : `${person.name}의 발자취`}</p><h2 className="mt-3 text-2xl font-semibold">{en ? `${person.total.toLocaleString()} steps that still belong to you.` : `차곡차곡 쌓인 ${person.total.toLocaleString()}번의 실천.`}</h2><p className="mt-2 text-sm text-white/60">{en ? `${person.activeDays} days with a completed habit. Taking a break never resets this record.` : `습관을 실천한 날은 ${person.activeDays}일. 잠시 쉬어도 이 기록은 초기화되지 않아요.`}</p>
            <div className="mt-6 grid grid-cols-7 gap-2 sm:grid-cols-14" aria-label={en ? 'Last 28 days' : '최근 28일 기록'}>{person.calendar.map(d => <div key={d.day} title={`${dateLabel(d.day)} · ${d.count}${en ? ' completed' : '회 완료'}`} aria-label={`${dateLabel(d.day)} · ${d.count}${en ? ' completed' : '회 완료'}`} className={`grid aspect-square max-h-12 place-items-center rounded-lg text-xs ${d.count ? 'bg-[#b7cbb0] text-[#142419]' : 'bg-white/5 text-white/35'}`}>{d.day.slice(8)}</div>)}</div><p className="mt-3 text-xs text-white/45">{en ? 'Last 28 days · Green marks a day with at least one completed habit.' : '최근 28일 · 초록색은 습관을 한 번 이상 완료한 날이에요.'}</p>
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className={`${panel} p-6`}><h3 className="text-lg font-semibold">{en ? 'Effort that adds up' : '쌓여가는 노력'}</h3>{!person.habits.length && <p className="mt-4 text-sm text-white/55">{en ? 'Your first habit will start this page.' : '첫 실천부터 차근차근 기록할게요.'}</p>}<div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto">{person.habits.map(h => <div key={h.id} className="border-b border-white/8 pb-3"><p className="text-sm leading-6">{titleLabel(h.title)}</p><p className="mt-1 text-xs text-[#b7cbb0]">{en ? `${h.total} completions · ${h.days.size} different days` : `누적 ${h.total}회 · ${h.days.size}일의 실천`}</p></div>)}</div></section>
          <section className={`${panel} p-6`}><h3 className="text-lg font-semibold">{en ? 'Moments to remember' : '기억하고 싶은 순간'}</h3><div className="mt-5 space-y-5">{person.moments.slice(0, momentLimit).map(m => <article key={m.id} className="flex gap-3"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#d3dfc2]/10 text-[#c7dfbd]">{m.kind === 'return' ? <Sprout size={16} /> : <Footprints size={16} />}</span><div><p className="text-xs text-white/45">{dateLabel(m.day)}</p><h4 className="mt-1 text-sm font-semibold">{m.kind === 'first' ? (en ? 'The first recorded step' : '기록으로 남은 첫걸음') : m.kind === 'return' ? (en ? 'A new beginning after a pause' : '쉬었다가 다시 시작한 날') : (en ? `${m.count} completions` : `${m.count}번의 실천이 쌓였어요`)}</h4><p className="mt-1 text-sm leading-6 text-white/55">{m.kind === 'return' ? (en ? 'Three or more days without records, then a step forward.' : '3일 이상 기록이 없다가 다시 실천했어요.') : titleLabel(m.title)}</p></div></article>)}{!person.moments.length && <p className="text-sm text-white/55">{en ? 'Your first moment is still ahead of you.' : '앞으로 쌓일 작은 순간들을 기다리고 있어요.'}</p>}</div>{person.moments.length > momentLimit && <button className={`${action} mt-5`} onClick={() => setMomentLimit(n => n + 12)}>{en ? 'Earlier moments' : '이전 순간 더 보기'}<ChevronDown size={15} /></button>}</section></div>
        </>}
      </section>}
      {tab === 'family' && <section aria-label={en ? 'Family album' : '가족 앨범'}>
        <div className="mb-6"><h2 className="text-xl font-semibold">{en ? 'Days we want to remember' : '함께 기억하고 싶은 날들'}</h2><p className="mt-2 text-sm leading-6 text-white/60">{en ? 'Shared activity records and a few words in your own voice. Nobody has to have a perfect day.' : '함께 쌓은 활동 기록에 우리만의 한 줄을 더해요. 모두가 완벽한 하루를 보낼 필요는 없어요.'}</p></div>
        <form onSubmit={e => { e.preventDefault(); void saveMemory(); }} className={`${panel} mb-6 p-5`}>
          <label htmlFor="memory-body" className="block text-sm font-semibold">{en ? 'Leave a little memory' : '오늘을 기억할 한 줄'}</label>
          <textarea id="memory-body" value={body} maxLength={500} rows={3} onChange={e => { setBody(e.target.value); setSaved(false); }} placeholder={en ? 'Something you noticed, enjoyed, or want to remember…' : '오늘 고마웠던 일, 함께 웃었던 일, 기억하고 싶은 순간…'} className="mt-3 w-full resize-y rounded-xl border border-white/15 bg-black/20 p-3 text-sm leading-6 placeholder:text-white/35 focus:outline-2 focus:outline-[#c7dfbd]" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-xs text-white/65">{en ? 'Date' : '날짜'}<input type="date" value={noteDate || growth.today} max={growth.today} onChange={e => setNoteDate(e.target.value)} required className="min-h-11 min-w-0 rounded-lg border border-white/15 bg-[#172018] px-2 [color-scheme:dark]" /></label><span className="text-xs text-white/40">{body.length}/500</span><button type="submit" disabled={saving || !authId || !body.trim()} className={`${action} bg-[#c7dfbd] text-[#19271b] hover:bg-[#d5e5ce]`}>{saving ? <LoaderCircle className="animate-spin" size={16} /> : <Heart size={16} />}{en ? 'Save memory' : '기억 남기기'}</button></div>
          {saved && <p role="status" className="mt-3 flex items-center gap-2 text-sm text-[#c7dfbd]"><Check size={16} />{en ? 'Saved for your family.' : '가족 앨범에 저장했어요.'}</p>}
        </form>
        {notesError && <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 text-sm text-amber-100">{notesError}<button className={action} onClick={() => setRevision(n => n + 1)}>{en ? 'Retry' : '다시 불러오기'}</button></div>}
        <div className="grid gap-4 sm:grid-cols-2">
          {[...growth.familyMoments.map(m => ({ kind: 'activity' as const, day: m.day, id: m.id, activity: m, memory: null })), ...memories.filter(m => m.family_id === familyId).map(m => ({ kind: 'memory' as const, day: m.memory_date, id: m.id, activity: null, memory: m }))].sort((a, b) => b.day.localeCompare(a.day) || a.id.localeCompare(b.id)).slice(0, momentLimit).map(item => <article key={item.id} className={`${panel} p-6`}>
            <div className="mb-4 flex items-center gap-2 text-xs text-[#d9c4a4]">{item.kind === 'activity' ? <BookHeart size={16} /> : <Heart size={16} />}{dateLabel(item.day)}<span className="ml-auto text-white/40">{item.kind === 'activity' ? (en ? 'Shared record' : '가족 활동') : (en ? 'Our words' : '우리의 한 줄')}</span></div>
            {item.activity && <><h3 className="text-lg font-semibold">{item.activity.title}</h3><p className="mt-3 text-sm leading-7 text-white/65">{members.filter(m => item.activity?.memberIds.has(m.id)).map(m => m.name).join(' · ')}</p><p className="mt-3 text-xs leading-6 text-white/45">{en ? 'Recorded this family activity on the same day.' : '같은 날 이 가족 활동을 완료한 기록이에요.'}</p></>}
            {item.memory && <><p className="whitespace-pre-wrap break-words text-base leading-8">{item.memory.body}</p>{item.memory.author_id === authId && <div className="mt-4">{confirmDelete === item.id ? <div className="flex flex-wrap items-center gap-3"><span className="text-xs text-white/60">{en ? 'Delete this memory?' : '이 메모를 삭제할까요?'}</span><button className={action} disabled={deleting === item.id} onClick={() => void removeMemory(item.id)}>{en ? 'Delete' : '삭제'}</button><button className={action} onClick={() => setConfirmDelete(null)}>{en ? 'Keep' : '취소'}</button></div> : <button className="inline-flex min-h-11 items-center gap-2 text-xs text-white/45 hover:text-white" onClick={() => setConfirmDelete(item.id)}><Trash2 size={13} />{en ? 'Delete my memory' : '내 메모 삭제'}</button>}</div>}</>}
          </article>)}
        </div>
        {!growth.familyMoments.length && !memories.length && <div className={`${panel} p-8 text-center`}><BookHeart className="mx-auto mb-3 text-[#b7cbb0]" size={28} /><p className="text-sm leading-7 text-white/60">{en ? 'Leave your first memory above. Shared family activities will also appear here when two or more members record them on the same day.' : '위에서 첫 메모를 남겨보세요. 두 명 이상이 같은 날 완료한 가족 활동도 이곳에 차곡차곡 모여요.'}</p></div>}
        {growth.familyMoments.length + memories.length > momentLimit && <button className={`${action} mt-5`} onClick={() => setMomentLimit(n => n + 12)}>{en ? 'Earlier pages' : '이전 페이지 더 보기'}<ChevronDown size={15} /></button>}
      </section>}
      <footer className="mt-10 border-t border-white/10 pt-5">
        <p className="text-xs leading-6 text-white/40">{growth.firstDay ? (en ? `Available records from ${dateLabel(growth.firstDay)}. ` : `${dateLabel(growth.firstDay)}부터 남아 있는 기록 기준. `) : ''}{en ? 'Full completions only; undone and partial completions are not counted. Habit names reflect their current names. ' : '완료 취소·부분 완료는 제외하며, 습관 이름은 현재 이름으로 표시해요. '}{timezone}</p>
        <details className="mt-4" onToggle={e => { if (e.currentTarget.open) void loadArchive(); }}><summary className="min-h-11 cursor-pointer py-3 text-xs text-white/50">{en ? 'Previous shield collection · archive' : '이전 쉴드 기록 보관함'}</summary><div className={`${panel} mt-2 p-5`}><p className="mb-4 text-xs leading-6 text-white/55">{en ? 'Previously earned shields and equipped benefits are preserved. This album has no equipment or extra currency.' : '기존에 얻은 쉴드와 장착 혜택은 보존했어요. 새 앨범에는 장착이나 별도 화폐가 없어요.'}</p>{archiveError ? <button className={action} onClick={() => void loadArchive()}>{en ? 'Could not load. Retry' : '불러오지 못했어요. 다시 시도'}</button> : archive === null ? <p className="text-sm text-white/50">{en ? 'Loading…' : '불러오는 중…'}</p> : members.map(m => { const state = archive.find(s => s.user_id === m.id); const entries = Object.entries(state?.unlocked_at_by_achievement_id ?? {}); return <details key={m.id} className="border-t border-white/10 py-2"><summary className="cursor-pointer py-2 text-sm">{m.name} · {entries.length}{en ? ' collected' : '개 기록'}</summary><ul className="mt-2 grid gap-2 text-xs text-white/60 sm:grid-cols-2">{entries.map(([id, at]) => <li key={id}>{ACHIEVEMENTS.find(a => a.achievementId === id)?.title ?? id} · {Number.isFinite(Date.parse(at)) ? dateLabel(at.slice(0, 10)) : '—'}{state?.equipped_insignia_ids?.includes(id) ? (en ? ' · preserved benefit' : ' · 기존 혜택 유지') : ''}</li>)}</ul></details>; })}</div></details>
      </footer>
    </div>
  </div>;
}
