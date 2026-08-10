/** @type {import('tailwindcss').Config} */
// Single source of truth for the palette — shared with the web frontend.
const palette = require("@kowloon/client/theme/palette.json");
const L = palette.light;
// Tokens that differ between light and dark are variable-driven (their runtime
// values are set by ThemeContext's vars() from this same palette). The rest are
// constant across modes, so they read straight from palette.light.
const v = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

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
        // From the shared palette (@kowloon/client/theme/palette.json).
        // Variable-driven tokens swap light/dark; constant tokens read light.
        base: {
          100: v("base-100"), // app background
          200: v("base-200"), // card / sheet surface
          300: v("base-300"), // hairline / placeholder
          content: v("base-content"),
        },
        field: v("field"), // text input / editor surface
        primary: { DEFAULT: L.primary, content: v("primary-content") },
        secondary: { DEFAULT: L.secondary, content: L["secondary-content"] },
        accent: { DEFAULT: L.accent, content: L["accent-content"] },
        neutral: { DEFAULT: v("neutral"), content: L["neutral-content"] },
        success: { DEFAULT: L.success, content: L["success-content"] },
        warning: { DEFAULT: L.warning, content: L["warning-content"] },
        error: { DEFAULT: L.error, content: L["error-content"] },
        info: { DEFAULT: L.info, content: L["info-content"] },
        // Post type accents (brighten in dark via the palette)
        post: {
          note: v("post-note"),
          article: v("post-article"),
          media: v("post-media"),
          link: v("post-link"),
          event: v("post-event"),
        },
        // Klein blue app header (constant across modes)
        header: { DEFAULT: L.header, content: L["header-content"] },
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
