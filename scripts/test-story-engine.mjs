import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";

const source = readFileSync("src/story-engine.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleBox = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleBox.exports, module: moduleBox });

const { createStoryState, applyEffects, availableByState, stateSummary, buildStoryReview } = moduleBox.exports;
let state = createStoryState(60);
state = applyEffects(state, {
  time: -12,
  trust: { salma: 1, samih: -1 },
  addFlags: ["found-map", "heard-warning"],
  openLoops: ["who-called", "red-light"],
}, "choice:inspect");
assert.equal(state.timeRemaining, 48);
assert.equal(state.trust.salma, 1);
assert.equal(state.trust.samih, -1);
assert.deepEqual(Array.from(state.flags).sort(), ["found-map", "heard-warning"]);
assert.deepEqual(Array.from(state.openLoops).sort(), ["red-light", "who-called"]);

state = applyEffects(state, {
  time: -999,
  trust: { salma: 9 },
  removeFlags: ["heard-warning"],
  resolveLoops: ["who-called"],
  openLoops: ["new-question"],
}, "scene:reveal");
assert.equal(state.timeRemaining, 0);
assert.equal(state.trust.salma, 3);
assert.deepEqual(Array.from(state.flags), ["found-map"]);
assert.deepEqual(Array.from(state.openLoops).sort(), ["new-question", "red-light"]);
assert.ok(state.resolvedLoops.includes("who-called"));

const options = [
  { text: "show map", requires: ["found-map"] },
  { text: "use warning", requires: ["heard-warning"] },
  { text: "avoid tunnel", excludes: ["tunnel-collapsed"] },
];
assert.deepEqual(availableByState(options, state).map(x => x.text), ["show map", "avoid tunnel"]);
const conditionalOptions = [
  { text: "earned ending", conditions: { minTimeRemaining: 10, minTrust: { salma: 2 }, requiresResolvedLoops: ["who-called"] } },
  { text: "missed clue ending", requires: ["hidden-note"] },
  { text: "fallback ending" },
  { text: "wrong trust ending", conditions: { minTrust: { samih: 0 } } },
  { text: "wrong loop ending", conditions: { requiresResolvedLoops: ["red-light"] } },
];
assert.deepEqual(
  availableByState(conditionalOptions, state).map(x => x.text),
  ["fallback ending"],
);
const strongState = applyEffects(createStoryState(30), {
  time: -5,
  trust: { hala: 2 },
  resolveLoops: ["passenger-memories"],
  addFlags: ["mechanical-check"],
});
assert.deepEqual(
  availableByState([
    { text: "full truth", requires: ["mechanical-check"], conditions: { minTimeRemaining: 20, minTrust: { hala: 1 }, requiresResolvedLoops: ["passenger-memories"] } },
    { text: "fallback" },
  ], strongState).map(x => x.text),
  ["full truth", "fallback"],
);

assert.match(stateSummary(state), /الوقت المتبقي: 0/);
assert.match(stateSummary(state, { "new-question": "هل وصل النداء؟", "red-light": "من أضاء المصباح؟" }), /هل وصل النداء؟/);
assert.match(stateSummary(state, { "new-question": "هل وصل النداء؟" }), /أسئلة مفتوحة \(2\)/);
assert.equal(state.history.length, 2);
const review = buildStoryReview(
  state,
  [{ id: "found-map", title: "خريطة الطريق" }, { id: "hidden-note", title: "الرسالة المخفية" }],
  ["found-map"],
  { "new-question": "هل وصل النداء؟", "red-light": "من أضاء المصباح؟", "who-called": "من اتصل؟" },
);
assert.match(review, /الرسالة المخفية/);
assert.doesNotMatch(review, /خريطة الطريق/);
assert.match(review, /من أضاء المصباح؟/);
assert.match(review, /هل وصل النداء؟/);

console.log("Story engine tests passed: time, trust, flags, open loops, and conditional choices.");
