"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  updateNameAction,
  type AccountResult,
} from "@/app/(app)/account/actions";
import { copy } from "@/lib/copy";

const input =
  "rounded-input border border-line bg-surface px-3 py-2 disabled:opacity-50";
const button =
  "self-start rounded-input bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50";

function Status({ id, state }: { id: string; state: AccountResult }) {
  if (!state) return null;
  return (
    <p
      id={id}
      role={state.ok ? "status" : "alert"}
      className={`text-sm ${state.ok ? "text-accent" : "text-accent2"}`}
    >
      {state.message}
    </p>
  );
}

export function AccountForms({ name }: { name: string }) {
  const [nameState, nameAction, namePending] = useActionState(
    updateNameAction,
    null,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    null,
  );

  return (
    <>
      <form action={nameAction} className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.account.profile}
        </h2>
        <label htmlFor="name" className="text-sm text-muted">
          {copy.join.yourName}
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={name}
          autoComplete="name"
          disabled={namePending}
          className={input}
        />
        <Status id="name-status" state={nameState} />
        <button type="submit" disabled={namePending} className={button}>
          {copy.account.save}
        </button>
      </form>

      <form action={passwordAction} className="flex flex-col gap-3">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.auth.password}
        </h2>
        <label htmlFor="currentPassword" className="text-sm text-muted">
          {copy.account.currentPassword}
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          disabled={passwordPending}
          aria-describedby="current-hint"
          className={input}
        />
        <p id="current-hint" className="text-sm text-muted">
          {copy.account.currentPasswordHint}
        </p>
        <label htmlFor="newPassword" className="text-sm text-muted">
          {copy.account.newPassword}
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          disabled={passwordPending}
          className={input}
        />
        <Status id="password-status" state={passwordState} />
        <button type="submit" disabled={passwordPending} className={button}>
          {copy.account.changePassword}
        </button>
      </form>
    </>
  );
}
