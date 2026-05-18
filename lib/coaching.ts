export type CoachingLang = 'en' | 'ko';

export interface CoachingInput {
  userName: string;
  focusTaskTitle: string | null;
  focusTaskPct: number | null;
  worstDayLabel: string | null;
  worstDayPct: number | null;
  deltaPct: number | null;
  todayDone: number;
  todayPossible: number;
  activeDays30: number;
  lang: CoachingLang;
}

export interface CoachingInsight {
  title: string;
  body: string;
}

export function buildCoachingInsight(input: CoachingInput): CoachingInsight {
  const en = input.lang === 'en';

  if (input.todayPossible === 0) {
    return {
      title: en ? 'Start with one anchor habit' : '기준이 될 습관 하나부터',
      body: en
        ? `Give ${input.userName} one tiny habit for today so the rhythm has somewhere to begin.`
        : `${input.userName}에게 오늘 시작할 아주 작은 습관 하나를 만들어 리듬의 출발점을 주세요.`,
    };
  }

  if (input.activeDays30 < 4) {
    return {
      title: en ? 'Lower the activation energy' : '시작 장벽을 더 낮춰보세요',
      body: en
        ? `${input.userName} has only a few active days this month. One habit that takes under two minutes is the fastest way to create traction.`
        : `${input.userName}의 이번 달 활동일이 아직 적습니다. 2분 안에 끝나는 습관 하나가 가장 빠른 추진력을 만듭니다.`,
    };
  }

  if (
    input.focusTaskTitle &&
    input.worstDayLabel &&
    input.worstDayPct !== null &&
    input.worstDayPct < 70
  ) {
    return {
      title: en ? 'Protect the weak spot' : '약한 지점을 먼저 지켜주세요',
      body: en
        ? `${input.worstDayLabel} is the softest day right now. Make “${input.focusTaskTitle}” easier to finish there before adding more habits.`
        : `지금 가장 약한 요일은 ${input.worstDayLabel}입니다. 습관을 더 늘리기보다 그날의 “${input.focusTaskTitle}”을 먼저 더 쉽게 만들어 보세요.`,
    };
  }

  if (input.deltaPct !== null && input.deltaPct < 0) {
    return {
      title: en ? 'Recover before you optimize' : '최적화보다 회복이 먼저예요',
      body: en
        ? `This week slipped ${Math.abs(input.deltaPct)}% from last week. Keep the next target small: one completion today, then rebuild from there.`
        : `이번 주는 지난주보다 ${Math.abs(input.deltaPct)}% 낮습니다. 오늘 한 번 완료하는 작은 목표부터 다시 쌓아가세요.`,
    };
  }

  if (input.focusTaskTitle && input.focusTaskPct !== null && input.focusTaskPct < 70) {
    return {
      title: en ? 'Tighten one habit' : '습관 하나를 더 단단하게',
      body: en
        ? `“${input.focusTaskTitle}” is the clearest lever. Clarify when it happens or shrink the first step until it becomes almost automatic.`
        : `가장 큰 지렛대는 “${input.focusTaskTitle}”입니다. 언제 하는지 더 분명히 하거나 첫 단계를 아주 작게 줄여 거의 자동처럼 만들어 보세요.`,
    };
  }

  return {
    title: en ? 'Keep the flywheel turning' : '좋은 흐름을 계속 이어가세요',
    body: en
      ? `${input.userName} already has a workable rhythm. Protect the current cadence before adding new complexity.`
      : `${input.userName}은 이미 괜찮은 리듬을 만들고 있습니다. 새 복잡도를 더하기 전에 지금의 흐름을 먼저 지켜주세요.`,
  };
}
