import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-monospace", "monospace"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        bg: "var(--bg)",
        "bg-elev": "var(--bg-elev)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--line)",
        "line-bright": "var(--line-bright)",
        text: "var(--text)",
        "text-dim": "var(--text-dim)",
        "text-faint": "var(--text-faint)",
        lime: "var(--lime)",
        "lime-dim": "var(--lime-dim)",
        amber: "var(--amber)",
        red: "var(--red)",
        cyan: "var(--cyan)",
      },
    },
  },
  plugins: [],
};

export default config;
