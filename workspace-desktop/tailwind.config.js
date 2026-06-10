import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-canvas)",
        sidebar: "var(--color-sidebar)",
        accent: "var(--color-accent)",
        panel: "var(--color-panel)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
      },
      fontFamily: {
        sans: ["var(--font-ui)"],
        mono: ["var(--font-mono)"],
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
        statusbar: "var(--statusbar-height)",
      },
    },
  },
  plugins: [typography],
};
