import { canPlayMusic } from './story.ts';
export type AudioState = {
  wanted: boolean;
  playing: boolean;
  blocked: boolean;
  failed: boolean;
  ready: boolean;
  videoPlaying: boolean;
  doorOpened: boolean;
};
type MusicConfig = {
  src: string;
  loop: boolean;
  volume: number;
  videoDuckVolume?: number;
};
export class GreetingAudio {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private bytes: ArrayBuffer | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private offset = 0;
  private startedAt = 0;
  private disposed = false;
  private volumeRamp = { from: 0, to: 0, start: 0, end: 0 };
  private state: AudioState = {
    wanted: false,
    playing: false,
    blocked: false,
    failed: false,
    ready: false,
    videoPlaying: false,
    doorOpened: false,
  };
  private listeners = new Set<(state: AudioState) => void>();
  private loading: Promise<boolean> | null = null;
  private loadAbort: AbortController | null = null;
  private decoding: Promise<void> | null = null;
  constructor(private config: MusicConfig) {}
  subscribe(listener: (state: AudioState) => void) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit(patch: Partial<AudioState> = {}) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener({ ...this.state });
  }
  private ensureContext() {
    if (!this.context) {
      const Constructor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Constructor) throw new Error('Web Audio unavailable');
      this.context = new Constructor();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
      this.context.onstatechange = () => {
        if (this.disposed) return;
        this.emit({
          playing: !!this.source && this.context?.state === 'running',
          blocked: !!this.source && this.context?.state !== 'running',
        });
      };
    }
    return this.context;
  }
  preload(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    if (this.bytes || this.buffer || this.decoding)
      return Promise.resolve(true);
    if (this.loading) return this.loading;
    const controller = new AbortController();
    this.loadAbort = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    this.loading = (async () => {
      try {
        const response = await fetch(this.config.src, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Audio load failed');
        const bytes = await response.arrayBuffer();
        if (this.disposed) return false;
        this.bytes = bytes;
        this.emit({ ready: true, failed: false });
        return true;
      } catch {
        if (!this.disposed) this.emit({ failed: true, ready: false });
        return false;
      } finally {
        clearTimeout(timer);
        if (this.loadAbort === controller) this.loadAbort = null;
        this.loading = null;
      }
    })();
    return this.loading;
  }
  private decode() {
    if (this.buffer) return Promise.resolve();
    if (this.decoding) return this.decoding;
    if (!this.bytes || !this.context)
      return Promise.reject(new Error('Audio unavailable'));
    const context = this.context;
    // Transfer the encoded data instead of keeping a duplicate MP3 beside the PCM.
    const bytes = this.bytes;
    this.bytes = null;
    const decoding = context
      .decodeAudioData(bytes)
      .then((buffer) => {
        if (
          !this.disposed &&
          canPlayMusic(this.state.wanted, this.state.doorOpened)
        ) {
          this.buffer = buffer;
          this.emit({ ready: true });
        } else if (!this.disposed) this.emit({ ready: false });
      })
      .catch((error: unknown) => {
        if (!this.disposed) this.emit({ ready: false });
        throw error;
      })
      .finally(() => {
        if (this.decoding === decoding) this.decoding = null;
      });
    this.decoding = decoding;
    return decoding;
  }
  /** Called immediately in a click handler, before awaiting any asynchronous work. */
  async enable() {
    if (this.disposed) return;
    this.emit({ wanted: true, blocked: false });
    let resumed: Promise<void>;
    try {
      resumed = this.ensureContext().resume();
    } catch {
      this.emit({ blocked: true });
      return;
    }
    try {
      await resumed;
      if (this.disposed || !this.state.wanted) return;
      await this.preload();
      if (this.disposed || !this.state.wanted) return;
      if (!this.bytes && !this.buffer && !this.decoding)
        throw new Error('Audio unavailable');
      if (this.state.doorOpened) await this.decode();
      if (!this.disposed) this.sync();
    } catch {
      if (!this.disposed) this.emit({ blocked: true });
    }
  }
  disable() {
    if (this.disposed) return;
    this.emit({ wanted: false, blocked: false });
    this.stop();
    this.buffer = null;
    this.emit({ ready: !!this.bytes });
  }
  toggle() {
    if (this.state.blocked || !this.state.wanted) void this.enable();
    else this.disable();
  }
  opened() {
    if (this.disposed) return;
    this.emit({ doorOpened: true });
    if (!this.state.wanted) return;
    void this.preload()
      .then(() => {
        if (
          !this.disposed &&
          canPlayMusic(this.state.wanted, this.state.doorOpened)
        )
          return this.decode();
      })
      .then(() => {
        if (!this.disposed) this.sync();
      })
      .catch(() => {
        if (!this.disposed) this.emit({ blocked: true, playing: false });
      });
  }
  setVideoPlaying(videoPlaying: boolean) {
    if (this.state.videoPlaying === videoPlaying) return;
    this.emit({ videoPlaying });
    this.sync();
  }
  private stop() {
    if (this.source) {
      const duration = this.buffer?.duration ?? 1;
      this.offset =
        (this.offset +
          Math.max(
            0,
            (this.context?.currentTime ?? this.startedAt) - this.startedAt,
          )) %
        duration;
      const source = this.source;
      this.source = null;
      source.onended = null;
      try {
        source.stop();
      } catch {}
      source.disconnect();
    }
    this.emit({ playing: false });
  }
  private sync() {
    if (!canPlayMusic(this.state.wanted, this.state.doorOpened)) {
      this.stop();
      return;
    }
    if (!this.buffer || !this.context || !this.gain) return;
    const volume = this.state.videoPlaying
      ? Math.min(
          this.config.volume,
          Math.max(0, this.config.videoDuckVolume ?? 0.1),
        )
      : this.config.volume;
    if (this.source) {
      if (this.volumeRamp.to !== volume)
        this.rampVolume(volume, this.state.videoPlaying ? 0.35 : 0.7);
      return;
    }
    if (this.context.state !== 'running') {
      this.emit({ blocked: true, playing: false });
      return;
    }
    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffer;
      source.loop = this.config.loop;
      source.connect(this.gain);
      this.rampVolume(volume, 1.2, true);
      this.startedAt = this.context.currentTime;
      this.source = source;
      source.onended = () => {
        if (this.source !== source) return;
        this.source = null;
        this.offset = 0;
        source.disconnect();
        source.onended = null;
        this.buffer = null;
        this.emit({ playing: false, wanted: false, ready: !!this.bytes });
      };
      source.start(0, this.offset);
      this.emit({ playing: true, blocked: false });
    } catch {
      this.source = null;
      this.emit({ blocked: true, playing: false });
    }
  }
  private rampVolume(to: number, duration: number, fromSilence = false) {
    if (!this.context || !this.gain) return;
    const now = this.context.currentTime;
    const previous = this.volumeRamp;
    const progress =
      previous.end <= previous.start
        ? 1
        : Math.max(
            0,
            Math.min(
              1,
              (now - previous.start) / (previous.end - previous.start),
            ),
          );
    // Preserve the current interpolated level when playback changes mid-fade.
    const from = fromSilence
      ? 0
      : previous.from + (previous.to - previous.from) * progress;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(from, now);
    this.gain.gain.linearRampToValueAtTime(to, now + duration);
    this.volumeRamp = { from, to, start: now, end: now + duration };
  }
  effect(kind: 'knock' | 'click' | 'celebrate') {
    if (!this.state.wanted || this.context?.state !== 'running') return;
    const ctx = this.context;
    const frequencies =
      kind === 'celebrate'
        ? [523, 659, 784, 1047]
        : kind === 'click'
          ? [580]
          : [155, 105];
    frequencies.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const time =
        ctx.currentTime + index * (kind === 'celebrate' ? 0.09 : 0.02);
      oscillator.type = kind === 'celebrate' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, time);
      gain.gain.setValueAtTime(kind === 'celebrate' ? 0.035 : 0.09, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.onended = () => {
        oscillator.onended = null;
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(time);
      oscillator.stop(time + 0.15);
    });
  }
  reset() {
    this.stop();
    this.offset = 0;
    this.buffer = null;
    this.emit({ doorOpened: false, videoPlaying: false, ready: !!this.bytes });
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loadAbort?.abort();
    this.loadAbort = null;
    this.stop();
    this.listeners.clear();
    if (this.context) {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
    }
    this.gain?.disconnect();
    this.gain = null;
    this.context = null;
    this.buffer = null;
    this.bytes = null;
    this.decoding = null;
  }
}
