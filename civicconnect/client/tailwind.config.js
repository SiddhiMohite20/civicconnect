export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: { glow: '0 8px 30px -10px rgba(34,211,238,.55)' },
      colors: {
        ink: { 700: '#16233f', 800: '#0f1a30', 900: '#0a1222', 950: '#050b17' },
        // Inverted scale: existing "slate-50 … slate-900" classes now give dark surfaces / light text
        slate: {
          50: '#0a1222', 100: '#0f1a30', 200: '#1b2a47', 300: '#2b3d61', 400: '#6f84ab',
          500: '#8fa3c7', 600: '#aebbd8', 700: '#c9d3e8', 800: '#e0e7f4', 900: '#f1f5fb', 950: '#ffffff',
        },
        // "blue" is remapped to the cyan brand accent
        blue: { 50: '#0b2733', 100: '#0e3444', 200: '#155e75', 500: '#06b6d4', 600: '#22d3ee', 700: '#67e8f9', 800: '#a5f3fc' },
        red: { 50: '#2a0f16', 100: '#3b1220', 200: '#7f1d2d', 600: '#f43f5e', 700: '#fb7185', 800: '#fda4af' },
        green: { 50: '#0b2a20', 200: '#14532d', 600: '#34d399', 700: '#6ee7b7', 800: '#a7f3d0', 900: '#d1fae5' },
        amber: { 50: '#2b2008', 200: '#78560f', 900: '#fde68a' },
        orange: { 50: '#2d1708', 700: '#fdba74' },
      },
    },
  },
  plugins: [],
};