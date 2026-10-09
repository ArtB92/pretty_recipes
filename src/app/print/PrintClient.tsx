"use client";

import dynamic from "next/dynamic";

// The payload only exists in the browser, so this view never renders on the server.
export const PrintClient = dynamic(() => import("./PrintView").then((m) => m.PrintView), { ssr: false });
