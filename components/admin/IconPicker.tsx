import type { ComponentType } from 'react';
import * as Icons from 'lucide-react';
import { CrossIcon, ToothbrushIcon, CUSTOM_ICON_MAP } from '@/components/CustomIcons';
import { useLanguage } from '@/contexts/LanguageContext';

function pascalCase(kebab: string): string {
  return kebab.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

const IconMap = Icons as unknown as Record<string, ComponentType<{ size?: number; className?: string }>>;

export function LucideIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Custom = CUSTOM_ICON_MAP[name];
  if (Custom) return <Custom size={size} className={className} />;
  const Comp = IconMap[pascalCase(name)] ?? Icons.Circle;
  return <Comp size={size} className={className} />;
}

const ICON_GROUPS: { labelKey: string; labelKo: string; icons: { key: string; label: string }[] }[] = [
  {
    labelKey: 'icon_group_store',
    labelKo: '상점/보상',
    icons: [
      { key: 'gift',              label: '선물' },
      { key: 'party-popper',      label: '파티' },
      { key: 'badge-percent',     label: '할인' },
      { key: 'tags',              label: '태그' },
      { key: 'ticket-percent',    label: '쿠폰' },
      { key: 'ticket',            label: '티켓' },
      { key: 'shopping-bag',      label: '쇼핑백' },
      { key: 'shopping-cart',     label: '카트' },
      { key: 'store',             label: '상점' },
      { key: 'wallet',            label: '지갑' },
      { key: 'coins',             label: '코인' },
      { key: 'gem',               label: '보석' },
      { key: 'crown',             label: '왕관' },
      { key: 'medal',             label: '메달' },
      { key: 'award',             label: '상장' },
      { key: 'ribbon',            label: '리본' },
      { key: 'sparkles',          label: '반짝' },
      { key: 'wand-sparkles',     label: '마법' },
      { key: 'ice-cream',         label: '아이스크림' },
      { key: 'cake-slice',        label: '케이크' },
      { key: 'cookie',            label: '쿠키' },
      { key: 'candy',             label: '사탕' },
      { key: 'popcorn',           label: '팝콘' },
      { key: 'pizza',             label: '피자' },
      { key: 'sandwich',          label: '간식' },
      { key: 'cup-soda',          label: '음료' },
      { key: 'milk',              label: '우유' },
      { key: 'utensils',          label: '외식' },
      { key: 'gamepad-2',         label: '게임' },
      { key: 'joystick',          label: '조이스틱' },
      { key: 'tv',                label: 'TV' },
      { key: 'film',              label: '영화' },
      { key: 'clapperboard',      label: '극장' },
      { key: 'headphones',        label: '음악' },
      { key: 'music',             label: '노래' },
      { key: 'book-open',         label: '책' },
      { key: 'paintbrush',        label: '미술' },
      { key: 'palette',           label: '팔레트' },
      { key: 'puzzle',            label: '퍼즐' },
      { key: 'blocks',            label: '블록' },
      { key: 'car',               label: '드라이브' },
      { key: 'bike',              label: '자전거' },
      { key: 'plane',             label: '여행' },
      { key: 'map',               label: '나들이' },
      { key: 'tent',              label: '캠핑' },
      { key: 'trees',             label: '공원' },
      { key: 'camera',            label: '사진' },
      { key: 'shirt',             label: '옷' },
      { key: 'heart-handshake',   label: '약속' },
      { key: 'smile-plus',        label: '기쁨' },
    ],
  },
  {
    labelKey: 'icon_group_hygiene',
    labelKo: '생활/위생',
    icons: [
      { key: 'sparkles',        label: '양치' },
      { key: 'droplets',        label: '씻기' },
      { key: 'waves',           label: '샤워' },
      { key: 'moon',            label: '수면' },
      { key: 'sun',             label: '아침' },
      { key: 'coffee',          label: '아침식사' },
      { key: 'bed',             label: '침대정리' },
      { key: 'bath',            label: '목욕' },
      { key: 'washing-machine', label: '빨래' },
      { key: 'spray-can',       label: '청소' },
    ],
  },
  {
    labelKey: 'icon_group_health',
    labelKo: '건강',
    icons: [
      { key: 'pill',            label: '영양제' },
      { key: 'dumbbell',        label: '운동' },
      { key: 'heart',           label: '건강' },
      { key: 'apple',           label: '식단' },
      { key: 'bike',            label: '자전거' },
      { key: 'person-standing', label: '스트레칭' },
      { key: 'footprints',      label: '산책' },
      { key: 'salad',           label: '채소' },
      { key: 'glass-water',     label: '물마시기' },
      { key: 'shield-check',    label: '안전' },
    ],
  },
  {
    labelKey: 'icon_group_study',
    labelKo: '학습',
    icons: [
      { key: 'book-open',       label: '독서' },
      { key: 'pen-line',        label: '일기' },
      { key: 'graduation-cap',  label: '공부' },
      { key: 'globe',           label: '영어' },
      { key: 'calculator',      label: '수학' },
      { key: 'microscope',      label: '과학' },
      { key: 'languages',       label: '언어' },
      { key: 'palette',         label: '미술' },
      { key: 'notebook-pen',    label: '숙제' },
      { key: 'brain',           label: '암기' },
    ],
  },
  {
    labelKey: 'icon_group_chores',
    labelKo: '가정',
    icons: [
      { key: 'house',           label: '집안일' },
      { key: 'shirt',           label: '옷정리' },
      { key: 'utensils-crossed',label: '설거지' },
      { key: 'trash-2',         label: '쓰레기' },
      { key: 'package',         label: '정리' },
      { key: 'blocks',          label: '장난감' },
      { key: 'leaf',            label: '식물' },
      { key: 'shopping-basket', label: '장보기' },
      { key: 'chef-hat',        label: '요리' },
      { key: 'hand-heart',      label: '도움' },
    ],
  },
  {
    labelKey: 'icon_group_other',
    labelKo: '기타',
    icons: [
      { key: 'cross',           label: '기도' },
      { key: 'music',           label: '음악' },
      { key: 'gamepad-2',       label: '게임' },
      { key: 'star',            label: '특별' },
      { key: 'trophy',          label: '성취' },
      { key: 'zap',             label: '에너지' },
      { key: 'smile',           label: '친절' },
      { key: 'message-circle',  label: '대화' },
      { key: 'timer',           label: '집중' },
      { key: 'calendar-check',  label: '계획' },
    ],
  },
];

export function IconPicker({
  currentIcon,
  onSelect,
  onClose,
}: {
  currentIcon: string;
  onSelect: (icon: string) => void;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#141821] rounded-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232831] shrink-0">
          <span className="font-semibold text-white text-base">{t('icon_select')}</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#232831] text-[#8a8f99] flex items-center justify-center hover:bg-[#2d3545] hover:text-white transition-colors"
          >
            <Icons.X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto p-4 space-y-5">
          {ICON_GROUPS.map(group => (
            <div key={group.labelKo}>
              <p className="text-xs font-semibold text-[#8a8f99] mb-2 uppercase tracking-wide">
                {t(group.labelKey as Parameters<typeof t>[0])}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {group.icons.map(({ key, label }) => {
                  const selected = key === currentIcon;
                  return (
                    <button
                      key={`${group.labelKo}-${key}`}
                      onClick={() => onSelect(key)}
                      className={`flex flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                        selected
                          ? 'bg-[#4f9cff] text-[#06111f]'
                          : 'bg-[#232831] text-[#8a8f99] hover:bg-[#2d3545] hover:text-white'
                      }`}
                      style={{ minHeight: 48 }}
                      title={label}
                    >
                      {key === 'sparkles'
                        ? <ToothbrushIcon size={20} />
                        : key === 'cross'
                          ? <CrossIcon size={20} />
                          : <LucideIcon name={key} size={20} />}
                      <span className="text-[10px] leading-none">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
