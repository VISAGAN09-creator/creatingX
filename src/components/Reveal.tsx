import { motion, type HTMLMotionProps } from 'framer-motion';
import type { PropsWithChildren } from 'react';
import { useNavigationExperience } from '../hooks/useNavigationExperience';

type RevealProps = PropsWithChildren<HTMLMotionProps<'div'> & { delay?: number }>;

export function Reveal({ children, delay = 0, ...props }: RevealProps) {
  const navigationType = useNavigationExperience();

  return (
    <motion.div
      initial={navigationType === 'traverse' ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18, margin: '0px 0px -50px 0px' }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
