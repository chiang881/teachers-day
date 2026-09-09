'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import config from '../config';
import type { Locale } from '@/lib/story';
import type { createJujubeViewer } from '@/lib/jujube-viewer';

export default function JujubeView({
  locale,
  onPresented,
}: {
  locale: Locale;
  onPresented: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<ReturnType<typeof createJujubeViewer> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>(
    'loading',
  );
  const [spinning, setSpinning] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const t = config.locales[locale].gift;
  useEffect(() => {
    if (status !== 'loading') onPresented();
  }, [status, onPresented]);
  useEffect(() => {
    let active = true;
    let failed = false;
    const fail = () => {
      if (!active) return;
      failed = true;
      viewer.current?.dispose();
      viewer.current = null;
      setStatus('failed');
    };
    const timeout = setTimeout(fail, 8000);
    setStatus('loading');
    // Import the 3D engine only after the gift is opened.
    void import('@/lib/jujube-viewer')
      .then(({ createJujubeViewer }) => {
        if (!active || failed || !host.current) return;
        viewer.current = createJujubeViewer(host.current, {
          model: config.gift.model,
          onReady: () => {
            clearTimeout(timeout);
            if (active) setStatus('ready');
          },
          onError: () => {
            clearTimeout(timeout);
            fail();
          },
        });
      })
      .catch((error) => {
        console.error('Unable to start the red-date viewer.', error);
        clearTimeout(timeout);
        fail();
      });
    return () => {
      active = false;
      clearTimeout(timeout);
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [attempt]);
  useEffect(() => {
    viewer.current?.setSpinning(spinning);
  }, [spinning, status]);
  return (
    <div className={`jujube-view is-${status}`}>
      <div
        ref={host}
        className="jujube-canvas"
        role="img"
        aria-label={t.modelLabel}
        tabIndex={status === 'ready' ? 0 : -1}
      />
      {status !== 'ready' && (
        <div className="jujube-fallback" role="status">
          <div className="gift-sprite gift-sprite-base">
            <img src={config.gift.artwork} alt="" />
          </div>
          <p>{status === 'loading' ? t.loading : t.unavailable}</p>
          {status === 'failed' && (
            <button
              type="button"
              className="text-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              <RotateCcw size={15} />
              {config.locales[locale].ui.retry}
            </button>
          )}
        </div>
      )}
      {status === 'ready' && (
        <div className="jujube-controls">
          <button
            type="button"
            onClick={() => setSpinning((value) => !value)}
            aria-label={spinning ? t.pauseRotation : t.resumeRotation}
            aria-pressed={spinning}
          >
            {spinning ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      )}
    </div>
  );
}
