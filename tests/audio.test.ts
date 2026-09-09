import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GreetingAudio, type AudioState } from '../lib/audio.ts';
class FakeSource {
  buffer: unknown;
  loop = false;
  onended: (() => void) | null = null;
  offset = 0;
  stopped = false;
  connect() {}
  disconnect() {}
  start(_time: number, offset: number) {
    this.offset = offset;
  }
  stop() {
    this.stopped = true;
    this.onended?.();
  }
}
class FakeGainParam {
  ramps: { value: number; time: number }[] = [];
  levels: { value: number; time: number }[] = [];
  cancelScheduledValues() {}
  setValueAtTime(value: number, time: number) {
    this.levels.push({ value, time });
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.ramps.push({ value, time });
  }
}
class FakeContext {
  static latest: FakeContext;
  static denyResume = false;
  static denyDecode = false;
  static decodeGate: Promise<void> | null = null;
  currentTime = 0;
  state = 'suspended';
  destination = {};
  onstatechange: (() => void) | null = null;
  sources: FakeSource[] = [];
  musicGain = new FakeGainParam();
  decodes = 0;
  constructor() {
    FakeContext.latest = this;
  }
  async resume() {
    if (FakeContext.denyResume) throw new Error('Blocked');
    this.state = 'running';
    this.onstatechange?.();
  }
  async close() {
    this.state = 'closed';
  }
  createGain() {
    return {
      connect() {},
      disconnect() {},
      gain: this.musicGain,
    };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  async decodeAudioData() {
    this.decodes++;
    if (FakeContext.decodeGate) await FakeContext.decodeGate;
    if (FakeContext.denyDecode) throw new Error('Invalid media');
    return { duration: 179 };
  }
}
const originalFetch = globalThis.fetch,
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
afterEach(() => {
  globalThis.fetch = originalFetch;
  FakeContext.denyResume = false;
  FakeContext.denyDecode = false;
  FakeContext.decodeGate = null;
  if (originalWindow)
    Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});
function setup(volume = 0.45) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { AudioContext: FakeContext },
  });
  globalThis.fetch = async () => new Response(new ArrayBuffer(16));
  const engine = new GreetingAudio({
    src: '/song.mp3',
    loop: true,
    volume,
    videoDuckVolume: 0.1,
  });
  let state: AudioState;
  engine.subscribe((value) => {
    state = value;
  });
  return {
    engine,
    get state() {
      return state!;
    },
  };
}
async function settleAudio() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
test('Unlocking audio cannot play until door opens; repeated open does not duplicate sources', async () => {
  const box = setup();
  await box.engine.preload();
  await box.engine.enable();
  assert.equal(box.state.playing, false);
  assert.equal(FakeContext.latest.sources.length, 0);
  box.engine.opened();
  box.engine.opened();
  await settleAudio();
  assert.equal(box.state.playing, true);
  assert.equal(FakeContext.latest.sources.length, 1);
  assert.equal(FakeContext.latest.sources[0].loop, true);
  box.engine.dispose();
});
test('Manual pause preserves offset and video completion never overrides it', async () => {
  const box = setup();
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  const ctx = FakeContext.latest;
  ctx.currentTime = 24;
  box.engine.disable();
  assert.equal(box.state.playing, false);
  ctx.currentTime = 90;
  await box.engine.enable();
  assert.equal(ctx.sources[1].offset, 24);
  assert.equal(ctx.decodes, 2);
  ctx.currentTime = 100;
  box.engine.setVideoPlaying(true);
  assert.equal(box.state.playing, true);
  box.engine.setVideoPlaying(false);
  assert.equal(ctx.sources.length, 2);
  assert.equal(ctx.sources[1].stopped, false);
  box.engine.setVideoPlaying(true);
  box.engine.disable();
  box.engine.setVideoPlaying(false);
  assert.equal(box.state.wanted, false);
  assert.equal(box.state.playing, false);
  assert.equal(ctx.sources.length, 2);
  await box.engine.enable();
  assert.equal(ctx.sources[2].offset, 34);
  box.engine.dispose();
});
test('Video ducks the existing music source and restores volume without restarting playback', async () => {
  const box = setup();
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  const ctx = FakeContext.latest;
  ctx.currentTime = 10;
  box.engine.setVideoPlaying(true);
  assert.equal(box.state.playing, true);
  assert.equal(ctx.sources[0].stopped, false);
  assert.deepEqual(ctx.musicGain.ramps.at(-1), { value: 0.1, time: 10.35 });
  assert.deepEqual(ctx.musicGain.levels.at(-1), { value: 0.45, time: 10 });
  const ramps = ctx.musicGain.ramps.length;
  box.engine.setVideoPlaying(true);
  assert.equal(ctx.musicGain.ramps.length, ramps);
  ctx.currentTime = 40;
  box.engine.setVideoPlaying(false);
  assert.deepEqual(ctx.musicGain.ramps.at(-1), { value: 0.45, time: 40.7 });
  assert.ok(Math.abs(ctx.musicGain.levels.at(-1)!.value - 0.1) < 1e-9);
  assert.equal(ctx.musicGain.levels.at(-1)?.time, 40);
  assert.equal(ctx.sources.length, 1);
  box.engine.disable();
  ctx.currentTime = 60;
  await box.engine.enable();
  assert.equal(ctx.sources[1].offset, 40);
  box.engine.dispose();
});
test('Rapid video pause and resume continue from the current fade level', async () => {
  const box = setup();
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  const ctx = FakeContext.latest;
  ctx.currentTime = 10;
  box.engine.setVideoPlaying(true);
  ctx.currentTime = 10.175;
  box.engine.setVideoPlaying(false);
  assert.ok(Math.abs(ctx.musicGain.levels.at(-1)!.value - 0.275) < 1e-9);
  ctx.currentTime = 10.525;
  box.engine.setVideoPlaying(true);
  assert.ok(Math.abs(ctx.musicGain.levels.at(-1)!.value - 0.3625) < 1e-9);
  assert.equal(ctx.sources.length, 1);
  box.engine.dispose();
});
test('Music enabled during a video starts low and never raises an already quieter track', async () => {
  for (const volume of [0.45, 0.05]) {
    const box = setup(volume);
    box.engine.opened();
    box.engine.setVideoPlaying(true);
    await box.engine.enable();
    assert.equal(box.state.playing, true);
    assert.equal(
      FakeContext.latest.musicGain.ramps.at(-1)?.value,
      Math.min(volume, 0.1),
    );
    box.engine.dispose();
  }
});
test('Autoplay rejection is recoverable by a later user gesture', async () => {
  const box = setup();
  FakeContext.denyResume = true;
  await box.engine.enable();
  box.engine.opened();
  assert.equal(box.state.playing, false);
  assert.equal(box.state.blocked, true);
  FakeContext.denyResume = false;
  await box.engine.enable();
  assert.equal(box.state.playing, true);
  assert.equal(box.state.blocked, false);
  box.engine.dispose();
});
test('Missing music does not leave preloading pending and can be retried', async () => {
  const box = setup();
  globalThis.fetch = async () => new Response('', { status: 404 });
  assert.equal(await box.engine.preload(), false);
  assert.equal(box.state.failed, true);
  globalThis.fetch = async () => new Response(new ArrayBuffer(16));
  assert.equal(await box.engine.preload(), true);
  assert.equal(box.state.failed, false);
  box.engine.dispose();
});
test('Video cannot start background music after a muted entry', async () => {
  const box = setup();
  box.engine.disable();
  box.engine.opened();
  box.engine.setVideoPlaying(true);
  box.engine.setVideoPlaying(false);
  assert.equal(box.state.playing, false);
  box.engine.dispose();
});
test('Replay closes music gate and starts from zero only at next opening', async () => {
  const box = setup();
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  FakeContext.latest.currentTime = 50;
  box.engine.reset();
  assert.equal(box.state.doorOpened, false);
  assert.equal(box.state.playing, false);
  box.engine.opened();
  await settleAudio();
  assert.equal(FakeContext.latest.sources.at(-1)?.offset, 0);
  box.engine.dispose();
});
test('Interrupted audio stops the record animation and can resume', async () => {
  const box = setup();
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  FakeContext.latest.state = 'suspended';
  FakeContext.latest.onstatechange?.();
  assert.equal(box.state.playing, false);
  assert.equal(box.state.blocked, true);
  await box.engine.enable();
  assert.equal(box.state.playing, true);
  box.engine.dispose();
});
test('Decode failure is surfaced without corrupting the story audio gate', async () => {
  const box = setup();
  FakeContext.denyDecode = true;
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  assert.equal(box.state.blocked, true);
  assert.equal(box.state.playing, false);
  FakeContext.denyDecode = false;
  await box.engine.enable();
  assert.equal(box.state.playing, true);
  box.engine.dispose();
});

test('Disposing an in-flight preload aborts its request and never publishes late state', async () => {
  const box = setup();
  let signal: AbortSignal | undefined;
  globalThis.fetch = async (_url, init) =>
    new Promise<Response>((_resolve, reject) => {
      signal = init?.signal ?? undefined;
      signal?.addEventListener('abort', () => reject(new Error('Aborted')), {
        once: true,
      });
    });
  const loading = box.engine.preload();
  let notifications = 0;
  box.engine.subscribe(() => notifications++);
  box.engine.dispose();
  const atDispose = notifications;
  assert.equal(signal?.aborted, true);
  assert.equal(await loading, false);
  await box.engine.enable();
  assert.equal(notifications, atDispose);
  assert.equal(box.state.playing, false);
});

test('A decode completed after manual pause is discarded; resume can load and play again', async () => {
  const box = setup();
  let resolveDecode!: () => void;
  FakeContext.decodeGate = new Promise<void>((resolve) => {
    resolveDecode = resolve;
  });
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  box.engine.disable();
  resolveDecode();
  await settleAudio();
  assert.equal(box.state.ready, false);
  assert.equal(box.state.playing, false);
  assert.equal(FakeContext.latest.sources.length, 0);
  FakeContext.decodeGate = null;
  await box.engine.enable();
  assert.equal(box.state.playing, true);
  assert.equal(FakeContext.latest.sources.length, 1);
  box.engine.dispose();
});

test('Preloaded audio is reused while playing, but paused decoded audio is not retained', async () => {
  const box = setup();
  let downloads = 0;
  globalThis.fetch = async () => {
    downloads++;
    return new Response(new ArrayBuffer(16));
  };
  await box.engine.enable();
  box.engine.opened();
  await settleAudio();
  await box.engine.preload();
  assert.equal(downloads, 1);
  FakeContext.latest.currentTime = 17;
  box.engine.disable();
  assert.equal(box.state.ready, false);
  await box.engine.enable();
  assert.equal(downloads, 2);
  assert.equal(FakeContext.latest.sources[1].offset, 17);
  box.engine.dispose();
});
