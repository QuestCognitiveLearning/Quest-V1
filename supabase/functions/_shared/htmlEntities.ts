// Decode HTML entities in text returned by external APIs (notably the YouTube
// Data API, which HTML-escapes titles/descriptions — e.g. "Bill's" comes back
// as "Bill&#39;s", "A &amp; B", "&quot;quoted&quot;"). We decode server-side so
// every consumer (UI, generation prompts, stored titles) sees clean text.
//
// Handles numeric (&#39;), hex (&#x27;), and the named entities YouTube emits,
// and loops a few times to undo accidental double-encoding (e.g. "&amp;#39;").

const NAMED: Record<string, string> = {
  '&quot;': '"',
  '&apos;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&amp;': '&', // must resolve last each pass (handled by ordering below)
};

export function decodeHtmlEntities(input: string): string {
  if (!input || typeof input !== 'string' || input.indexOf('&') === -1) return input;
  let s = input;
  for (let i = 0; i < 3; i++) {
    const next = s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeFromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => safeFromCodePoint(parseInt(d, 10)))
      .replace(/&quot;|&apos;|&lt;|&gt;|&nbsp;|&amp;/g, (m) => NAMED[m] ?? m);
    if (next === s) break;
    s = next;
  }
  return s;
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  try {
    return String.fromCodePoint(code);
  } catch {
    return '';
  }
}
