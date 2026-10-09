import localFont from "next/font/local";

// Fonts printed on exported pages, self-hosted in src/fonts. Loaded only where a style renders.
export const jost = localFont({ src: "../../fonts/jost-latin.woff2", weight: "300 600", preload: false, display: "block" });
export const sacramento = localFont({ src: "../../fonts/sacramento-latin.woff2", weight: "400", preload: false, display: "block" });
export const archivo = localFont({ src: "../../fonts/archivo-latin.woff2", weight: "400 800", preload: false, display: "block" });
