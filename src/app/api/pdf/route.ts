import { z } from "zod";
import { renderPdf } from "@/lib/pdf";
import { Recipe } from "@/lib/recipe/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const Body = z.object({
  recipe: Recipe,
  style: z.enum(["classic", "card"]),
  units: z.enum(["original", "metric", "us"]),
  servings: z.number().positive().max(1000).nullable(),
});

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 500_000) {
    return Response.json({ error: "Recipe too large." }, { status: 413 });
  }
  if (!rateLimit(`pdf:${clientKey(request.headers)}`, 60, 3_600_000).ok) {
    return Response.json({ error: "Too many PDFs in the last hour." }, { status: 429 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid recipe." }, { status: 400 });

  try {
    const pdf = await renderPdf(parsed.data);
    return new Response(new Uint8Array(pdf), {
      headers: { "content-type": "application/pdf", "cache-control": "no-store" },
    });
  } catch (err) {
    console.error("[pdf]", err);
    return Response.json({ error: "Could not render the PDF." }, { status: 500 });
  }
}
