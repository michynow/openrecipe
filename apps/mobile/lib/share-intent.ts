/**
 * Pure: pull the first http(s) URL out of whatever another app shared. Chrome
 * sends "Title\nhttps://…" or just the URL. Anything else (javascript:, intent:,
 * file:) is not a page we may fetch, so it yields null. The server validates the
 * link again when it is parked.
 */
export function extractUrl(text: string | null | undefined): string | null {
  // The link must start a word, so "javascript:open('https://…')" does not count.
  const match = text?.match(/(?:^|[\s(<[])(https?:\/\/[^\s<>"']+)/i);
  // Sentence punctuation or a closing bracket after the link is not part of it.
  return match ? match[1].replace(/[.,;:!?)\]}]+$/, "") : null;
}
