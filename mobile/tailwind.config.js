/** @type {import('tailwindcss').Config} */
// Palette bicolore Deal&Company — miroir de lib/theme.ts. Bleu + blanc seulement.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1046D6",
        "primary-dark": "#0C36A8",
        "primary-light": "#E8EEFC",
        navy: "#0B1E4D",

        surface: "#ffffff",
        app: "#f7f8fa",
        "surface-container": "#f1f2f5",
        "surface-container-low": "#f7f8fa",

        "on-surface": "#101a33",
        "on-surface-variant": "#6b7488",
        outline: "#98a0b3",
        line: "#e4e7ec",

        bargain: "#2e9e8f",
        success: "#2e9e8f",
        danger: "#d6432f",
      },
      borderRadius: {
        card: "22px",
        sheet: "28px",
      },
    },
  },
  plugins: [],
};
