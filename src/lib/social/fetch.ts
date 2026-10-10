import "server-only";
import { safeFetch } from "@/lib/net";
import { captionFromInstagramEmbed, captionFromOgDescription } from "./parse";

export type SocialPlatform = "tiktok" | "instagram";
export type SocialPost = { platform: SocialPlatform; url: string; caption: string; author: string | null };

export class SocialFetchError extends Error {
  constructor(
    message: string,
    readonly code: "unsupported_url" | "not_found" | "blocked" | "no_caption",
  ) {
    super(message);
    this.name = "SocialFetchError";
  }
}

const HOSTS: Record<string, SocialPlatform> = {
  "tiktok.com": "tiktok",
  "www.tiktok.com": "tiktok",
  "m.tiktok.com": "tiktok",
  "vm.tiktok.com": "tiktok",
  "vt.tiktok.com": "tiktok",
  "instagram.com": "instagram",
  "www.instagram.com": "instagram",
  "m.instagram.com": "instagram",
};

export function isSocialUrl(input: string): boolean {
  try {
    return new URL(input.trim()).hostname.toLowerCase() in HOSTS;
  } catch {
    return false;
  }
}

/** Only TikTok and Instagram hosts over https are allowed, so the server cannot be pointed elsewhere. */
export function classifyUrl(input: string): { url: URL; platform: SocialPlatform } {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new SocialFetchError("That is not a valid link.", "unsupported_url");
  }
  if (url.protocol === "http:") url.protocol = "https:";
  const platform = HOSTS[url.hostname.toLowerCase()];
  if (url.protocol !== "https:" || !platform || url.port) {
    throw new SocialFetchError("Only TikTok and Instagram links are supported for now.", "unsupported_url");
  }
  return { url, platform };
}

const social = (accept?: string) => ({ accept, check: (u: URL) => void classifyUrl(u.toString()) });

async function fetchTikTok(url: URL): Promise<SocialPost> {
  // Short links (vm.tiktok.com) must be expanded before oEmbed accepts them.
  let canonical = url;
  if (url.hostname.startsWith("vm.") || url.hostname.startsWith("vt.")) {
    canonical = (await safeFetch(url, social())).url;
  }
  const oembed = new URL("https://www.tiktok.com/oembed");
  oembed.searchParams.set("url", canonical.toString());
  const res = await safeFetch(oembed, social("application/json"));
  if (res.status === 404 || res.status === 400) {
    throw new SocialFetchError("TikTok could not find this video. It may be private or deleted.", "not_found");
  }
  if (res.status !== 200) throw new SocialFetchError(`TikTok refused the request (${res.status}).`, "blocked");
  let data: { title?: string; author_name?: string; author_unique_id?: string };
  try {
    data = JSON.parse(res.body);
  } catch {
    throw new SocialFetchError("TikTok returned an unexpected page.", "blocked");
  }
  const caption = data.title?.trim();
  if (!caption) throw new SocialFetchError("This TikTok has no description.", "no_caption");
  return {
    platform: "tiktok",
    url: canonical.toString(),
    caption,
    author: data.author_unique_id ? `@${data.author_unique_id}` : (data.author_name ?? null),
  };
}

async function fetchInstagram(url: URL): Promise<SocialPost> {
  const m = url.pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (!m) throw new SocialFetchError("This Instagram link does not point to a post or reel.", "unsupported_url");
  const kind = m[1] === "reels" ? "reel" : m[1];
  const shortcode = m[2];
  const canonical = `https://www.instagram.com/${kind}/${shortcode}/`;

  // The public embed page carries the full caption without a login.
  const embed = await safeFetch(new URL(`https://www.instagram.com/p/${shortcode}/embed/captioned/`), social());
  if (embed.status === 200) {
    const found = captionFromInstagramEmbed(embed.body);
    if (found?.caption) return { platform: "instagram", url: canonical, ...found };
  }
  // Fallback: the post page's meta description holds a (sometimes shortened) caption.
  const page = await safeFetch(new URL(canonical), social());
  if (page.status === 404) throw new SocialFetchError("Instagram could not find this post.", "not_found");
  if (page.status === 200) {
    const found = captionFromOgDescription(page.body);
    if (found?.caption) return { platform: "instagram", url: canonical, ...found };
  }
  throw new SocialFetchError(
    "Instagram did not share this post's caption with us. Copy the caption from the app and paste it as text.",
    "blocked",
  );
}

export async function fetchSocialPost(input: string): Promise<SocialPost> {
  const { url, platform } = classifyUrl(input);
  try {
    return platform === "tiktok" ? await fetchTikTok(url) : await fetchInstagram(url);
  } catch (err) {
    if (err instanceof SocialFetchError) throw err;
    throw new SocialFetchError(
      `Could not reach ${platform === "tiktok" ? "TikTok" : "Instagram"}. Paste the caption as text instead.`,
      "blocked",
    );
  }
}
