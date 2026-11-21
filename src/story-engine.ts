export type StoryState = {
  version: 1;
  timeRemaining: number;
  trust: Record<string, number>;
  flags: string[];
  openLoops: string[];
  resolvedLoops: string[];
  history: string[];
};

export type StateEffect = {
  time?: number;
  trust?: Record<string, number>;
  addFlags?: string[];
  removeFlags?: string[];
  openLoops?: string[];
  resolveLoops?: string[];
};

export type StateCondition = {
  minTimeRemaining?: number;
  maxTimeRemaining?: number;
  minTrust?: Record<string, number>;
  maxTrust?: Record<string, number>;
  requiresResolvedLoops?: string[];
  requiresOpenLoops?: string[];
};

export type ChoiceLike = {
  requires?: string[];
  excludes?: string[];
  conditions?: StateCondition;
  effects?: StateEffect;
};

export const createStoryState = (timeLimit = 90): StoryState => ({
  version: 1,
  timeRemaining: Math.max(0, Math.floor(timeLimit)),
  trust: {},
  flags: [],
  openLoops: [],
  resolvedLoops: [],
  history: [],
});

const unique = (items: string[]) => [...new Set(items.filter(Boolean))];

export function applyEffects(state: StoryState, effect: StateEffect = {}, eventId?: string): StoryState {
  const trust = { ...state.trust };
  for (const [person, delta] of Object.entries(effect.trust || {})) {
    if (!person || !Number.isFinite(delta)) continue;
    trust[person] = Math.max(-3, Math.min(3, (trust[person] || 0) + delta));
  }
  const resolved = unique([...state.resolvedLoops, ...(effect.resolveLoops || [])]);
  const resolvedSet = new Set(resolved);
  const openLoops = unique([...state.openLoops, ...(effect.openLoops || [])]).filter(x => !resolvedSet.has(x));
  const next: StoryState = {
    version: 1,
    timeRemaining: Math.max(0, Math.min(1440, state.timeRemaining + (Number.isFinite(effect.time) ? Math.trunc(effect.time!) : 0))),
    trust,
    flags: unique([...state.flags.filter(x => !(effect.removeFlags || []).includes(x)), ...(effect.addFlags || [])]),
    openLoops,
    resolvedLoops: resolved,
    history: eventId ? [...state.history, eventId].slice(-100) : state.history,
  };
  return next;
}

export function availableByState<T extends ChoiceLike>(choices: T[], state: StoryState): T[] {
  const flags = new Set(state.flags);
  return choices.filter(choice => {
    if (choice.requires && !choice.requires.every(flag => flags.has(flag))) return false;
    if (choice.excludes && choice.excludes.some(flag => flags.has(flag))) return false;
    const condition = choice.conditions;
    if (!condition) return true;
    if (condition.minTimeRemaining !== undefined && state.timeRemaining < condition.minTimeRemaining) return false;
    if (condition.maxTimeRemaining !== undefined && state.timeRemaining > condition.maxTimeRemaining) return false;
    if (condition.minTrust && Object.entries(condition.minTrust).some(([person, value]) => (state.trust[person] || 0) < value)) return false;
    if (condition.maxTrust && Object.entries(condition.maxTrust).some(([person, value]) => (state.trust[person] || 0) > value)) return false;
    if (condition.requiresResolvedLoops && !condition.requiresResolvedLoops.every(key => state.resolvedLoops.includes(key))) return false;
    if (condition.requiresOpenLoops && !condition.requiresOpenLoops.every(key => state.openLoops.includes(key))) return false;
    return true;
  });
}

export function stateSummary(state: StoryState, loopTitles: Record<string, string> = {}): string {
  const trustCount = Object.keys(state.trust).length;
  const labels: Record<string, string> = { hala: "هالة", samih: "سامح", salma: "سلمى" };
  const trustLine = trustCount
    ? Object.entries(state.trust).map(([name, value]) => `${labels[name] || name}: ${value > 0 ? "+" : ""}${value}`).join("، ")
    : "لم تتشكل علاقات كافية بعد";
  const openLine = state.openLoops.length
    ? state.openLoops.map(key => loopTitles[key] || key).join("، ")
    : "لا توجد أسئلة معلّقة";
  return `⏳ الوقت المتبقي: ${state.timeRemaining} دقيقة\n🤝 الثقة: ${trustLine}\n❓ أسئلة مفتوحة (${state.openLoops.length}): ${openLine}`;
}

export type ReviewClue = { id: string; title: string };

export function buildStoryReview(
  state: StoryState,
  allClues: ReviewClue[],
  collectedClueIds: string[],
  loopTitles: Record<string, string> = {},
): string {
  const collected = new Set(collectedClueIds);
  const uniqueClues = [...new Map(allClues.filter(x => x.id && x.title).map(x => [x.id, x])).values()];
  const missed = uniqueClues.filter(clue => !collected.has(clue.id));
  const missedLine = missed.length
    ? missed.slice(0, 10).map(clue => clue.title).join("، ") + (missed.length > 10 ? `، و${missed.length - 10} أدلة أخرى` : "")
    : "لم تترك أي دليل معروف دون جمعه.";
  const resolvedLine = state.resolvedLoops.length
    ? state.resolvedLoops.map(key => loopTitles[key] || key).join("، ")
    : "لم يُحسم سؤال رئيسي مسجل.";
  const openLine = state.openLoops.length
    ? state.openLoops.map(key => loopTitles[key] || key).join("، ")
    : "لا توجد أسئلة معلّقة.";
  return `الأدلة التي لم تجمعها: ${missedLine}\nالأسئلة التي حسمتها: ${resolvedLine}\nالأسئلة التي بقيت مفتوحة: ${openLine}\nالوقت المتبقي عند النهاية: ${state.timeRemaining} دقيقة`;
}
