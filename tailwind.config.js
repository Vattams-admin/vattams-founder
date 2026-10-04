/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050B17',
        navy: {
          DEFAULT: '#0B1426',
          light: '#13233C',
          dark: '#07111F'
        },
        azure: {
          DEFAULT: '#3B82F6',
          bright: '#67E8F9',
          dark: '#1D4ED8'
        },
        gold: {
          DEFAULT: '#C9A24B',
          bright: '#E8C877',
          muted: '#8A6F32'
        },
        parchment: '#F4F7FC',
        slate: {
          muted: '#9AA9BF'
        },
        success: '#34D399',
        danger: '#FB7185'
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '0.875rem'
      },
      boxShadow: {
        glow: '0 20px 65px rgba(37,99,235,.16), 0 0 32px rgba(34,211,238,.06)'
      }
    }
  },
  plugins: []
}
