/** Pure HTML helpers for social pages, kept separate so they can be unit-tested. */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", deg: "°", times: "×", frac12: "½", frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔",
  frac18: "⅛", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë", agrave: "à", acirc: "â", ccedil: "ç", icirc: "î",
  iuml: "ï", ocirc: "ô", ucirc: "û", ugrave: "ù", oelig: "œ", laquo: "«", raquo: "»",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return NAMED[ent] ?? NAMED[ent.toLowerCase()] ?? whole;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Instagram's /embed/captioned/ page: <div class="Caption"><a class="CaptionUsername">user</a> caption…</div> */
export function captionFromInstagramEmbed(html: string): { caption: string; author: string | null } | null {
  const block = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<div class="CaptionComments"/i)
    ?? html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
  if (!block) return null;
  const userMatch = block[1].match(/<a[^>]*class="CaptionUsername"[^>]*>([\s\S]*?)<\/a>/i);
  const author = userMatch ? htmlToText(userMatch[1]) : null;
  const body = userMatch ? block[1].replace(userMatch[0], "") : block[1];
  const caption = htmlToText(body);
  return caption ? { caption, author: author ? `@${author.replace(/^@/, "")}` : null } : null;
}

/** og:description looks like: 1,234 likes, 56 comments - user on March 3, 2025: "caption". */
export function captionFromOgDescription(html: string): { caption: string; author: string | null } | null {
  const meta =
    html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i) ??
    html.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:description"/i) ??
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i);
  if (!meta) return null;
  const text = decodeEntities(meta[1]).trim();
  const m = text.match(/^[^-]*-\s*([\w.]+)\s+(?:on|le)\s+[^:]+:\s*["“]([\s\S]*)["”]\.?\s*$/);
  if (m) return { caption: m[2].trim(), author: `@${m[1]}` };
  return text ? { caption: text, author: null } : null;
}
