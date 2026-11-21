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

export type ChoiceLike = {
  requires?: string[];
  excludes?: string[];
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
  return choices.filter(choice =>
    (!choice.requires || choice.requires.every(flag => flags.has(flag))) &&
    (!choice.excludes || choice.excludes.every(flag => !flags.has(flag)))
  );
}

export function stateSummary(state: StoryState): string {
  const trustCount = Object.keys(state.trust).length;
  const labels: Record<string, string> = { hala: "هالة", samih: "سامح", salma: "سلمى" };
  const trustLine = trustCount
    ? Object.entries(state.trust).map(([name, value]) => `${labels[name] || name}: ${value > 0 ? "+" : ""}${value}`).join("، ")
    : "لم تتشكل علاقات كافية بعد";
  return `⏳ الوقت المتبقي: ${state.timeRemaining} دقيقة\n🤝 الثقة: ${trustLine}\n❓ أسئلة مفتوحة: ${state.openLoops.length}`;
}
