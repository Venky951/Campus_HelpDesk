/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./views/**/*.ejs", "./public/**/*.html"],
  safelist: [
    {
      pattern:
        /^(?:bg|text|hover:bg|hover:text)-(?:red|indigo|green|gray)-\d{3}$/,
    },
    "text-white",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
