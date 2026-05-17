/** @type {import('tailwindcss').Config} */
// Design tokens lifted from the Figma "AI Multi-agent" file.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f7f9',
        ink: '#222222',
        brand: {
          DEFAULT: '#4f46e5', // indigo/600
          dark: '#3730a3', // indigo/800 (table head)
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
        },
        risk: {
          high: '#dc2626',
          highAlt: '#e11d48',
          medium: '#f97316',
          low: '#16a34a',
        },
        ok: { DEFAULT: '#16a34a', dark: '#15803d', bg: '#dcfce7' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        brand: ['Montserrat', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '30px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,0.04), 0 1px 3px 0 rgba(16,24,40,0.06)',
        danger: '0px 4px 4px 0px rgba(173,49,51,0.18)',
      },
    },
  },
  plugins: [],
};
