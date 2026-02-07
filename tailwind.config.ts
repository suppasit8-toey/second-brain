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
                background: "#090312",
                surface: "#130a21",
                "surface-highlight": "#1f1135",
                primary: "#a855f7",
                accent: "#06b6d4",
                "text-main": "#f3e8ff",
                "text-muted": "#a78bfa",
            },
            keyframes: {
                "glow-pulse": {
                    "0%, 100%": { filter: "drop-shadow(0 0 2px rgba(168, 85, 247, 0.4))" },
                    "50%": { filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.8))" },
                },
            },
            animation: {
                "glow-pulse": "glow-pulse 3s infinite ease-in-out",
            },
        },
    },
    plugins: [],
};
export default config;
