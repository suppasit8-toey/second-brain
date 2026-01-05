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
        },
    },
    plugins: [],
};
export default config;
