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
  if (!story.category) errors.push(`${story.id}: missing story category`);
  if (storyIds.has(story.id)) errors.push(`Duplicate story id: ${story.id}`);
  storyIds.add(story.id);

  const validCategories = new Set(["investigation", "horror_mystery", "mystery", "adventure", "survival", "historical", "science_fiction", "literary"]);
  if (!validCategories.has(story.category)) errors.push(`${story.id}: invalid story category "${story.category}"`);
  const scenes = story.scenes || {};
  const totalScenes = Object.keys(scenes).length;
  const totalChoices = Object.values(scenes).reduce((sum, scene) => sum + (scene.choices || []).length, 0);
  const endingPaths = Object.values(scenes).filter(scene => scene.ending).length + (story.caseFile?.endings?.length || 0) + (story.caseFile?.defaultEnding ? 1 : 0);
  if (totalScenes < 18) errors.push(`${story.id}: story is too short (${totalScenes} scenes; minimum 18)`);
  if (totalChoices < 18) errors.push(`${story.id}: too few meaningful choices (${totalChoices}; minimum 18)`);
  if (endingPaths < 2) errors.push(`${story.id}: needs at least two ending paths`);
  const loopIds = new Set(Object.keys(story.loopTitles || {}));
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
    for (const loopId of [...(scene.opens || []), ...(scene.resolves || [])]) {
      if (!loopIds.has(loopId)) errors.push(`${story.id}/${sceneId}: unknown story loop "${loopId}"`);
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
      const condition = choice.conditions || {};
      for (const [field, value] of [["minTimeRemaining", condition.minTimeRemaining], ["maxTimeRemaining", condition.maxTimeRemaining]]) {
        if (value !== undefined && (!Number.isFinite(value) || value < 0)) errors.push(`${story.id}/${sceneId}: invalid ${field}`);
      }
      for (const memoryId of [...(condition.requiresMemories || []), ...(condition.excludesMemories || [])]) {
        if (!story.memoryEvents || !story.memoryEvents[memoryId]) errors.push(`${story.id}/${sceneId}: condition references unknown memory "${memoryId}"`);
      }
      for (const memory of choice.effects?.remember || []) {
        if (!memory.characterId || !memory.eventId || !memory.impression) errors.push(`${story.id}/${sceneId}: invalid character memory`);
        else if (story.memoryEvents?.[memory.eventId] !== memory.characterId) errors.push(`${story.id}/${sceneId}: memory "${memory.eventId}" has no matching character definition`);
      }
      for (const reaction of scene.memoryReactions || []) {
        for (const memoryId of reaction.requires || []) {
          if (!story.memoryEvents || !story.memoryEvents[memoryId]) errors.push(`${story.id}/${sceneId}: reaction references unknown memory "${memoryId}"`);
        }
      }
      for (const loopId of [...(condition.requiresResolvedLoops || []), ...(condition.requiresOpenLoops || [])]) {
        if (!loopIds.has(loopId)) errors.push(`${story.id}/${sceneId}: condition references unknown loop "${loopId}"`);
      }
      for (const trust of [condition.minTrust || {}, condition.maxTrust || {}]) {
        for (const [person, value] of Object.entries(trust)) {
          if (!person || !Number.isFinite(value) || value < -3 || value > 3) errors.push(`${story.id}/${sceneId}: invalid trust condition`);
        }
      }
    }
  }

  const openedLoops = new Set([...reachable].flatMap(id => scenes[id]?.opens || []));
  const resolvedLoops = new Set([...reachable].flatMap(id => scenes[id]?.resolves || []));
  for (const loopId of openedLoops) {
    if (!resolvedLoops.has(loopId)) errors.push(`${story.id}: opened loop "${loopId}" has no reachable resolution`);
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

const road = stories.find(story => story.id === "the-road-that-vanishes");
if (road) {
  const memoryChoice = road.scenes.b4?.choices?.some(choice => choice.next === "b8" && choice.effects?.remember?.some(memory => memory.eventId === "protected-younis"));
  if (!memoryChoice) errors.push("the-road-that-vanishes: Younis choice must record memory");
  if (!road.scenes.b8?.memoryReactions?.some(reaction => reaction.requires?.includes("protected-younis"))) errors.push("the-road-that-vanishes: Salma reaction must appear at b8");
  if ((road.scenes.b8?.resolves || []).includes("passenger-memories")) errors.push("the-road-that-vanishes: passenger-memories resolves too early");
  if (!(road.scenes.b13?.resolves || []).includes("passenger-memories") && !(road.scenes.b18?.resolves || []).includes("passenger-memories")) errors.push("the-road-that-vanishes: passenger-memories needs later resolution");
  if (!road.scenes.b8?.choices?.some(choice => choice.effects?.time) || !road.scenes.b8?.choices?.some(choice => choice.effects?.trust)) errors.push("the-road-that-vanishes: Younis path choices need time and trust effects");
}
