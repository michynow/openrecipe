"use client";

import Link from "next/link";
import { useTransition } from "react";

import { rerollProposalsAction } from "@/app/(app)/actions";
import { RecipeCard } from "@/components/recipe-card";
import { copy } from "@/lib/copy";
import type { Proposal } from "@/lib/proposals-query";

/**
 * Today's Proposals (OR-48): one card per Meal Slot, and a way to say "something
 * else".
 *
 * The reroll is a server round trip rather than a client shuffle, because the
 * count it bumps lives in the database — that is what makes a reroll survive a
 * refresh and follow you from the laptop to the phone.
 */
export function Proposals({ proposals }: { proposals: Proposal[] }) {
  const [pending, startTransition] = useTransition();

  const anything = proposals.some((proposal) => proposal.recipe !== null);
  if (!anything) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl uppercase tracking-tight">
          {copy.dashboard.proposals}
        </h2>

        <button
          type="button"
          onClick={() => startTransition(async () => { await rerollProposalsAction(); })}
          disabled={pending}
          className="min-h-11 shrink-0 rounded-input border border-line px-3 text-sm text-muted transition-colors hover:text-accent disabled:opacity-50"
        >
          {copy.dashboard.reroll}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {proposals.map((proposal) => (
          <li key={proposal.slot} className="flex flex-col gap-1.5">
            <p className="flex items-baseline gap-2">
              <span className="font-mono text-xs uppercase tracking-widest text-muted">
                {copy.mealSlots[proposal.slot]}
              </span>
              {proposal.wildcard && (
                <span className="text-xs text-accent2">
                  {copy.dashboard.wildcard}
                </span>
              )}
            </p>

            {proposal.recipe ? (
              <RecipeCard recipe={proposal.recipe} />
            ) : (
              /* An empty slot offers the way out of being empty, rather than
                 stating the obvious and leaving the reader there. */
              <Link
                href="/recipes/new"
                className="flex flex-col gap-1 rounded-card border border-dashed border-line p-4 text-sm text-muted transition-colors hover:border-muted hover:text-text"
              >
                {copy.dashboard.slotEmpty}
                <span className="text-accent underline underline-offset-4">
                  {copy.nav.add}
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
