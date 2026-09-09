'use client';
import { useEffect, useRef } from 'react';
import { ArrowRight, Gift, Heart, Sparkles } from 'lucide-react';
import config from '../config';
import type { Locale, Scene } from '@/lib/story';
import JujubeView from './jujube-view';

export default function JujubeGift({
  locale,
  scene,
  onOpen,
  onContinue,
  onPresented,
}: {
  locale: Locale;
  scene: Scene;
  onOpen: () => void;
  onContinue: () => void;
  onPresented: () => void;
}) {
  const t = config.locales[locale].gift;
  const closed = scene === 'gift';
  const leaving = scene === 'letter-transition';
  const index = scene.startsWith('gift-meaning')
    ? Number(scene.slice(-1))
    : leaving
      ? 2
      : -1;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);
  return (
    <div
      className={`gift-experience ${closed ? 'is-wrapped' : 'is-unwrapped'} ${leaving ? 'is-leaving' : ''}`}
    >
      <div className="gift-kicker">
        <span className="gift-kicker-line" aria-hidden="true" />
        <span className="gift-kicker-seal">{t.seal}</span>
        <span className="gift-kicker-copy">{t.kicker}</span>
        <span className="gift-kicker-line" aria-hidden="true" />
      </div>
      <div className="gift-visual">
        <div className="gift-halo" aria-hidden="true" />
        {closed ? (
          <button
            type="button"
            className="gift-box-button"
            onClick={onOpen}
            aria-label={t.open}
          >
            <div className="gift-sprite gift-sprite-lid">
              <img src={config.gift.artwork} alt="" draggable={false} />
            </div>
            <span className="gift-seal">
              <Heart size={20} fill="currentColor" />
            </span>
          </button>
        ) : (
          <>
            <div
              className="gift-open-lid gift-sprite gift-sprite-lid"
              aria-hidden="true"
            >
              <img src={config.gift.artwork} alt="" />
            </div>
            <JujubeView locale={locale} onPresented={onPresented} />
          </>
        )}
        <div className="gift-stars" aria-hidden="true">
          <Sparkles />
          <Sparkles />
          <Heart />
        </div>
      </div>
      {closed ? (
        <div className="gift-intro">
          <h2>{t.intro}</h2>
          <button type="button" className="primary-button" onClick={onOpen}>
            <Gift size={18} />
            {t.open}
            <ArrowRight size={17} />
          </button>
        </div>
      ) : index < 0 ? (
        <p className="gift-opening-copy" role="status">
          {t.opening}
        </p>
      ) : (
        <div className="gift-meaning" key={index}>
          <i className="gift-corner gift-corner-a" aria-hidden="true" />
          <i className="gift-corner gift-corner-b" aria-hidden="true" />
          <p className="gift-step-label">{t.steps[index].chapter}</p>
          <div
            className="gift-progress"
            aria-label={`${index + 1} / ${t.steps.length}`}
          >
            {t.steps.map((_, i) => (
              <span key={i} className={i <= index ? 'is-read' : ''} />
            ))}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {t.steps[index].title}
          </h2>
          <p>{t.steps[index].text}</p>
          <button
            type="button"
            className="primary-button"
            onClick={onContinue}
            disabled={leaving}
          >
            {t.steps[index].cta}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
