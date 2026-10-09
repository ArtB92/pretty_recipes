import type { Metadata } from "next";
import { PrintClient } from "./PrintClient";

export const metadata: Metadata = { title: "Print", robots: { index: false, follow: false } };

export default function PrintPage() {
  return <PrintClient />;
}
