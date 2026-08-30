/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{js,jsx}',
    './src/components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14161C',
          soft: '#1E2129',
          line: '#2B2F3A',
        },
        parchment: {
          DEFAULT: '#FAF6EF',
          soft: '#F1EADD',
          line: '#E4D9C4',
        },
        gold: {
          DEFAULT: '#B8863B',
          soft: '#D9B978',
          deep: '#8C6528',
        },
        sage: {
          DEFAULT: '#5F7A63',
          soft: '#7C9781',
        },
        bordeaux: {
          DEFAULT: '#7A2E3A',
          soft: '#9C4552',
        },
        mist: '#8B8F99',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      backgroundImage: {
        'ledger-rule':
          'repeating-linear-gradient(to bottom, transparent, transparent 27px, currentColor 27px, currentColor 28px)',
      },
    },
  },
  plugins: [],
};
