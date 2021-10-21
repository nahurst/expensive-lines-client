module.exports = {
  purge: [
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './_posts/*.md',
    './*.html',
  ],
  darkMode: false,
  theme: {
    extend: {
      fontFamily: {
        'tenor-sans': ['"Tenor Sans"', 'sans-serif']
      }
    },
  },
  variants: {
  },
  plugins: [
  ],
}