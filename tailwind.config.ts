import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0A0F1E",
        gold: "#D4920A",
        emerald: "#059669",
        rose: "#E11D48",
        surface: "#FFFFFF",
        "surface-secondary": "#F8F9FC",
        "surface-tertiary": "#F1F3F9",
        border: "#E5E7EB",
        "border-light": "#F1F3F9",
        "text-primary": "#111827",
        "text-secondary": "#6B7280",
        "text-tertiary": "#9CA3AF",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "card": "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "gold": "0 4px 14px rgba(212,146,10,0.15)",
        "lg-soft": "0 10px 30px rgba(0,0,0,0.06)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-right": "slideInRight 0.4s cubic-bezier(0.16,1,0.3,1)",
        "slide-in-left": "slideInLeft 0.3s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        "pulse-gold": "pulseGold 2s infinite",
        "shimmer": "shimmer 2s linear infinite",
        "bounce-soft": "bounceSoft 0.5s cubic-bezier(0.34,1.56,0.64,1)",
        "count-up": "countUp 0.6s ease-out",
        "stagger-1": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both",
        "stagger-2": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s both",
        "stagger-3": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.15s both",
        "stagger-4": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.2s both",
        "stagger-5": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s both",
        "stagger-6": "slideUp 0.4s cubic-bezier(0.16,1,0.3,1) 0.3s both",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(212,146,10,0.2)" },
          "50%": { boxShadow: "0 0 0 8px rgba(212,146,10,0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        bounceSoft: {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.08)" },
          "100%": { transform: "scale(1)" },
        },
        countUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
export default config;
