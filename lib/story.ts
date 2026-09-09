export type Locale = 'zh' | 'en';
export type Scene =
  | 'loading'
  | 'permission'
  | 'waiting'
  | 'knocking'
  | 'noticed'
  | 'choice'
  | 'refuse'
  | 'auto0'
  | 'auto1'
  | 'auto2'
  | 'auto3'
  | 'opening'
  | 'empty'
  | 'students'
  | 'offering'
  | 'envelope'
  | 'video-return'
  | 'gift'
  | 'gift-opening'
  | 'gift-rotate'
  | 'gift-meaning0'
  | 'gift-meaning1'
  | 'gift-meaning2'
  | 'letter-transition'
  | 'letter'
  | 'video';
export type StoryEvent =
  | 'LOADED'
  | 'ENTER'
  | 'NEXT'
  | 'OPEN'
  | 'REFUSE'
  | 'UNSEAL'
  | 'VIDEO_ENDED'
  | 'SKIP_VIDEO'
  | 'OPEN_GIFT'
  | 'GIFT_READY'
  | 'CONTINUE_GIFT'
  | 'REPLAY';
const next: Partial<Record<Scene, Scene>> = {
  waiting: 'knocking',
  knocking: 'noticed',
  noticed: 'choice',
  auto0: 'refuse',
  auto1: 'auto2',
  auto2: 'auto3',
  auto3: 'opening',
  opening: 'empty',
  empty: 'students',
  students: 'offering',
  offering: 'envelope',
  'video-return': 'gift',
  'gift-rotate': 'gift-meaning0',
  'letter-transition': 'letter',
};
export function storyReducer(scene: Scene, event: StoryEvent): Scene {
  if (event === 'LOADED' && scene === 'loading') return 'permission';
  if (event === 'ENTER' && scene === 'permission') return 'waiting';
  if (event === 'OPEN' && (scene === 'choice' || scene === 'refuse'))
    return 'opening';
  if (event === 'REFUSE' && scene === 'choice') return 'auto0';
  if (event === 'REFUSE' && scene === 'refuse') return 'auto1';
  if (event === 'UNSEAL' && scene === 'envelope') return 'video';
  if ((event === 'VIDEO_ENDED' || event === 'SKIP_VIDEO') && scene === 'video')
    return 'video-return';
  if (event === 'OPEN_GIFT' && scene === 'gift') return 'gift-opening';
  if (event === 'GIFT_READY' && scene === 'gift-opening') return 'gift-rotate';
  if (event === 'CONTINUE_GIFT') {
    if (scene === 'gift-meaning0') return 'gift-meaning1';
    if (scene === 'gift-meaning1') return 'gift-meaning2';
    if (scene === 'gift-meaning2') return 'letter-transition';
  }
  if (event === 'REPLAY' && scene === 'letter') return 'waiting';
  if (event === 'NEXT') return next[scene] ?? scene;
  return scene;
}
export function sceneDelay(
  scene: Scene,
  _emojiCount: number,
): number | undefined {
  return (
    {
      waiting: 1000,
      knocking: 1200,
      noticed: 1000,
      auto0: 1400,
      auto1: 650,
      auto2: 850,
      auto3: 1100,
      opening: 1450,
      empty: 500,
      students: 1450,
      offering: 1600,
      'video-return': 850,
      'gift-rotate': 2200,
      'letter-transition': 1500,
    } as Partial<Record<Scene, number>>
  )[scene];
}
export function detectLocale(
  saved: string | null,
  languages: readonly string[],
): Locale {
  if (saved === 'zh' || saved === 'en') return saved;
  return /^zh(?:-|$)/i.test(languages[0] ?? '') ? 'zh' : 'en';
}
export function swipeProgress(
  startY: number,
  currentY: number,
  travel: number,
): number {
  return Math.max(0, Math.min(1, (startY - currentY) / Math.max(1, travel)));
}
export function shouldUnseal(progress: number): boolean {
  return progress >= 0.55;
}
export function canPlayMusic(wanted: boolean, doorOpened: boolean): boolean {
  return wanted && doorOpened;
}
export function emojiPosition(index: number, count: number) {
  const rows = Math.max(1, Math.ceil(count / 5));
  const row = Math.floor(index / 5);
  const inRow = Math.min(5, count - row * 5);
  return {
    x: 50 + ((index % 5) - (inRow - 1) / 2) * 15.5 + (row % 2 ? 2 : -2),
    y: 36 + (row / Math.max(1, rows - 1)) * 38,
    rotation: ((index * 7) % 19) - 9,
  };
}
