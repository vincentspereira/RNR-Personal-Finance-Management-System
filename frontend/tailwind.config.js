/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Legacy palette (kept for backwards-compat in already-styled components)
        navy: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
        },
        accent: '#3b82f6',
        income: '#22c55e',
        expense: '#ef4444',

        // Token colours wired to CSS variables — these are what new code should use.
        // Usage: bg-primary, bg-secondary, bg-tertiary, text-primary, text-muted, border-default.
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
      },
      backgroundColor: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        tertiary: 'var(--bg-tertiary)',
        input: 'var(--bg-input)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-muted)',
      },
      borderColor: {
        default: 'var(--border-primary)',
        input: 'var(--border-input)',
      },
    },
  },
  plugins: [],
};
