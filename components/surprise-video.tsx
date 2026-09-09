'use client';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Heart, LoaderCircle, Play, RotateCcw, Sparkles } from 'lucide-react';
import config from '../config';
import type { Locale } from '@/lib/story';

export type SurpriseVideoHandle = { start: () => void };
type Props = {
  ref: Ref<SurpriseVideoHandle>;
  locale: Locale;
  revealed: boolean;
  leaving: boolean;
  initialMuted: boolean;
  onPlayback: (playing: boolean) => void;
  onEnded: () => void;
  onSkip: () => void;
};

export default function SurpriseVideo({
  ref,
  locale,
  revealed,
  leaving,
  initialMuted,
  onPlayback,
  onEnded,
  onSkip,
}: Props) {
  const media = useRef<HTMLVideoElement>(null),
    request = useRef({ id: 0 }),
    done = useRef(false);
  const [muted] = useState(initialMuted),
    [failed, setFailed] = useState(false),
    [needsPlay, setNeedsPlay] = useState(false),
    [waiting, setWaiting] = useState(false),
    [slow, setSlow] = useState(false);
  const t = config.locales[locale];

  useEffect(() => {
    const attempts = request.current;
    const element = media.current;
    if (element) element.src = config.video.src;
    return () => {
      attempts.id++;
      if (element) {
        element.pause();
        element.removeAttribute('src');
        element.load();
      }
    };
  }, []);
  useEffect(() => {
    if (!revealed || leaving) return;
    media.current?.focus({ preventScroll: true });
  }, [revealed, leaving]);
  useEffect(() => {
    if (!waiting || leaving) return;
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [waiting, leaving]);

  const start = useCallback(() => {
    const element = media.current;
    if (!element || done.current) return;
    const attempt = ++request.current.id;
    setNeedsPlay(false);
    setWaiting(true);
    setSlow(false);
    onPlayback(true);
    void element.play().catch((error: unknown) => {
      if (attempt !== request.current.id || done.current) return;
      setWaiting(false);
      onPlayback(false);
      if (error instanceof Error && error.name === 'NotSupportedError')
        setFailed(true);
      else setNeedsPlay(true);
    });
  }, [onPlayback]);
  useImperativeHandle(ref, () => ({ start }), [start]);

  const retry = () => {
    if (done.current) return;
    request.current.id++;
    setFailed(false);
    media.current?.load();
    start();
  };
  const finish = (skip = false) => {
    if (done.current) return;
    done.current = true;
    request.current.id++;
    const element = media.current;
    element?.pause();
    onPlayback(false);
    if (element && document.fullscreenElement === element)
      void document.exitFullscreen().catch(() => {});
    const native = element as
      | (HTMLVideoElement & {
          webkitDisplayingFullscreen?: boolean;
          webkitExitFullscreen?: () => void;
        })
      | null;
    if (native?.webkitDisplayingFullscreen) native.webkitExitFullscreen?.();
    if (skip) onSkip();
    else onEnded();
  };

  return (
    <div
      className={`surprise-video ${revealed ? 'is-revealed' : ''} ${leaving ? 'is-leaving' : ''}`}
      aria-label={revealed ? t.ui.videoLabel : undefined}
      aria-hidden={!revealed || leaving}
      inert={!revealed || leaving}
    >
      <div className="video-glow" aria-hidden="true" />
      <div className="video-card">
        <div className="video-sparkles" aria-hidden="true">
          <Sparkles />
          <Heart />
          <Sparkles />
          <Heart />
        </div>
        <div className="video-frame">
          {/* The supplied video has no accompanying caption file. */}
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={media}
            aria-label={t.ui.videoLabel}
            controls={revealed}
            playsInline
            muted={muted}
            preload="auto"
            tabIndex={revealed ? 0 : -1}
            onLoadedMetadata={() => {
              const element = media.current;
              if (
                element &&
                element.paused &&
                element.currentTime === 0 &&
                element.duration > 0
              )
                element.currentTime = Math.min(0.01, element.duration / 2);
            }}
            onPlay={() => {
              if (done.current) {
                media.current?.pause();
                return;
              }
              setNeedsPlay(false);
              onPlayback(true);
            }}
            onPlaying={() => {
              setWaiting(false);
              setSlow(false);
              setFailed(false);
            }}
            onWaiting={() => {
              if (!media.current?.paused) setWaiting(true);
            }}
            onPause={() => {
              setWaiting(false);
              setSlow(false);
              onPlayback(false);
            }}
            onEnded={() => finish()}
            onError={() => {
              if (done.current) return;
              request.current.id++;
              setFailed(true);
              setWaiting(false);
              onPlayback(false);
            }}
          />
          {revealed &&
            (failed ? (
              <output className="video-overlay video-error">
                <Heart size={28} />
                <span>{t.ui.videoError}</span>
              </output>
            ) : needsPlay ? (
              <div className="video-overlay">
                <button
                  type="button"
                  className="primary-button video-play-button"
                  onClick={start}
                >
                  <Play size={20} fill="currentColor" />
                  {t.ui.videoPlay}
                </button>
              </div>
            ) : (
              waiting && (
                <output className="video-buffering">
                  <LoaderCircle size={24} />
                  <span>{t.ui.videoLoading}</span>
                </output>
              )
            ))}
        </div>
        {revealed && (failed || slow || needsPlay) && (
          <div className="video-followup" aria-live="polite">
            <p>{failed ? t.ui.videoError : t.ui.videoSlow}</p>
            {(slow || failed) && (
              <button type="button" className="text-button" onClick={retry}>
                <RotateCcw size={16} />
                {t.ui.retry}
              </button>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => finish(true)}
            >
              {t.ui.videoContinue}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
