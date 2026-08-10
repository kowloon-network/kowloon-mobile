const js = require("@eslint/js");
const globals = require("globals");
module.exports = [
  {
    files: ["src/**/*.{js,jsx}", "app/**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals["react-native"],
        React: "readonly",
        JSX: "readonly",
        __DEV__: "readonly",
        process: "readonly",
      },
    },
    rules: { "no-undef": "error" },
  },
];
