/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./src/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  presets: [require("nativewind/preset")],
  darkMode: "class", // toggled via colorScheme.set() from the theme pref (#33)
  theme: {
    extend: {
      colors: {
        // Editorial palette — mirrors frontend's kowloon theme.
        // Surface + text + field tokens are variable-driven (see global.css) so
        // they swap for light/dark automatically. Brand accents below stay
        // constant across modes.
        base: {
          100: "rgb(var(--color-base-100) / <alpha-value>)", // app background
          200: "rgb(var(--color-base-200) / <alpha-value>)", // card / sheet surface
          300: "rgb(var(--color-base-300) / <alpha-value>)", // hairline / placeholder
          content: "rgb(var(--color-base-content) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "#5588B1", // desaturated steel blue
          content: "#F4F5F7",
        },
        secondary: {
          DEFAULT: "#393B7A", // medium navy
          content: "#FAF4E8",
        },
        accent: {
          DEFAULT: "#C0394A", // vermillion
          content: "#F7E8E8",
        },
        success: {
          DEFAULT: "#2F9956",
          content: "#F0F8F2",
        },
        warning: {
          DEFAULT: "#D9B038",
          content: "#1A1A20",
        },
        error: {
          DEFAULT: "#C0394A",
          content: "#F7E8E8",
        },
        info: {
          DEFAULT: "#3C8DB8",
          content: "#F0F6FA",
        },
        // Post type accents (light defaults)
        post: {
          note: "#B76C00",
          article: "#006893",
          media: "#009084",
          link: "#417843",
          event: "#CC272E",
        },
        // Klein blue app header (white sans on Yves Klein blue)
        header: {
          DEFAULT: "#002FA7",
          content: "#FFFFFF",
        },
        // Text input / editor surface (variable-driven; see global.css)
        field: "rgb(var(--color-field) / <alpha-value>)",
      },
      fontFamily: {
        // Static chrome fonts — bundled via expo-font (see src/lib/typography.js).
        // `reading` is the editorial display serif used for headings; `ui` is
        // the sans used for labels, buttons, eyebrows. The user-selectable
        // *reading-body* font is applied via inline styles on reading surfaces
        // (post body, article view) through useTypography(), NOT these tokens.
        reading: ["lora-regular"],
        ui: ["inter-regular"],
        mono: ["monospace"],
      },
      borderRadius: {
        // Editorial = no pill shapes anywhere.
        none: "0",
        DEFAULT: "0",
      },
    },
  },
  plugins: [],
};
