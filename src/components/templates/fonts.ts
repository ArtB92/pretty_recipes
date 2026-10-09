import { Archivo, Jost, Sacramento } from "next/font/google";

// Fonts printed on exported pages. Loaded only where a style renders.
export const jost = Jost({ subsets: ["latin"], weight: ["300", "400", "500", "600"], preload: false, display: "block" });
export const sacramento = Sacramento({ subsets: ["latin"], weight: "400", preload: false, display: "block" });
export const archivo = Archivo({ subsets: ["latin"], weight: ["400", "800"], preload: false, display: "block" });
