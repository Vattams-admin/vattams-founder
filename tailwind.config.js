/** @type {import('tailwindcss').Config} */
// Design tokens for VATTAMS ACADEMIA.
// Palette pulled from the brand crest (deep navy + gold, on parchment) —
// not a generic AI-default palette. Serif display carries the "academy"
// authority; Inter carries body/data legibility.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1730',       // primary background, near-black navy
        navy: {
          DEFAULT: '#122A4E',
          light: '#1C3A66',
          dark: '#081120'
        },
        gold: {
          DEFAULT: '#C9A24B',
          bright: '#E8C877',
          muted: '#8A6F32'
        },
        parchment: '#F6F2E7',  // primary text on dark surfaces
        slate: {
          muted: '#93A1B8'
        },
        success: '#3F8F6F',
        danger: '#B5544A'
      },
      fontFamily: {
        display: ['"Fraunces"', 'ui-serif', 'Georgia', 'serif'],
        body: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '0.375rem'
      },
      boxShadow: {
        crest: '0 1px 0 0 rgba(201,162,75,0.35)'
      }
    }
  },
  plugins: []
}
