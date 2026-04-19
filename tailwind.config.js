/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#1e40af",
        secondary: "#db2777",
        dark: "#0f172a",
        light: "#f8fafc"
      }
    },
  },
  plugins: [],
}
