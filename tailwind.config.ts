import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        metal: {
          white: '#ffffff',
          off: '#fafafa',
          light: '#f0f0f0',
          mid: '#e0e0e0',
          text: '#888888',
          dark: '#333333',
          black: '#000000',
          near: '#111111',
          charcoal: '#1a1a1a',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
      },
      maxWidth: {
        shell: '1400px',
      },
      boxShadow: {
        metal: '0 20px 40px rgba(0, 0, 0, 0.15)',
        drawer: '-30px 0 80px rgba(0, 0, 0, 0.25)',
      },
      transitionTimingFunction: {
        metal: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        floatShape: {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(5deg)' },
        },
        rotateShape: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        pulseMetal: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.3' },
          '50%': { transform: 'scale(1.2)', opacity: '0.6' },
        },
        liquidFlow: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        liquidGradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        floatShape: 'floatShape 6s ease-in-out infinite',
        floatShapeSlow: 'floatShape 8s ease-in-out infinite reverse',
        rotateShape: 'rotateShape 10s linear infinite',
        pulseMetal: 'pulseMetal 4s ease-in-out infinite',
        liquidFlow: 'liquidFlow 8s ease-in-out infinite',
        liquidGradient: 'liquidGradient 8s ease infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
