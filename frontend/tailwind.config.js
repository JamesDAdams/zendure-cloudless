/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F1117',
        surface: '#1A1D26',
        'surface-high': '#272A33',
        primary: '#00D4AA',
        'primary-dim': '#28DFB5',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
