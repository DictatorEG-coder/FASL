import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync("src/stories.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleBox = { exports: {} };
vm.runInNewContext(compiled, { exports: moduleBox.exports, module: moduleBox });

const stories = moduleBox.exports.STORIES;
if (!Array.isArray(stories) || stories.length === 0) {
  throw new Error("Story library is empty or could not be loaded.");
}

const errors = [];
const storyIds = new Set();

for (const story of stories) {
  if (storyIds.has(story.id)) errors.push(`Duplicate story id: ${story.id}`);
  storyIds.add(story.id);

  const scenes = story.scenes || {};
  if (!scenes[story.start]) {
    errors.push(`${story.id}: start scene "${story.start}" does not exist`);
    continue;
  }

  const reachable = new Set();
  const queue = [story.start];
  while (queue.length) {
    const sceneId = queue.shift();
    if (reachable.has(sceneId)) continue;
    reachable.add(sceneId);
    const scene = scenes[sceneId];
    if (!scene) {
      errors.push(`${story.id}: missing scene "${sceneId}"`);
      continue;
    }
    if (!scene.ending && (!Array.isArray(scene.choices) || scene.choices.length === 0)) {
      errors.push(`${story.id}: non-ending scene "${sceneId}" has no choices`);
    }
    const choiceTexts = new Set();
    for (const choice of scene.choices || []) {
      if (!choice.text?.trim()) errors.push(`${story.id}/${sceneId}: empty choice text`);
      if (choiceTexts.has(choice.text)) errors.push(`${story.id}/${sceneId}: duplicate choice text "${choice.text}"`);
      choiceTexts.add(choice.text);
      if (!scenes[choice.next]) {
        errors.push(`${story.id}/${sceneId}: choice points to missing scene "${choice.next}"`);
      } else {
        queue.push(choice.next);
      }
      if (choice.image && !/^https:\/\//.test(choice.image)) {
        errors.push(`${story.id}/${sceneId}: image must use HTTPS`);
      }
      for (const flag of [...(choice.requires || []), ...(choice.excludes || [])]) {
        if (typeof flag !== "string" || !flag.trim()) errors.push(`${story.id}/${sceneId}: invalid choice condition`);
      }
    }
  }

  const endings = [...reachable].filter(id => scenes[id]?.ending);
  if (endings.length === 0) errors.push(`${story.id}: no reachable ending`);
  for (const sceneId of Object.keys(scenes)) {
    if (!reachable.has(sceneId)) errors.push(`${story.id}: unreachable scene "${sceneId}"`);
  }
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${stories.length} stories and all reachable scene links.`);
}
