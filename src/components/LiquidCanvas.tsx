import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export function LiquidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    let width = 0;
    let height = 0;
    let time = 0;
    let animationFrame = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const gradient = context.createRadialGradient(
        width * 0.5 + Math.sin(time * 0.5) * 100,
        height * 0.5 + Math.cos(time * 0.3) * 100,
        0,
        width * 0.5,
        height * 0.5,
        width * 0.8,
      );

      gradient.addColorStop(0, 'rgba(200, 200, 200, 0.06)');
      gradient.addColorStop(0.5, 'rgba(150, 150, 150, 0.03)');
      gradient.addColorStop(1, 'rgba(100, 100, 100, 0.01)');

      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);

      for (let i = 0; i < 5; i += 1) {
        context.beginPath();
        context.strokeStyle = `rgba(180, 180, 180, ${0.02 + i * 0.005})`;
        context.lineWidth = 1;

        for (let x = 0; x < width; x += 5) {
          const y =
            height * 0.3 +
            i * 80 +
            Math.sin(x * 0.003 + time + i) * 50 +
            Math.sin(x * 0.007 + time * 0.5) * 30;

          if (x === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }

        context.stroke();
      }

      if (!shouldReduceMotion) {
        time += 0.01;
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [shouldReduceMotion]);

  return <canvas ref={canvasRef} className="liquid-canvas" aria-hidden="true" />;
}
