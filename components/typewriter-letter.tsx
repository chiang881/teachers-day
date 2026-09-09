'use client';
import { useEffect, useMemo, useState } from 'react';

type Segment = { kind: 'heading' | 'paragraph' | 'signature'; text: string };
type Props = { greeting: string; paragraphs: string[]; signature: string };

function splitCharacters(text: string) {
  return Array.from(text);
}

export default function TypewriterLetter({
  greeting,
  paragraphs,
  signature,
}: Props) {
  const segments = useMemo<Segment[]>(
    () => [
      { kind: 'heading', text: greeting },
      ...paragraphs.map((text) => ({ kind: 'paragraph' as const, text })),
      { kind: 'signature', text: signature },
    ],
    [greeting, paragraphs, signature],
  );
  const segmentCharacters = useMemo(
    () => segments.map((segment) => splitCharacters(segment.text)),
    [segments],
  );
  const characters = useMemo(
    () => segmentCharacters.flat(),
    [segmentCharacters],
  );
  const ends = useMemo(
    () =>
      segmentCharacters.reduce<number[]>(
        (all, letters) => [...all, (all.at(-1) ?? 0) + letters.length],
        [],
      ),
    [segmentCharacters],
  );
  const [visible, setVisible] = useState(0),
    [reduceMotion, setReduceMotion] = useState(false);
  const shown = reduceMotion
    ? characters.length
    : Math.min(visible, characters.length);

  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reduceMotion || visible >= characters.length) return;
    const previous = visible === 0 ? '' : characters[visible - 1];
    const delay =
      visible === 0
        ? 180
        : ends.includes(visible)
          ? 520
          : /[。！？.!?]/u.test(previous)
            ? 220
            : /[，、,;；：:]/u.test(previous)
              ? 115
              : 28;
    const timer = window.setTimeout(
      () => setVisible((current) => Math.min(current + 1, characters.length)),
      delay,
    );
    return () => clearTimeout(timer);
  }, [characters, ends, reduceMotion, visible]);

  let consumed = 0;
  return (
    <>
      {segments.map((segment, index) => {
        const letters = segmentCharacters[index];
        const count = Math.max(0, Math.min(letters.length, shown - consumed));
        const typing =
          !reduceMotion &&
          shown >= consumed &&
          shown < consumed + letters.length;
        consumed += letters.length;
        const value = letters.slice(0, count).join('');
        const cursor = typing && (
          <span className="typing-cursor" aria-hidden="true" />
        );
        if (segment.kind === 'heading')
          return (
            <h1
              key="greeting"
              className="typing-heading"
              aria-label={segment.text}
            >
              {value}
              {cursor}
            </h1>
          );
        if (!value && !typing) return null;
        if (segment.kind === 'signature')
          return (
            <p
              key="signature"
              className="signature typing-signature"
              aria-label={segment.text}
            >
              {value}
              {cursor}
            </p>
          );
        return (
          <p key={index} className="typing-paragraph" aria-label={segment.text}>
            {value}
            {cursor}
          </p>
        );
      })}
    </>
  );
}
