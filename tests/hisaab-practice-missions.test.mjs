import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { practiceMissions, PRACTICE_MISSION_TEMPLATES } from '../editions/hisaab/app/screens/home/practice-missions.mjs';
import { QUEST_TEMPLATES } from '../lib/progression.mjs';

register('../editions/hisaab/node-aliases.mjs', import.meta.url);
const root = new URL('../', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    const spec = specifier.startsWith('@/') ? ${JSON.stringify(root)} + specifier.slice(2) : specifier;
    try { return await next(spec, context); } catch (error) {
      if (!(spec.startsWith('.') || spec.startsWith('file:'))) throw error;
      for (const ext of ['.ts', '.tsx', '/index.ts']) { try { return await next(spec + ext, context); } catch {} }
      throw error;
    }
  }`)}`);

test('unsupported online topic, mode, win and speed quests are absent without changing stored progress', () => {
  const items = QUEST_TEMPLATES.map(template => Object.freeze({ id: `today:${template.id}`, template: template.id, label: template.label, target: template.target, xp: template.xp, progress: 1, done: false }));
  const shown = practiceMissions(Object.freeze(items));
  assert.deepEqual(shown.map(item => item.template), PRACTICE_MISSION_TEMPLATES);
  for (const item of shown) assert.ok(items.includes(item), 'original counters/XP objects remain unchanged');
  for (const template of ['topic-play', 'mode-play', 'win-2', 'win-3', 'speed-2', 'human-1', 'combo-3', 'play-1', 'win-gauntlet', 'perfect-trilogy']) assert.equal(shown.some(item => item.template === template), false);
  assert.equal(practiceMissions([{ id: 'today:unknown' }]).length, 0);
  assert.equal(practiceMissions([{ id: 'today:save-2' }]).length, 1, 'legacy records without template still work');
});

test('visible practice missions link to the surface that emits their real progress event', async () => {
  const { questView } = await import('../editions/hisaab/app/screens/home/home-data.ts');
  const contracts = {
    'answer-3': ['#/aaj', { kind: 'discovery', correct: true }],
    'open-2': ['#/receipts', { kind: 'open' }],
    'save-2': ['#/receipts', { kind: 'save' }],
    'discovery-1': ['#/aaj', { kind: 'discovery' }],
    'expedition-cards-2': ['#/files', { kind: 'expedition-answer' }],
    'expedition-finish-1': ['#/files', { kind: 'expedition-complete' }],
    'correct-6': ['#/files', { kind: 'expedition-answer', correct: true }],
    'review-5': ['#/receipts', { kind: 'review', due: true }],
    'bold-4': ['#/files', { kind: 'expedition-answer', correct: true }],
  };
  for (const [template, [destination, event]] of Object.entries(contracts)) {
    assert.equal(questView({ id: `today:${template}`, template }).to, destination, template);
    assert.equal(QUEST_TEMPLATES.find(item => item.id === template).advances(event, {}), true, `${template} accepts its real local event`);
  }
  for (const template of ['topic-play', 'mode-play', 'win-2', 'speed-2']) {
    const view = questView({ id: `today:${template}`, template, topic: 'Energy & Mining', mode: 'gauntlet' });
    assert.equal(view.to, '#/files'); assert.doesNotMatch(view.to, /online|topic=|mode=|bot/);
  }
});
