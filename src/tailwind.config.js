// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.html", // This tells Tailwind to scan all HTML files in src/
    "./src/**/*.ts",   // This tells Tailwind to scan all TypeScript files in src/
    "./dist/**/*.js",  // <--- FIX: This line is now active to scan compiled JS files.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}