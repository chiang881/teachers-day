import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  storyReducer,
  sceneDelay,
  detectLocale,
  swipeProgress,
  shouldUnseal,
  canPlayMusic,
  emojiPosition,
  type Scene,
  type StoryEvent,
} from '../lib/story.ts';
import config from '../config.js';
function travel(actions: StoryEvent[]) {
  let scene: Scene = 'loading';
  for (const event of actions) scene = storyReducer(scene, event);
  return scene;
}
const toChoice: StoryEvent[] = ['LOADED', 'ENTER', 'NEXT', 'NEXT', 'NEXT'];
for (const [name, branch] of [
  ['direct', ['OPEN']],
  ['reconsider', ['REFUSE', 'NEXT', 'OPEN']],
  ['automatic', ['REFUSE', 'NEXT', 'REFUSE', 'NEXT', 'NEXT', 'NEXT']],
] as [string, StoryEvent[]][]) {
  test(`Full ${name} journey returns from video, unwraps the gift, then reveals the letter`, () => {
    let scene = travel([...toChoice, ...branch]);
    assert.equal(scene, 'opening');
    assert.equal(storyReducer(scene, 'OPEN'), 'opening');
    for (let i = 0; i < 4; i++) scene = storyReducer(scene, 'NEXT');
    assert.equal(scene, 'envelope');
    scene = storyReducer(scene, 'UNSEAL');
    assert.equal(scene, 'video');
    assert.equal(storyReducer(scene, 'UNSEAL'), 'video');
    assert.equal(storyReducer(scene, 'NEXT'), 'video');
    assert.equal(storyReducer(scene, 'REPLAY'), 'video');
    scene = storyReducer(scene, 'VIDEO_ENDED');
    assert.equal(scene, 'video-return');
    assert.equal(storyReducer(scene, 'VIDEO_ENDED'), 'video-return');
    assert.equal(storyReducer(scene, 'UNSEAL'), 'video-return');
    scene = storyReducer(scene, 'NEXT');
    assert.equal(scene, 'gift');
    assert.equal(storyReducer(scene, 'CONTINUE_GIFT'), 'gift');
    scene = storyReducer(scene, 'OPEN_GIFT');
    assert.equal(scene, 'gift-opening');
    assert.equal(storyReducer(scene, 'OPEN_GIFT'), 'gift-opening');
    assert.equal(storyReducer(scene, 'CONTINUE_GIFT'), 'gift-opening');
    assert.equal(storyReducer(scene, 'NEXT'), 'gift-opening');
    assert.equal(sceneDelay(scene, 25), undefined);
    scene = storyReducer(scene, 'GIFT_READY');
    assert.equal(scene, 'gift-rotate');
    assert.equal(storyReducer(scene, 'GIFT_READY'), 'gift-rotate');
    scene = storyReducer(scene, 'NEXT');
    for (let i = 0; i < 3; i++) {
      assert.equal(scene, `gift-meaning${i}`);
      assert.equal(storyReducer(scene, 'NEXT'), scene);
      assert.equal(storyReducer(scene, 'VIDEO_ENDED'), scene);
      scene = storyReducer(scene, 'CONTINUE_GIFT');
    }
    assert.equal(scene, 'letter-transition');
    assert.equal(storyReducer(scene, 'CONTINUE_GIFT'), 'letter-transition');
    scene = storyReducer(scene, 'NEXT');
    assert.equal(scene, 'letter');
    assert.equal(storyReducer(scene, 'NEXT'), 'letter');
    assert.equal(storyReducer(scene, 'VIDEO_ENDED'), 'letter');
    assert.equal(storyReducer(scene, 'REPLAY'), 'waiting');
  });
}
test('Cannot skip loading, grant entry twice or unseal a closed office', () => {
  assert.equal(travel(['ENTER', 'OPEN', 'UNSEAL']), 'loading');
  assert.equal(travel(['LOADED', 'ENTER', 'ENTER', 'UNSEAL']), 'waiting');
});
test('The selected sound mode enters the office story directly', () => {
  assert.equal(storyReducer('permission', 'ENTER'), 'waiting');
  assert.equal(storyReducer('waiting', 'ENTER'), 'waiting');
  assert.equal(sceneDelay('permission', 25), undefined);
  assert.equal(sceneDelay('waiting', 25), 1000);
});
test('The empty-office reply reveals the speaker before offering two equal paths', () => {
  assert.equal(storyReducer('choice', 'REFUSE'), 'auto0');
  assert.equal(storyReducer('auto0', 'OPEN'), 'auto0');
  assert.equal(storyReducer('auto0', 'NEXT'), 'refuse');
  assert.equal(storyReducer('refuse', 'OPEN'), 'opening');
  assert.equal(storyReducer('refuse', 'REFUSE'), 'auto1');
  assert.equal(travel(['LOADED', 'ENTER']), 'waiting');
  assert.equal(
    travel([...toChoice, 'REFUSE', 'NEXT', 'REFUSE', 'NEXT', 'NEXT', 'NEXT']),
    'opening',
  );
});
test('Consent has no automatic timer; classmates enter together before the envelope', () => {
  assert.equal(sceneDelay('permission', 25), undefined);
  assert.equal(sceneDelay('envelope', 25), undefined);
  assert.equal(sceneDelay('letter', 25), undefined);
  assert.equal(sceneDelay('video', 25), undefined);
  assert.equal(sceneDelay('letter-transition', 25), 1500);
  assert.equal(sceneDelay('students', 25), 1450);
  assert.equal(sceneDelay('students', 1), 1450);
});
test('A blocked or failed video returns to the gift and cannot bypass its explanation', () => {
  assert.equal(storyReducer('envelope', 'SKIP_VIDEO'), 'envelope');
  assert.equal(storyReducer('envelope', 'VIDEO_ENDED'), 'envelope');
  let scene = storyReducer('video', 'SKIP_VIDEO');
  assert.equal(scene, 'video-return');
  assert.equal(storyReducer(scene, 'SKIP_VIDEO'), scene);
  scene = storyReducer(scene, 'NEXT');
  assert.equal(scene, 'gift');
  assert.equal(storyReducer(scene, 'SKIP_VIDEO'), 'gift');
  assert.equal(storyReducer(scene, 'NEXT'), 'gift');
  for (const stage of [
    'gift',
    'gift-meaning0',
    'gift-meaning1',
    'gift-meaning2',
  ] as Scene[]) {
    assert.equal(sceneDelay(stage, 25), undefined);
    assert.equal(storyReducer(stage, 'REPLAY'), stage);
  }
});
test('Swipe cancels or rebounds below 55%, and clamps both directions', () => {
  assert.equal(swipeProgress(200, 300, 240), 0);
  assert.equal(swipeProgress(400, 100, 240), 1);
  assert.equal(shouldUnseal(0.549), false);
  assert.equal(shouldUnseal(0.55), true);
  assert.equal(shouldUnseal(swipeProgress(200, 200, 240)), false);
});
test('Locale chooses saved preference, otherwise only the first system language', () => {
  assert.equal(detectLocale(null, ['zh-CN']), 'zh');
  assert.equal(detectLocale(null, ['zh-TW']), 'zh');
  assert.equal(detectLocale(null, ['ZH-hant']), 'zh');
  assert.equal(detectLocale(null, ['en-US', 'zh-CN']), 'en');
  assert.equal(detectLocale(null, ['fr-FR']), 'en');
  assert.equal(detectLocale(null, []), 'en');
  assert.equal(detectLocale('en', ['zh-CN']), 'en');
  assert.equal(detectLocale('zh', ['en']), 'zh');
  assert.equal(detectLocale('invalid', ['zh']), 'zh');
});
test('Music only starts after opening the door and when the user wants it', () => {
  for (const wanted of [true, false])
    for (const door of [true, false])
      assert.equal(canPlayMusic(wanted, door), wanted && door);
});
test('Default class contains every required animal once, and exactly 25 pupils', () => {
  assert.equal(config.emojis.length, 25);
  for (const required of ['🐯', '🦌', '🐙', '🐟', '🐱', '🐻', '☀️', '🐷'])
    assert.equal(config.emojis.filter((e) => e === required).length, 1);
  for (let i = 0; i < 25; i++) {
    const p = emojiPosition(i, 25);
    assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100);
  }
});
function keys(value: unknown, prefix = ''): string[] {
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? keys(v, prefix + key + '.')
        : [prefix + key],
    )
    .sort();
}
test('Both languages supply identical content interfaces and full letter paragraphs', () => {
  assert.deepEqual(keys(config.locales.zh), keys(config.locales.en));
  assert.equal(config.locales.zh.letter.paragraphs.length, 5);
  assert.equal(config.locales.en.letter.paragraphs.length, 5);
  assert.equal(config.locales.zh.gift.steps.length, 3);
  assert.equal(config.locales.en.gift.steps.length, 3);
  assert.equal(config.video.autoplay, false);
  assert.match(config.video.src, /^https:\/\//);
  assert.equal(config.gift.model, '/models/hongzao-red-date.glb');
  assert.equal(
    `${config.locales.zh.ui.achievementUnlocked}${config.locales.zh.ui.achievementEmptyOffice}`,
    '达成成就：此地无银三百两',
  );
});
