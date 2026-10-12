"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { signIn } from "@/lib/auth-client";
import { copy } from "@/lib/copy";

/**
 * Sign in. Two paths, no way to create an account — accounts exist only via an
 * Invite (OR-14).
 *
 * Every failure shows the same message regardless of cause. A "no such account"
 * error would let anyone test which addresses have accounts here, and on an
 * invite-only instance that is exactly the thing not to leak.
 */
export function LoginForm({
  googleEnabled,
  next = "/",
}: {
  googleEnabled: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"password" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = pending !== null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("password");

    const form = new FormData(event.currentTarget);
    const result = await signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });

    if (result.error) {
      // Deliberately not surfacing result.error.message — see the note above.
      // Only a 401 means "wrong email or password"; a refused origin or a rate
      // limit used to show up as the same sentence and send people hunting for
      // a password that was fine all along.
      setError(
        result.error.status === 401
          ? copy.auth.invalidCredentials
          : result.error.status === 429
            ? copy.auth.tooManyAttempts
            : copy.common.somethingFailed,
      );
      setPending(null);
      return;
    }

    router.push(next);
  }

  async function onGoogle() {
    setError(null);
    setPending("google");
    const result = await signIn.social({ provider: "google", callbackURL: next });
    if (result?.error) {
      setError(copy.common.somethingFailed);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl uppercase tracking-tight">
        {copy.auth.title}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm text-muted">
            {copy.auth.email}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            disabled={busy}
            aria-describedby={error ? "login-error" : undefined}
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
            autoComplete="current-password"
            required
            disabled={busy}
            aria-describedby={error ? "login-error" : undefined}
            aria-invalid={error ? true : undefined}
            className="rounded-input border border-line bg-surface px-3 py-2 disabled:opacity-50"
          />
        </div>

        {/* role=alert so a screen reader announces it without moving focus */}
        {error && (
          <p
            id="login-error"
            role="alert"
            className="text-sm text-accent2"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-input bg-accent px-4 py-2.5 font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending === "password" ? copy.auth.signingIn : copy.auth.signIn}
        </button>
      </form>

      {/*
        Only rendered when Google is actually configured (OR-11). A button that
        cannot work is worse than no button.
      */}
      {googleEnabled && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            <span>lub</span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={busy}
            className="rounded-input border border-line px-4 py-2.5 transition-colors hover:border-muted disabled:opacity-50"
          >
            {pending === "google" ? copy.auth.signingIn : copy.auth.google}
          </button>
        </>
      )}

      {/* There is no email provider by design, so resets go through the Master. */}
      <p className="text-sm text-muted">{copy.auth.noSelfReset}</p>
    </div>
  );
}
