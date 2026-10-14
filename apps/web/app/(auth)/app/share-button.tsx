"use client";

import { useState } from "react";

import { copy } from "@openrecipe/core/copy";

/** Native share sheet where there is one, otherwise copy the page link. */
export function ShareButton() {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: copy.appDownload.title, text: copy.appDownload.shareMessage, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dismissing the share sheet rejects; nothing to report.
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-input border border-line px-4 py-2.5 font-bold text-text"
    >
      {copied ? copy.appDownload.linkCopied : copy.appDownload.share}
    </button>
  );
}
