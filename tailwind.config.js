/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        glass: 'var(--glass)',
        border: 'var(--border)',
        'border-hi': 'var(--border-hi)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        'muted-dim': 'var(--muted-dim)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hi)',
          soft: 'var(--primary-soft)',
        },
        blue: 'var(--blue)',
        mint: {
          DEFAULT: 'var(--mint)',
          soft: 'var(--mint-soft)',
        },
        amber: 'var(--amber)',
        rose: 'var(--rose)',
        subject: {
          1: 'var(--color-sub-1)',
          2: 'var(--color-sub-2)',
          3: 'var(--color-sub-3)',
          4: 'var(--color-sub-4)',
          5: 'var(--color-sub-5)',
          6: 'var(--color-sub-6)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        hero: 'var(--radius-hero)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
        card: '0 8px 24px rgba(0, 0, 0, 0.5)',
        cta: '0 8px 24px rgba(124, 92, 255, 0.32)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0, 0, 0.2, 1)',
      }
    },
  },
  plugins: [],
}
