'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

type Particle = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  phase: number;
  radius: number;
  color: number;
};

const colors = ['#fff4cf', '#f0c36f', '#d88a42'];

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 91.733 + salt * 37.119) * 43758.5453;
  return value - Math.floor(value);
}

export default function ParticleWelcome({ emojis }: { emojis: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    let frame = 0;
    let particles: Particle[] = [];
    let startedAt = performance.now();
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const draw = (now: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      context.clearRect(0, 0, width, height);
      const elapsed = now - startedAt;
      const progress = reduceMotion
        ? 1
        : Math.min(1, Math.max(0, (elapsed - 140) / 1500));
      const eased = 1 - Math.pow(1 - progress, 4);

      for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
        context.beginPath();
        for (const particle of particles) {
          if (particle.color !== colorIndex) continue;
          const shimmer = reduceMotion
            ? 0
            : Math.sin(now * 0.0018 + particle.phase) * 0.65;
          const x = particle.sx + (particle.tx - particle.sx) * eased + shimmer;
          const y =
            particle.sy +
            (particle.ty - particle.sy) * eased +
            Math.cos(now * 0.0015 + particle.phase) * 0.45;
          context.moveTo(x + particle.radius, y);
          context.arc(x, y, particle.radius, 0, Math.PI * 2);
        }
        context.fillStyle = colors[colorIndex];
        context.shadowColor = colors[colorIndex];
        context.shadowBlur = colorIndex === 0 ? 7 : 4;
        context.fill();
      }
      context.shadowBlur = 0;
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    const rebuild = () => {
      cancelAnimationFrame(frame);
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(260, Math.round(bounds.width));
      const height = Math.max(190, Math.round(bounds.height));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      const stencil = document.createElement('canvas');
      stencil.width = width;
      stencil.height = height;
      const stencilContext = stencil.getContext('2d', {
        willReadFrequently: true,
      });
      if (!stencilContext) return;

      const fontSize = Math.min(66, Math.max(31, width / 9.15));
      stencilContext.fillStyle = '#fff';
      stencilContext.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
      stencilContext.textAlign = 'center';
      stencilContext.textBaseline = 'middle';
      stencilContext.fillText('HAPPY', width / 2, height * 0.38);
      stencilContext.fillText("TEACHER'S DAY", width / 2, height * 0.64);

      const pixels = stencilContext.getImageData(0, 0, width, height).data;
      const points: { x: number; y: number }[] = [];
      const step = width < 420 ? 4 : 5;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          if (pixels[(y * width + x) * 4 + 3] > 120) points.push({ x, y });
        }
      }

      const stride = Math.max(1, Math.ceil(points.length / 1300));
      particles = [];
      for (
        let pointIndex = 0;
        pointIndex < points.length;
        pointIndex += stride
      ) {
        const point = points[pointIndex];
        const particleIndex = particles.length;
        const edge = particleIndex % 4;
        const along = seeded(particleIndex, 2);
        const start =
          edge === 0
            ? { x: along * width, y: -18 }
            : edge === 1
              ? { x: width + 18, y: along * height }
              : edge === 2
                ? { x: along * width, y: height + 18 }
                : { x: -18, y: along * height };
        particles.push({
          sx: start.x,
          sy: start.y,
          tx: point.x,
          ty: point.y,
          phase: seeded(particleIndex, 3) * Math.PI * 2,
          radius: 0.8 + seeded(particleIndex, 4) * 1.25,
          color: particleIndex % colors.length,
        });
      }
      startedAt = performance.now();
      draw(startedAt);
    };

    const observer = new ResizeObserver(rebuild);
    observer.observe(canvas);
    rebuild();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      particles = [];
    };
  }, []);

  return (
    <>
      <div className="emoji-marquee" aria-hidden="true">
        {emojis.map((emoji, index) => (
          <span
            className="emoji-marquee-item"
            key={`${emoji}-${index}`}
            style={{ '--marquee-index': index } as CSSProperties}
          >
            <i>{emoji}</i>
          </span>
        ))}
      </div>
      <div className="particle-poster">
        <span className="particle-poster-corner corner-one" />
        <span className="particle-poster-corner corner-two" />
        <canvas
          ref={canvasRef}
          className="particle-wordmark"
          role="img"
          aria-label="Happy Teacher's Day"
        />
        <div className="particle-ornament" aria-hidden="true">
          <span />
          <b>09 · 10</b>
          <span />
        </div>
      </div>
    </>
  );
}
