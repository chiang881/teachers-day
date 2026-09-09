'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION = 2000;

export default function Celebration() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(false);
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      setVisible(false);
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(devicePixelRatio, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);

    const colors = ['#cc603e', '#eabb52', '#91aa79', '#e7a29a', '#c2914d'];
    const particles = Array.from({ length: 100 }, (_, index) => ({
      x: index % 3 === 0 ? Math.random() * width : index % 3 === 1 ? 0 : width,
      y: index % 3 === 0 ? -20 : height * 0.28,
      vx:
        index % 3 === 0
          ? (Math.random() - 0.5) * 4
          : (index % 3 === 1 ? 1 : -1) * (2 + Math.random() * 6),
      vy: -3 - Math.random() * 6,
      size: 4 + Math.random() * 6,
      rotation: Math.random() * 6,
      color: colors[index % colors.length],
      kind: index % 5,
    }));
    let frame = 0;
    let start = 0;
    let previous = 0;
    let released = false;

    const release = () => {
      if (released) return;
      released = true;
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, width, height);
      canvas.width = 0;
      canvas.height = 0;
    };
    const draw = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      const delta = previous ? Math.min(2, (time - previous) / 16.67) : 1;
      previous = time;
      context.clearRect(0, 0, width, height);
      context.globalAlpha = Math.min(1, (DURATION - elapsed) / 500);
      for (const particle of particles) {
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.vy += 0.13 * delta;
        particle.rotation += 0.03 * delta;
        context.save();
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        if (particle.kind === 0) {
          context.beginPath();
          for (let point = 0; point < 10; point++) {
            const radius = point % 2 ? particle.size * 0.4 : particle.size;
            const angle = (point * Math.PI) / 5;
            context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
          }
          context.closePath();
          context.fill();
        } else if (particle.kind === 1) {
          context.beginPath();
          context.moveTo(0, particle.size * 0.6);
          context.bezierCurveTo(
            -particle.size * 1.5,
            -particle.size * 0.3,
            -particle.size * 0.6,
            -particle.size * 1.3,
            0,
            -particle.size * 0.5,
          );
          context.bezierCurveTo(
            particle.size * 0.6,
            -particle.size * 1.3,
            particle.size * 1.5,
            -particle.size * 0.3,
            0,
            particle.size * 0.6,
          );
          context.fill();
        } else {
          context.fillRect(
            -particle.size / 2,
            -particle.size / 2,
            particle.size,
            particle.size * 0.4,
          );
        }
        context.restore();
      }
      if (elapsed < DURATION) frame = requestAnimationFrame(draw);
      else {
        release();
        setVisible(false);
      }
    };

    frame = requestAnimationFrame(draw);
    return release;
  }, []);

  return visible ? (
    <canvas ref={canvasRef} className="confetti" aria-hidden="true" />
  ) : null;
}
