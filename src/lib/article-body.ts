import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const MAX_HTML_BYTES = 2_000_000;
const MIN_ARTICLE_CHARS = 220;
const MAX_ARTICLE_CHARS = 60_000;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 8_000;

export class ArticleBodyUnavailable extends Error {
  constructor() {
    super("ARTICLE_BODY_UNAVAILABLE");
  }
}

export function isPublicIpAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

function parsePublicUrl(value: string, base?: URL): URL {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new ArticleBodyUnavailable();
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if ((url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username || url.password || !hostname || ipaddr.isValid(hostname) ||
      url.port) {
    throw new ArticleBodyUnavailable();
  }
  url.hash = "";
  return url;
}

type HtmlResponse = { status: number; location?: string; contentType?: string; body?: Buffer };

async function requestHtml(url: URL): Promise<HtmlResponse> {
  let addresses: { address: string }[];
  try {
    addresses = await lookup(url.hostname, { all: true, verbatim: true });
  } catch {
    throw new ArticleBodyUnavailable();
  }
  if (!Array.isArray(addresses) || addresses.length === 0 ||
      addresses.some((entry) => !isPublicIpAddress(entry.address))) {
    throw new ArticleBodyUnavailable();
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
        "Accept-Encoding": "identity",
        "User-Agent": "NEWSPI-NewsQuiz/1.0",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ArticleBodyUnavailable();
  }
  const status = response.status;
  const location = response.headers.get("location") ?? undefined;
  const contentType = response.headers.get("content-type") ?? undefined;
  if (status >= 300 && status < 400) {
    await response.body?.cancel();
    return { status, location, contentType };
  }
  if (status !== 200 || (contentType && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType))) {
    await response.body?.cancel();
    throw new ArticleBodyUnavailable();
  }
  if (Number(response.headers.get("content-length")) > MAX_HTML_BYTES || !response.body) {
    await response.body?.cancel();
    throw new ArticleBodyUnavailable();
  }
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_HTML_BYTES) throw new ArticleBodyUnavailable();
      chunks.push(Buffer.from(value));
    }
  } catch {
    await reader.cancel();
    throw new ArticleBodyUnavailable();
  }
  return { status, contentType, body: Buffer.concat(chunks) };
}

function decodeHtml(body: Buffer, contentType?: string): string {
  const headerCharset = contentType?.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
  const metaCharset = body.subarray(0, 4096).toString("latin1").match(/<meta[^>]+charset\s*=\s*["']?([^\s;"'>]+)/i)?.[1];
  try {
    return new TextDecoder(headerCharset || metaCharset || "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export function extractArticleText(html: string, url: string): string | null {
  const dom = new JSDOM(html, { url });
  try {
    const article = new Readability(dom.window.document, { charThreshold: MIN_ARTICLE_CHARS }).parse();
    const text = article?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    return text.length >= MIN_ARTICLE_CHARS && text.length <= MAX_ARTICLE_CHARS ? text : null;
  } finally {
    dom.window.close();
  }
}

async function fetchFromUrl(value: string): Promise<string> {
  let url = parsePublicUrl(value);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await requestHtml(url);
    if (response.status >= 300 && response.status < 400) {
      if (!response.location || redirect === MAX_REDIRECTS) throw new ArticleBodyUnavailable();
      url = parsePublicUrl(response.location, url);
      continue;
    }
    if (!response.body) throw new ArticleBodyUnavailable();
    const text = extractArticleText(decodeHtml(response.body, response.contentType), url.toString());
    if (!text) throw new ArticleBodyUnavailable();
    return text;
  }
  throw new ArticleBodyUnavailable();
}

export async function fetchArticleText(sourceUrl: string, naverUrl?: string): Promise<string> {
  const candidates = [sourceUrl, naverUrl].filter((value): value is string => !!value);
  for (const candidate of new Set(candidates)) {
    try {
      return await fetchFromUrl(candidate);
    } catch {
      // Some publishers block automated requests; a separate Naver URL may still be readable.
    }
  }
  throw new ArticleBodyUnavailable();
}
