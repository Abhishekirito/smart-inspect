/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff', 100: '#d9ecff', 200: '#bcdcff', 300: '#8ec5ff',
          400: '#59a3ff', 500: '#3480ff', 600: '#1f5ff5', 700: '#184ae1',
          800: '#1a3db6', 900: '#1b378f', 950: '#152257',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
