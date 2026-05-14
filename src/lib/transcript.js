/**
 * @file   transcript.js
 * @desc   Helper for normalizing video transcripts.
 *
 *         When a transcript is longer than ~10K characters, the curriculum
 *         pipeline stores it as a Supabase Storage URL instead of inlining the
 *         text into the `video.video_transcript` column. Every place that
 *         CONSUMES the transcript (UI display, AI prompt building) needs to
 *         resolve the URL back to text first — otherwise the literal URL
 *         leaks into the prompt or the UI.
 *
 *         Use `resolveTranscript(value)` instead of touching `video_transcript`
 *         directly anywhere the actual text matters.
 *
 * @author Quest Learning core team
 */

/**
 * If `value` looks like an http(s) URL, fetch it and return the body text.
 * Otherwise return the string as-is. Failures (network, 4xx/5xx) fall back to
 * an empty string with a console warning — better to ship a missing transcript
 * than a URL-shaped string into the AI prompt or UI.
 *
 * @param {string|null|undefined} value - raw `video_transcript` column value
 * @returns {Promise<string>} the actual transcript text
 */
export async function resolveTranscript(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const res = await fetch(trimmed);
    if (!res.ok) {
      console.warn('[transcript] fetch failed', res.status, trimmed);
      return '';
    }
    return await res.text();
  } catch (err) {
    console.warn('[transcript] fetch threw', err);
    return '';
  }
}

/**
 * Quick boolean — is this transcript-shaped value still in URL form?
 * Useful for conditional UI ("Loading transcript…" placeholders).
 */
export function isTranscriptUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}
