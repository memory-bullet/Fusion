import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#ffffff",
        ink: "#111827",
        muted: "#6b7280",
        line: "#e5e7eb",
        panel: "#f8fafc",
        warning: "#d97706",
        critical: "#dc2626",
        accent: "#2563eb"
      },
      borderRadius: {
        card: "14px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(17, 24, 39, 0.04)"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans SC", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
