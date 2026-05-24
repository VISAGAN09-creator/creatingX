import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { useEffect, useState } from 'react';

const interactiveSelector =
  'a, button, input, textarea, select, label, [role="button"], [data-cursor="hover"]';

function supportsFinePointer() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

export function CustomCursor() {
  const shouldReduceMotion = useReducedMotion();
  const mouseX = useMotionValue(-40);
  const mouseY = useMotionValue(-40);
  const cursorX = useSpring(mouseX, { stiffness: 260, damping: 28, mass: 0.35 });
  const cursorY = useSpring(mouseY, { stiffness: 260, damping: 28, mass: 0.35 });
  const [enabled, setEnabled] = useState(false);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (shouldReduceMotion) {
      setEnabled(false);
      return undefined;
    }

    const media = window.matchMedia('(pointer: fine)');
    const updateEnabled = () => setEnabled(media.matches);

    updateEnabled();
    media.addEventListener('change', updateEnabled);

    return () => media.removeEventListener('change', updateEnabled);
  }, [shouldReduceMotion]);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      setHovering(false);
      return undefined;
    }

    const findInteractive = (target: EventTarget | null) =>
      target instanceof Element ? target.closest(interactiveSelector) : null;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX.set(event.clientX);
      mouseY.set(event.clientY);
      setVisible(true);
    };

    const handlePointerOver = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      if (findInteractive(event.target)) setHovering(true);
    };

    const handlePointerOut = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      const from = findInteractive(event.target);
      if (!from) return;

      const to = findInteractive(event.relatedTarget);
      if (from !== to) setHovering(false);
    };

    const handleMouseLeave = () => {
      setVisible(false);
      setHovering(false);
    };

    const handleWindowOut = (event: MouseEvent) => {
      if (!event.relatedTarget) handleMouseLeave();
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('pointerover', handlePointerOver, { passive: true });
    document.addEventListener('pointerout', handlePointerOut, { passive: true });
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mouseout', handleWindowOut);
    window.addEventListener('blur', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('pointerover', handlePointerOver);
      document.removeEventListener('pointerout', handlePointerOut);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mouseout', handleWindowOut);
      window.removeEventListener('blur', handleMouseLeave);
    };
  }, [enabled, mouseX, mouseY]);

  if (!enabled || !supportsFinePointer()) return null;

  return (
    <>
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[9999] h-5 w-5 rounded-full border-2 border-white mix-blend-difference"
        animate={{
          opacity: visible ? 1 : 0,
          scale: hovering ? 2.5 : 1,
          backgroundColor: hovering ? '#ffffff' : 'rgba(255, 255, 255, 0)',
          borderColor: hovering ? 'rgba(255, 255, 255, 0)' : '#ffffff',
        }}
        style={{
          x: cursorX,
          y: cursorY,
          marginLeft: -10,
          marginTop: -10,
          transformOrigin: '50% 50%',
        }}
        transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[10000] h-1.5 w-1.5 rounded-full bg-white mix-blend-difference"
        animate={{ opacity: visible ? 1 : 0, scale: hovering ? 0 : 1 }}
        style={{
          x: mouseX,
          y: mouseY,
          marginLeft: -3,
          marginTop: -3,
          transformOrigin: '50% 50%',
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />
    </>
  );
}
