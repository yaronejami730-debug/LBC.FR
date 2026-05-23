/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#2f6fb8",
        "primary-dark": "#1a5a9e",
        surface: "#ffffff",
        "surface-container": "#f3f4f6",
        "surface-container-low": "#fafbfc",
        "on-surface": "#191c1e",
        "on-surface-variant": "#42474e",
        outline: "#777683",
        bargain: "#16a34a",
      },
    },
  },
  plugins: [],
};
