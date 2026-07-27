import Link from "next/link";

import { JoinForm } from "@/components/join-form";
import { copy } from "@/lib/copy";
import { inspectInvite } from "@/lib/invites";

/**
 * The only route that can create an account.
 *
 * The token is checked before any form is rendered, so a dead link says why
 * instead of letting someone type a password and then refusing them.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await inspectInvite(token);

  if (state !== "valid") {
    const message =
      state === "expired"
        ? copy.join.tokenExpired
        : state === "unknown"
          ? copy.join.tokenUnknown
          : copy.join.tokenUsed;

    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl uppercase tracking-tight">
          {copy.join.title}
        </h1>
        <p role="alert" className="text-sm text-accent2">
          {message}
        </p>
        <Link href="/login" className="text-sm text-muted underline">
          {copy.join.goToLogin}
        </Link>
      </div>
    );
  }

  return <JoinForm token={token} />;
}
