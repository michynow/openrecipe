"use client";

import { useState } from "react";

import { copy } from "@/lib/copy";

/**
 * Copies the full join URL. Built from `location.origin` at click time rather than
 * from a configured base URL, so it is correct on localhost, on preview
 * deployments and in production without knowing which one it is running on.
 */
export function CopyInviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(
          `${location.origin}/join/${token}`,
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-xs text-accent underline"
    >
      {copied ? copy.recipe.copied : copy.recipe.copy}
    </button>
  );
}
