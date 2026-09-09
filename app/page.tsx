'use client';
import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  ArrowUp,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Heart,
} from 'lucide-react';
import Celebration from '@/components/celebration';
import SurpriseVideo, {
  type SurpriseVideoHandle,
} from '@/components/surprise-video';
import TypewriterLetter from '@/components/typewriter-letter';
import JujubeGift from '@/components/jujube-gift';
import { GreetingAudio, type AudioState } from '@/lib/audio';
import {
  detectLocale,
  emojiPosition,
  sceneDelay,
  shouldUnseal,
  storyReducer,
  swipeProgress,
  type Locale,
  type Scene,
  type StoryEvent,
} from '@/lib/story';
import config from '../config';
const STORAGE_KEY = 'teachers-day-language';
const giftScenes = new Set<Scene>([
  'gift',
  'gift-opening',
  'gift-rotate',
  'gift-meaning0',
  'gift-meaning1',
  'gift-meaning2',
  'letter-transition',
]);
const openedScenes = new Set<Scene>([
  ...giftScenes,
  'video-return',
  'empty',
  'students',
  'offering',
  'envelope',
  'letter-transition',
  'letter',
  'video',
]);
const crowdScenes = new Set<Scene>([
  ...giftScenes,
  'video-return',
  'students',
  'offering',
  'envelope',
  'video',
  'letter-transition',
]);
const firstAudio: AudioState = {
  wanted: false,
  playing: false,
  blocked: false,
  failed: false,
  ready: false,
  videoPlaying: false,
  doorOpened: false,
};
function preloadImage(src: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = (error?: Error) => {
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener('abort', cancel);
      if (error) {
        image.removeAttribute('src');
        reject(error);
      } else resolve();
    };
    const cancel = () => finish(new Error('Image load cancelled'));
    const timer = setTimeout(() => finish(new Error('Image timed out')), 8000);
    signal.addEventListener('abort', cancel, { once: true });
    if (signal.aborted) {
      cancel();
      return;
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error('Image unavailable'));
    image.src = src;
  });
}
export default function Home() {
  const [locale, setLocale] = useState<Locale>('zh');
  const [localized, setLocalized] = useState(false);
  const [scene, dispatch] = useReducer(storyReducer, 'loading');
  const [audio, setAudio] = useState<AudioState>(firstAudio);
  const [attempt, setAttempt] = useState(0),
    [slow, setSlow] = useState(false),
    [artFailed, setArtFailed] = useState(false),
    [artReady, setArtReady] = useState(false),
    [coverFailed, setCoverFailed] = useState(false);
  const [progress, setProgress] = useState(0),
    [dragging, setDragging] = useState(false);
  const [achievementVisible, setAchievementVisible] = useState(false);
  const engine = useRef<GreetingAudio | null>(null),
    sceneRef = useRef<Scene>(scene),
    progressRef = useRef(0),
    drag = useRef<{ id: number; y: number; travel: number } | null>(null),
    video = useRef<SurpriseVideoHandle>(null),
    letter = useRef<HTMLElement>(null),
    achievementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = config.locales[locale];
  sceneRef.current = scene;
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {}
    setLocale(
      detectLocale(
        saved,
        navigator.languages?.length
          ? navigator.languages
          : [navigator.language],
      ),
    );
    setLocalized(true);
  }, []);
  useEffect(() => {
    if (!localized) return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title = config.locales[locale].ui.pageTitle;
  }, [locale, localized]);
  useEffect(() => {
    const instance = new GreetingAudio(config.music);
    engine.current = instance;
    const unsubscribe = instance.subscribe(setAudio);
    return () => {
      unsubscribe();
      instance.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(
    () => () => {
      if (achievementTimer.current) clearTimeout(achievementTimer.current);
    },
    [],
  );
  useEffect(() => {
    let active = true;
    const lifecycle = new AbortController();
    let minimumDelay: ReturnType<typeof setTimeout>;
    setSlow(false);
    setArtFailed(false);
    setArtReady(false);
    const instance = engine.current;
    if (!instance) return;
    const timer = setTimeout(() => {
      if (active) setSlow(true);
    }, 8000);
    const art = Promise.all(
      Object.values(config.artwork).map((src) =>
        preloadImage(src, lifecycle.signal),
      ),
    )
      .then(() => {
        if (active) setArtReady(true);
        return true;
      })
      .catch(() => {
        if (active) setArtFailed(true);
        return false;
      });
    const cover = preloadImage(config.music.cover, lifecycle.signal)
      .then(() => {
        if (active) setCoverFailed(false);
      })
      .catch(() => {
        if (active) setCoverFailed(true);
      });
    void Promise.all([
      art,
      cover,
      instance.preload(),
      new Promise((resolve) => {
        minimumDelay = setTimeout(resolve, 650);
      }),
    ]).then(([ready]) => {
      if (active) {
        clearTimeout(timer);
        if (ready) dispatch('LOADED');
      }
    });
    return () => {
      active = false;
      lifecycle.abort();
      clearTimeout(minimumDelay);
      clearTimeout(timer);
    };
  }, [attempt]);
  useEffect(() => {
    const delay = sceneDelay(scene, config.emojis.length);
    if (delay === undefined) return;
    const timer = setTimeout(() => dispatch('NEXT'), delay);
    return () => clearTimeout(timer);
  }, [scene]);
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (scene === 'knocking')
      for (const delay of [0, 360, 720])
        timers.push(setTimeout(() => engine.current?.effect('knock'), delay));
    if (scene === 'opening' || scene === 'auto2')
      engine.current?.effect('click');
    if (scene === 'empty') engine.current?.opened();
    if (scene === 'gift-opening' || scene === 'letter-transition') {
      engine.current?.effect('celebrate');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (scene === 'letter') letter.current?.focus({ preventScroll: true });
    return () => timers.forEach(clearTimeout);
  }, [scene]);
  const chooseLocale = useCallback((next: Locale) => {
    setLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }, []);
  const enter = useCallback((withSound: boolean) => {
    if (sceneRef.current !== 'permission') return;
    if (withSound) void engine.current?.enable();
    else engine.current?.disable();
    dispatch('ENTER');
  }, []);
  const refuseOffice = useCallback(() => {
    if (sceneRef.current !== 'choice') return;
    if (achievementTimer.current) clearTimeout(achievementTimer.current);
    setAchievementVisible(true);
    achievementTimer.current = setTimeout(() => {
      setAchievementVisible(false);
      achievementTimer.current = null;
    }, 4200);
    dispatch('REFUSE');
  }, []);
  const unseal = useCallback(() => {
    if (sceneRef.current !== 'envelope') return;
    drag.current = null;
    setDragging(false);
    progressRef.current = 1;
    setProgress(1);
    // This is the same video element already visible inside the envelope.
    // Play it directly in the trusted drag/click event, then reveal it.
    video.current?.start();
    dispatch('UNSEAL');
  }, []);
  const videoPlayback = useCallback(
    (playing: boolean) => engine.current?.setVideoPlaying(playing),
    [],
  );
  const finishVideo = useCallback((event: 'VIDEO_ENDED' | 'SKIP_VIDEO') => {
    if (sceneRef.current !== 'video') return;
    sceneRef.current = 'video-return';
    engine.current?.setVideoPlaying(false);
    dispatch(event);
  }, []);
  const openGift = useCallback(() => {
    if (sceneRef.current !== 'gift') return;
    sceneRef.current = 'gift-opening';
    dispatch('OPEN_GIFT');
  }, []);
  const continueGift = useCallback(() => {
    if (sceneRef.current !== scene) return;
    const next = storyReducer(scene, 'CONTINUE_GIFT');
    if (next === scene) return;
    sceneRef.current = next;
    dispatch('CONTINUE_GIFT');
  }, [scene]);
  const giftReady = useCallback(() => {
    if (sceneRef.current !== 'gift-opening') return;
    sceneRef.current = 'gift-rotate';
    dispatch('GIFT_READY');
  }, []);
  const replay = () => {
    engine.current?.reset();
    progressRef.current = 0;
    setProgress(0);
    dispatch('REPLAY');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Optional, feature-detected WebMCP controls use the same visible story actions.
  useEffect(() => {
    type Context = {
      registerTool: (
        tool: {
          name: string;
          description: string;
          inputSchema: object;
          annotations: { readOnlyHint: boolean };
          execute: (input: unknown) => unknown;
        },
        options: { signal: AbortSignal },
      ) => void | Promise<void>;
    };
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const afterPaint = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    const register = (tool: Parameters<Context['registerTool']>[0]) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'get_greeting_state',
      description: 'Read the current greeting stage.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({ scene: sceneRef.current }),
    });
    register({
      name: 'advance_greeting',
      description:
        'Use an available visible greeting action. Starts silently; never grants audio permission.',
      inputSchema: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['enter_silently', 'open_door', 'refuse_door', 'open_letter'],
          },
        },
        required: ['action'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input) => {
        const action = (input as { action?: string })?.action;
        const events: Record<string, StoryEvent> = {
          enter_silently: 'ENTER',
          open_door: 'OPEN',
          refuse_door: 'REFUSE',
          open_letter: 'UNSEAL',
        };
        const event = action ? events[action] : undefined;
        if (
          !event ||
          storyReducer(sceneRef.current, event) === sceneRef.current
        )
          throw new Error('Action unavailable in this scene');
        if (action === 'enter_silently') enter(false);
        else if (action === 'open_letter') unseal();
        else if (action === 'refuse_door' && sceneRef.current === 'choice')
          refuseOffice();
        else dispatch(event);
        await afterPaint();
        return { scene: sceneRef.current };
      },
    });
    return () => lifecycle.abort();
  }, [enter, refuseOffice, unseal]);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (
      scene !== 'envelope' ||
      drag.current ||
      event.button !== 0 ||
      !event.isPrimary
    )
      return;
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      travel: Math.min(240, window.innerHeight * 0.3),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    const next = swipeProgress(
      drag.current.y,
      event.clientY,
      drag.current.travel,
    );
    progressRef.current = next;
    setProgress(next);
    if (shouldUnseal(next)) unseal();
  };
  const finishDrag = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    if (!drag.current || event.pointerId !== drag.current.id) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && shouldUnseal(progressRef.current)) unseal();
    else {
      progressRef.current = 0;
      setProgress(0);
    }
  };
  const showingLetter = scene === 'letter';
  const showingGift = giftScenes.has(scene);
  const showingVideo = scene === 'video' || scene === 'video-return';
  const offering =
    showingGift ||
    scene === 'video-return' ||
    scene === 'offering' ||
    scene === 'envelope' ||
    scene === 'video' ||
    scene === 'letter-transition';
  const musicStatus = audio.blocked
    ? t.ui.blocked
    : audio.videoPlaying && audio.wanted
      ? t.ui.musicWaiting
      : !audio.doorOpened && audio.wanted
        ? t.ui.armed
        : audio.wanted
          ? t.ui.pause
          : t.ui.play;
  const buttonMusicLabel = audio.blocked
    ? t.ui.blocked
    : audio.wanted
      ? t.ui.pause
      : t.ui.play;
  let caption = t.story.waiting;
  if (scene === 'loading') caption = localized ? t.ui.loading : '…';
  else if (scene === 'knocking' || scene === 'noticed' || scene === 'choice')
    caption = t.story.knockingText;
  else if (scene === 'refuse') caption = t.story.refuseText;
  else if (scene.startsWith('auto'))
    caption = t.story.autoOpen[Number(scene.slice(-1))];
  else if (scene === 'opening' || scene === 'empty') caption = t.story.opening;
  else if (scene === 'students' || scene === 'video')
    caption = t.story.surprise;
  else if (scene === 'offering') caption = t.story.envelopeIntro;
  else if (scene === 'envelope') caption = t.story.swipeHint;
  return (
    <main
      className={`greeting locale-${locale} ${showingLetter ? 'reading' : ''}`}
      data-scene={scene}
    >
      <div
        className={`achievement-toast ${achievementVisible ? 'is-visible' : ''}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="achievement-icon" aria-hidden="true">
          <Trophy size={23} strokeWidth={1.8} />
        </span>
        <span className="achievement-copy">
          <strong>{t.ui.achievementUnlocked}</strong>
          <span>{t.ui.achievementEmptyOffice}</span>
        </span>
      </div>
      <header className="topbar">
        <span className="brand">
          <Sparkles size={19} />
          <span>{t.ui.brand}</span>
        </span>
        <div className="toolbar">
          <div className="language" role="group" aria-label={t.ui.language}>
            <button
              type="button"
              onClick={() => chooseLocale('zh')}
              aria-pressed={locale === 'zh'}
              lang="zh-CN"
            >
              中
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              onClick={() => chooseLocale('en')}
              aria-pressed={locale === 'en'}
              lang="en"
            >
              EN
            </button>
          </div>
          <div className="music-control">
            <button
              type="button"
              className={`record ${audio.playing ? 'is-playing' : ''}`}
              onClick={() => engine.current?.toggle()}
              aria-label={buttonMusicLabel}
              aria-pressed={audio.wanted}
              title={`${config.music.title} · ${config.music.artist}\n${musicStatus}`}
              data-playing={audio.playing}
            >
              <span className="record-art">
                {!coverFailed ? (
                  <img
                    src={config.music.cover}
                    alt=""
                    onError={() => setCoverFailed(true)}
                  />
                ) : (
                  <Music2 size={22} />
                )}
              </span>
              <span className="record-status">
                {audio.playing ? (
                  <Pause size={13} fill="currentColor" />
                ) : (
                  <Play size={13} fill="currentColor" />
                )}
              </span>
            </button>
            {audio.blocked && (
              <span className="music-nudge" role="status">
                {t.ui.blocked}
              </span>
            )}
          </div>
        </div>
      </header>
      {showingLetter ? (
        <section className="reading-scene">
          <article
            ref={letter}
            tabIndex={-1}
            className="letter-paper"
            aria-label={t.ui.letterLabel}
          >
            <div className="paper-heading">
              <span>09.10</span>
              <Heart size={22} strokeWidth={1.5} />
            </div>
            <div className="letter-body">
              <TypewriterLetter
                greeting={t.letter.greeting}
                paragraphs={t.letter.paragraphs}
                signature={t.letter.signature}
              />
            </div>
            <div className="paper-bottom" aria-hidden="true">
              <span />
              <Sparkles size={18} />
              <span />
            </div>
          </article>
          <button
            type="button"
            className="text-button replay"
            disabled={scene !== 'letter'}
            onClick={replay}
          >
            <RotateCcw size={15} />
            {t.ui.replay}
          </button>
        </section>
      ) : (
        <section
          className={`story-scene ${scene === 'loading' || scene === 'permission' ? 'is-entry' : ''} ${offering ? 'is-offering' : ''} ${showingVideo ? 'video-backdrop' : ''} ${showingGift ? 'gift-scene' : ''}`}
          aria-busy={scene === 'loading'}
        >
          <div
            className={`stage ${offering ? 'stage-offering' : ''} ${showingVideo ? 'video-stage' : ''} ${showingGift ? 'gift-backdrop-stage' : ''}`}
          >
            <div className="room" aria-hidden="true">
              <img
                className="hallway-art"
                src={config.artwork.hallway}
                alt=""
              />
              <div
                className={`door-leaf ${openedScenes.has(scene) || scene === 'opening' ? 'is-open' : ''} ${scene === 'knocking' ? 'is-knocking' : ''} ${scene === 'auto2' ? 'handle-wiggle' : ''}`}
              >
                <img src={config.artwork.door} alt="" />
                <span className="door-sign">{t.teacher.doorSign}</span>
                <span className="door-handle" />
              </div>
              {scene === 'knocking' && (
                <div className="knock-words">
                  {[0, 1, 2].map((index) => (
                    <span key={index} style={{ '--i': index } as CSSProperties}>
                      {t.story.knock}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {crowdScenes.has(scene) && (
              <div
                className={`classmates ${offering ? 'make-room' : ''}`}
                aria-label={`${config.emojis.length} ${locale === 'zh' ? '位同学' : 'classmates'}`}
              >
                {config.emojis.map((emoji, index) => {
                  const position = emojiPosition(index, config.emojis.length);
                  return (
                    <span
                      key={index}
                      className="classmate-position"
                      style={
                        {
                          '--x': `${position.x}%`,
                          '--y': `${position.y}%`,
                          '--rotation': `${position.rotation}deg`,
                          '--float-delay': `${index * -0.13}s`,
                          '--side': position.x < 50 ? -1 : 1,
                          '--row': Math.floor(index / 5),
                        } as CSSProperties
                      }
                    >
                      <span className="classmate-enter">
                        <span className="classmate-float">{emoji}</span>
                      </span>
                    </span>
                  );
                })}
              </div>
            )}
            {offering && (
              <div
                className={`envelope-position ${scene === 'offering' ? 'is-arriving' : ''} ${showingVideo ? 'is-video-shell' : ''}`}
              >
                <div
                  className={`envelope-interactive ${dragging ? 'is-dragging' : ''} ${progress > 0.5 ? 'is-flap-behind' : ''} ${showingVideo ? 'is-video-shell' : ''}`}
                  style={{ '--progress': progress } as CSSProperties}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={finishDrag}
                  onPointerCancel={(event) => finishDrag(event, true)}
                  onLostPointerCapture={(event) => finishDrag(event, true)}
                  aria-label={
                    scene === 'envelope' ? t.story.swipeHint : undefined
                  }
                  data-progress={progress}
                >
                  <img
                    className="envelope-back"
                    src={config.artwork.envelope}
                    alt=""
                    draggable={false}
                  />
                  {!showingGift && (
                    <div
                      className={`envelope-note ${showingVideo ? 'is-video-shell' : ''}`}
                    >
                      <SurpriseVideo
                        ref={video}
                        locale={locale}
                        revealed={showingVideo}
                        leaving={scene === 'video-return'}
                        initialMuted={config.video.muted || !audio.wanted}
                        onPlayback={videoPlayback}
                        onEnded={() => finishVideo('VIDEO_ENDED')}
                        onSkip={() => finishVideo('SKIP_VIDEO')}
                      />
                    </div>
                  )}
                  <img
                    className="envelope-front"
                    src={config.artwork.envelope}
                    alt=""
                    draggable={false}
                  />
                  <div className="envelope-flap">
                    <img
                      src={config.artwork.envelope}
                      alt=""
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          {showingGift && (
            <JujubeGift
              locale={locale}
              scene={scene}
              onOpen={openGift}
              onContinue={continueGift}
              onPresented={giftReady}
            />
          )}
          <div
            className="scene-actions"
            hidden={showingGift}
            aria-hidden={showingVideo || showingGift}
            inert={showingVideo || showingGift}
          >
            {scene !== 'permission' && (
              <p
                className="story-caption"
                aria-live="polite"
                aria-atomic="true"
              >
                {scene === 'envelope' && (
                  <ArrowUp className="swipe-arrow" size={20} />
                )}
                <span>{caption}</span>
              </p>
            )}
            {scene === 'loading' && (
              <div className="story-loading" role="status">
                <div className="loading-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                {(slow || artFailed) && (
                  <div className="story-recovery">
                    <span>{artFailed ? t.ui.artError : t.ui.slow}</span>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setAttempt((value) => value + 1)}
                    >
                      <RotateCcw size={15} />
                      {t.ui.retry}
                    </button>
                    {artReady && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => dispatch('LOADED')}
                      >
                        {t.ui.continueSilent}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {scene === 'permission' && (
              <div className="story-entry">
                {audio.failed && (
                  <span className="story-entry-error">{t.ui.musicError}</span>
                )}
                <div className="story-entry-buttons">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={audio.failed}
                    onClick={() => enter(true)}
                  >
                    <Volume2 size={18} />
                    {t.ui.enable}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => enter(false)}
                  >
                    <VolumeX size={16} />
                    {t.ui.silent}
                  </button>
                </div>
                <span className="story-entry-later">{t.ui.later}</span>
              </div>
            )}
            {scene === 'choice' && (
              <div className="choice-buttons">
                <button
                  type="button"
                  className="primary-button choice-button"
                  onClick={() => dispatch('OPEN')}
                >
                  {t.story.firstChoice.open}
                </button>
                <button
                  type="button"
                  className="primary-button choice-button"
                  onClick={refuseOffice}
                >
                  {t.story.firstChoice.refuse}
                </button>
              </div>
            )}
            {scene === 'refuse' && (
              <div className="choice-buttons">
                <button
                  type="button"
                  className="primary-button choice-button"
                  onClick={() => dispatch('OPEN')}
                >
                  {t.story.secondChoice.open}
                </button>
                <button
                  type="button"
                  className="primary-button choice-button"
                  onClick={() => dispatch('REFUSE')}
                >
                  {t.story.secondChoice.refuse}
                </button>
              </div>
            )}
            {scene === 'envelope' && (
              <button
                type="button"
                className="text-button open-letter"
                onClick={unseal}
              >
                {t.ui.openLetter}
              </button>
            )}
          </div>
        </section>
      )}
      {(scene === 'video' ||
        scene === 'gift-opening' ||
        scene === 'gift-rotate') && (
        <Celebration key={scene === 'video' ? 'video' : 'gift'} />
      )}
      {scene === 'letter-transition' && (
        <div className="letter-reveal-glow" aria-hidden="true">
          <Sparkles />
          <Heart />
          <Sparkles />
        </div>
      )}
    </main>
  );
}
