import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type HTMLMotionProps,
} from 'framer-motion';
import type { MouseEvent, PropsWithChildren } from 'react';

type SharedProps = {
  strength?: number;
};

type MagneticAnchorProps = PropsWithChildren<HTMLMotionProps<'a'> & SharedProps>;
type MagneticButtonProps = PropsWithChildren<HTMLMotionProps<'button'> & SharedProps>;

function useMagnetic(strength: number) {
  const shouldReduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 180, damping: 16, mass: 0.25 });
  const y = useSpring(rawY, { stiffness: 180, damping: 16, mass: 0.25 });

  const onMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (shouldReduceMotion || !window.matchMedia('(pointer: fine)').matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    rawX.set((event.clientX - rect.left - rect.width / 2) / strength);
    rawY.set((event.clientY - rect.top - rect.height / 2) / strength);
  };

  const onMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return { x, y, onMouseMove, onMouseLeave };
}

export function MagneticAnchor({ children, strength = 4, style, ...props }: MagneticAnchorProps) {
  const magnetic = useMagnetic(strength);

  return (
    <motion.a
      data-cursor="hover"
      {...props}
      style={{ ...style, x: magnetic.x, y: magnetic.y }}
      onMouseMove={(event) => {
        magnetic.onMouseMove(event);
        props.onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        magnetic.onMouseLeave();
        props.onMouseLeave?.(event);
      }}
    >
      {children}
    </motion.a>
  );
}

export function MagneticButton({ children, strength = 4, style, ...props }: MagneticButtonProps) {
  const magnetic = useMagnetic(strength);

  return (
    <motion.button
      data-cursor="hover"
      {...props}
      style={{ ...style, x: magnetic.x, y: magnetic.y }}
      onMouseMove={(event) => {
        magnetic.onMouseMove(event);
        props.onMouseMove?.(event);
      }}
      onMouseLeave={(event) => {
        magnetic.onMouseLeave();
        props.onMouseLeave?.(event);
      }}
    >
      {children}
    </motion.button>
  );
}
