import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  "accept-language": "fr-FR,fr;q=0.9,en;q=0.8",
  accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

const MAX_BYTES = 3_000_000;

export class FetchBlockedError extends Error {
  constructor(
    message: string,
    readonly reason: "blocked" | "unknown_host" = "blocked",
  ) {
    super(message);
    this.name = "FetchBlockedError";
  }
}

/** Loopback, private, link-local and carrier-grade NAT ranges, IPv4 and IPv6. */
export function isPrivateAddress(address: string): boolean {
  const v4 = address.replace(/^::ffff:/i, "");
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

/**
 * Rejects links that would make the server call itself or the local network: only http(s) on
 * default ports, and every address the host resolves to must be public.
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.port || url.username || url.password) {
    throw new FetchBlockedError("Only plain http and https links are supported.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new FetchBlockedError("This address is not reachable from here.");
    return;
  }
  if (!host.includes(".") || /\.(?:local|internal|localhost)$/i.test(host)) {
    throw new FetchBlockedError("This address is not reachable from here.");
  }
  const addresses = await lookup(host, { all: true }).catch(() => {
    throw new FetchBlockedError("This website could not be found.", "unknown_host");
  });
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new FetchBlockedError("This address is not reachable from here.");
  }
}

/** fetch with a size cap, a timeout, and every redirect re-checked by `check`. */
export async function safeFetch(
  start: URL,
  opts: { accept?: string; check: (url: URL) => void | Promise<void> },
): Promise<{ url: URL; status: number; body: string }> {
  let url = start;
  await opts.check(url);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      headers: opts.accept ? { ...BROWSER_HEADERS, accept: opts.accept } : BROWSER_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      await opts.check(url);
      continue;
    }
    const reader = res.body?.getReader();
    let received = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_BYTES) {
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    return { url, status: res.status, body: Buffer.concat(chunks).toString("utf8") };
  }
  throw new FetchBlockedError("The link redirects too many times.");
}
