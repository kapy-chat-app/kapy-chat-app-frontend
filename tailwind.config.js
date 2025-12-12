// tailwind.config.js - SỬA LẠI
/** @type {import('tailwindcss').Config} */
module.exports = {
  // Thêm path đến app folder
  content: [
    "./App.tsx", 
    "./app/**/*.{js,jsx,ts,tsx}",  // Thêm dòng này!
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
}