'use client';

import { useState } from 'react';
import { BookHeart, CalendarCheck2, ChevronDown, Flag, HeartHandshake, Medal, Sparkles, Sprout, Trophy, Users, Zap } from 'lucide-react';
import type { JourneyEvent } from '@/lib/analytics/insights';
import type { LegacyEvent } from '@/lib/analytics/family';
import type { FamilyMemory } from '@/lib/analytics/useFamilyAnalytics';
import { EmptyNote, Segmented, formatDay, useCopy } from '@/components/analytics/ui';
import { FamilyMemoryForm, MemoryCard } from './FamilyMemories';

export interface TeamShieldEvent {
  id: string;
  day: string;
  title: string;
  names: string[];
}

type Scope = 'me' | 'family' | 'all';

interface Item {
  key: string;
  day: string;
  scope: 'me' | 'family';
  Icon: typeof Flag;
  title: string;
  detail: string;
  memory: FamilyMemory | null;
}

const PERSONAL_ICON: Record<JourneyEvent['kind'], typeof Flag> = {
  first: Flag, 'full-week': CalendarCheck2, 'best-week': Trophy, comeback: Sprout, milestone: Zap, shield: Medal,
};
const FAMILY_ICON: Record<LegacyEvent['kind'], typeof Flag> = {
  'first-together': HeartHandshake, 'together-days': Users, 'family-total': Sparkles, 'family-comeback': Sprout, mission: Flag, 'team-shield': Medal,
};

/** Personal journey, family legacy, team shields, and family memories in one
 *  record-backed timeline. */
export function GrowthTimeline(props: {
  memberName: string;
  personal: JourneyEvent[];
  family: LegacyEvent[];
  teamShields: TeamShieldEvent[];
  memories: FamilyMemory[];
  memoriesError: boolean;
  familyId: string | null;
  today: string;
  authId: string;
  onChanged: () => void;
}) {
  const { en, t } = useCopy();
  const [scope, setScope] = useState<Scope>('all');
  const [limit, setLimit] = useState(10);
  const items: Item[] = [
    ...props.personal.map(e => ({ key: `p-${e.id}`, day: e.day, scope: 'me' as const, Icon: PERSONAL_ICON[e.kind], title: t(e.text), detail: e.detail ? t(e.detail) : '', memory: null })),
    ...props.family.map(e => ({ key: `f-${e.id}`, day: e.day, scope: 'family' as const, Icon: FAMILY_ICON[e.kind], title: t(e.text), detail: e.detail ? t(e.detail) : '', memory: null })),
    ...props.teamShields.map(s => ({ key: `t-${s.id}`, day: s.day, scope: 'family' as const, Icon: Medal, title: en ? `Team shield: ${s.title}` : `팀 쉴드: ${s.title}`, detail: s.names.join(' · '), memory: null })),
    ...props.memories.map(m => ({ key: `m-${m.id}`, day: m.memory_date, scope: 'family' as const, Icon: BookHeart, title: '', detail: '', memory: m })),
  ]
    .filter(item => scope === 'all' || item.scope === scope)
    .sort((a, b) => b.day.localeCompare(a.day) || a.key.localeCompare(b.key));

  return (
    <div className="space-y-4">
      <Segmented
        size="sm"
        label={en ? 'Whose moments' : '누구의 순간'}
        value={scope}
        onChange={value => { setScope(value); setLimit(10); }}
        options={[{ value: 'all', label: en ? 'Everything' : '모두' }, { value: 'me', label: props.memberName }, { value: 'family', label: en ? 'Family' : '가족' }]}
      />
      {scope !== 'me' && props.familyId && <FamilyMemoryForm familyId={props.familyId} today={props.today} onSaved={props.onChanged} />}
      {props.memoriesError && scope !== 'me' && <p className="text-xs text-[#F3E3BC]">{en ? 'Family memories could not be loaded.' : '가족의 한 줄을 불러오지 못했어요.'}</p>}
      {items.length === 0 ? (
        <EmptyNote>{scope === 'me'
          ? (en ? 'This story starts with the first completed habit.' : '첫 습관을 완료하는 순간부터 이야기가 시작돼요.')
          : (en ? 'The family story begins with the first day everyone shows up.' : '모두가 함께하는 첫날부터 가족의 이야기가 시작돼요.')}</EmptyNote>
      ) : (
        <ol className="relative space-y-4 border-l border-white/10 pl-6">
          {items.slice(0, limit).map(item => (
            <li key={item.key} className="relative">
              <span className={`absolute -left-[37px] grid h-7 w-7 place-items-center rounded-full border border-white/10 ${item.memory ? 'bg-[#2a2440] text-[#F2A7C3]' : item.scope === 'family' ? 'bg-[#1d2340] text-[#E8C77B]' : 'bg-[#1d2340] text-[#A5A6FF]'}`} aria-hidden><item.Icon size={14} /></span>
              <p className="text-xs text-[#8E94B4]">
                <time dateTime={item.day}>{formatDay(item.day, en, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
                {scope === 'all' && <span> · {item.scope === 'me' ? props.memberName : (en ? 'Family' : '가족')}</span>}
              </p>
              {item.memory ? <MemoryCard memory={item.memory} mine={item.memory.author_id === props.authId} onDeleted={props.onChanged} /> : (
                <>
                  <p className="text-sm font-semibold text-[#F4F5FA]">{item.title}</p>
                  {item.detail && <p className="text-xs text-[#A9AECB]">{item.detail}</p>}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {items.length > limit && (
        <button type="button" onClick={() => setLimit(n => n + 10)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[#A5A6FF] hover:bg-white/[0.05]">
          {en ? 'Earlier moments' : '이전 순간 더 보기'}<ChevronDown size={15} aria-hidden />
        </button>
      )}
      <p className="text-xs text-[#7F86A8]">{en ? 'Only moments backed by records appear here.' : '기록으로 확인되는 순간만 보여드려요.'}</p>
    </div>
  );
}
