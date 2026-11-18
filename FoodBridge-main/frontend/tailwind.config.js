/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Inter"', 'sans-serif'],
      },
      colors: {
        forest: {
          50: '#f2f7f3',
          100: '#e1ede4',
          200: '#c5dccb',
          300: '#9ec2a8',
          400: '#72a27f',
          500: '#4e845d',
          600: '#3c6b48',
          700: '#2d5237',
          800: '#26422e',
          900: '#1e3a2b',
          950: '#102018',
        },
        warm: {
          50: '#fafaf9',
          100: '#f4f6f0',
          200: '#e7ebe0',
          500: '#78716c',
          800: '#292524',
          900: '#1c1917',
        }
      }
    },
  },
  plugins: [],
}
