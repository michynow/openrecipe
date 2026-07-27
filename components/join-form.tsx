"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { joinWithPassword } from "@/app/(auth)/join/[token]/actions";
import { signIn } from "@/lib/auth-client";
import { copy } from "@/lib/copy";

/**
 * Create an account from an Invite.
 *
 * The account is created by a Server Action (which owns the atomic claim), then
 * the browser signs in with the same credentials. Two round trips, but it keeps
 * session-cookie handling in one place — Better Auth's own client — rather than
 * hand-plumbing Set-Cookie out of a Server Action.
 */
export function JoinForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await joinWithPassword(token, {
      name: String(form.get("name") ?? ""),
      email,
      password,
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    const signedIn = await signIn.email({ email, password });
    if (signedIn.error) {
      // Account exists, session does not. Sending them to /login is honest.
      router.push("/login");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl uppercase tracking-tight">
        {copy.join.title}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm text-muted">
            {copy.join.yourName}
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            disabled={pending}
            className="rounded-input border border-line bg-surface px-3 py-2 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm text-muted">
            {copy.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={pending}
            aria-describedby={error ? "join-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm text-muted">
            {copy.auth.password}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            disabled={pending}
            aria-describedby={error ? "join-error" : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 disabled:opacity-50"
          />
        </div>

        {error && (
          <p id="join-error" role="alert" className="text-sm text-accent2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-input bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? copy.join.creating : copy.join.createAccount}
        </button>
      </form>
    </div>
  );
}
