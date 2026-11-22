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
assert.equal(TESTS.length, 5, "Expected thinking, personality, career, aptitude, and workplace tests");
const axes = ["analysis", "creation", "action", "people", "strategy", "exploration", "organization"];
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
}
assert.ok(careerDepartments("analysis", "people").length >= 3, "Career test should recommend several departments");
console.log("Assessment validation passed: " + TESTS.length + " tests.");
