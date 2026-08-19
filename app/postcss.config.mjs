/**
 * Tailwind v4 runs as a PostCSS plugin; there is no tailwind.config.js in v4 —
 * the theme lives in @theme inside src/app/globals.css.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
