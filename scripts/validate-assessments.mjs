import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import assert from "node:assert/strict";

const source = readFileSync("src/tests.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleBox = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleBox.exports, module: moduleBox });

const { TESTS, scoreTest, careerDepartments } = moduleBox.exports;
assert.equal(TESTS.length, 6, "Expected five existing assessments plus the IPIP Big Five inventory");
const axes = ["analysis", "creation", "action", "people", "strategy", "exploration", "organization", "extraversion", "agreeableness", "conscientiousness", "emotionalStability", "openness"];
for (const test of TESTS) {
  assert.ok(test.title && test.description, test.id + ": missing metadata");
  assert.ok(test.questions.length >= 8, test.id + ": needs at least 8 questions");
  for (const [index, question] of test.questions.entries()) {
    assert.ok(question.prompt, test.id + ": question " + index + " has no prompt");
    assert.ok(question.options.length >= 3, test.id + ": question " + index + " needs at least 3 options");
    for (const option of question.options) {
      assert.ok(option.text, test.id + ": empty option");
      if (question.correctIndex !== undefined) assert.ok(Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.options.length, test.id + ": invalid correct answer index");
      for (const [axis, value] of Object.entries(option.scores)) {
        assert.ok(axes.includes(axis), test.id + ": unknown score axis " + axis);
        assert.ok(Number.isFinite(value) && value > 0, test.id + ": invalid score weight");
      }
    }
  }
  const sample = test.questions.map(() => 0);
  const result = scoreTest(test, sample);
  assert.ok(axes.includes(result.primary) && axes.includes(result.secondary), test.id + ": invalid result axes");
  if (test.kind === "aptitude") assert.ok(Number.isInteger(result.correctCount) && result.accuracy >= 0 && result.accuracy <= 100, "Aptitude scoring must return a valid accuracy");
  if (test.kind === "big-five") {
    assert.equal(test.questions.length, 50, "IPIP Big Five must contain 50 items");
    const expected = ["extraversion", "agreeableness", "conscientiousness", "emotionalStability", "openness"];
    for (const axis of expected) assert.equal(test.questions.filter(q => q.factor === axis).length, 10, "Expected 10 IPIP items for " + axis);
    assert.ok(test.questions.every(q => q.options.length === 5 && q.options.every((o, i) => o.scores[q.factor] === i + 1)), "IPIP responses must use a five-point Likert scale");
    assert.ok(test.questions.some(q => q.reverse), "IPIP inventory must include reverse-keyed items");
    for (const axis of expected) assert.ok(result.scores[axis] >= 10 && result.scores[axis] <= 50, "Reverse scoring out of range for " + axis);
    assert.ok(test.sourceNote && test.sourceNote.includes("Goldberg"), "IPIP source and translation caveat must be documented");
    const lowest = scoreTest(test, Array(50).fill(0));
    const highest = scoreTest(test, Array(50).fill(4));
    const expectedLowest = { extraversion:30, agreeableness:26, conscientiousness:26, emotionalStability:42, openness:22 };
    const expectedHighest = { extraversion:30, agreeableness:34, conscientiousness:34, emotionalStability:18, openness:38 };
    for (const axis of expected) {
      assert.equal(lowest.scores[axis], expectedLowest[axis], "Incorrect reverse-keyed low-end score for " + axis);
      assert.equal(highest.scores[axis], expectedHighest[axis], "Incorrect reverse-keyed high-end score for " + axis);
    }
  }
}
assert.ok(careerDepartments("analysis", "people").length >= 3, "Career test should recommend several departments");
console.log("Assessment validation passed: " + TESTS.length + " tests.");
