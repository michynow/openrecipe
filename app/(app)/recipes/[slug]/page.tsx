import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { copy } from "@/lib/copy";
import { count, formatDate, formatDuration } from "@/lib/format";
import { formatQuantity } from "@/lib/quantity";
import { getRecipeBySlug } from "@/lib/recipe-query";
import { requireUser } from "@/lib/session";

/**
 * The Recipe page. Read-only for now.
 *
 * Phase 2 adds the Servings stepper, Pantry Check, wake lock, Shopping Export,
 * Cook Log and Substitutes (OR-27 through OR-33). Everything here is server
 * rendered — there is nothing to wait for, so nothing spins.
 *
 * The governing rule: a null field renders as **nothing at all**. No "unknown", no
 * em-dash, no empty labelled row. A Recipe with no photo, no time, no kcal, no
 * tips and no source must still look finished rather than half-filled.
 */
export default async function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();

  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const duration = formatDuration(recipe.totalMinutes);
  const editedByOther = recipe.lastEditor !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      {recipe.imageUrl ? (
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-card">
          <Image
            src={recipe.imageUrl}
            alt={recipe.title}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex aspect-4/3 w-full items-center justify-center rounded-card bg-line"
        >
          <span className="font-display text-6xl uppercase text-muted/40">
            {recipe.title.slice(0, 2)}
          </span>
        </div>
      )}

      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl uppercase leading-none tracking-tight sm:text-5xl">
          {recipe.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="flex items-center gap-2">
            {recipe.author.image && (
              <Image
                src={recipe.author.image}
                alt=""
                width={24}
                height={24}
                className="rounded-full"
              />
            )}
            {copy.recipe.addedBy} {recipe.author.name}
          </span>
          <span>{formatDate(recipe.createdAt)}</span>
          {/* Only shown when the last editor differs from the author. */}
          {editedByOther && (
            <span>
              {copy.recipe.editedBy} {recipe.lastEditor!.name}
            </span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {recipe.tags.map((tag) => (
              <li
                key={tag.slug}
                className="rounded-input border border-line px-2 py-0.5 text-xs text-muted"
              >
                {tag.label}
              </li>
            ))}
          </ul>
        )}

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">{copy.recipe.servings}</dt>
            <dd className="font-mono">
              {count(recipe.servings, copy.units.servings)}
            </dd>
          </div>

          {/* Each of these disappears entirely when null. */}
          {duration && (
            <div className="flex gap-2">
              <dt className="text-muted">{copy.recipe.time}</dt>
              <dd className="font-mono">{duration}</dd>
            </div>
          )}

          {recipe.kcalPerServing !== null && (
            <div className="flex gap-2">
              <dt className="text-muted">{copy.recipe.kcalPerServing}</dt>
              <dd className="font-mono">{recipe.kcalPerServing}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/recipes/${recipe.slug}/edit`} className="text-accent underline">
            {copy.recipe.edit}
          </Link>
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted underline"
            >
              {copy.recipe.openSource}
            </a>
          )}
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.recipe.ingredients}
        </h2>
        <ul className="flex flex-col gap-1">
          {recipe.ingredientLines.map((line) => (
            <li key={line.id} className="flex gap-2 text-sm">
              {/*
                Quantity and unit in mono and right-aligned in a fixed column, so
                numbers line up down the list instead of ragging with the words.
              */}
              <span className="w-24 shrink-0 text-right font-mono text-muted">
                {line.quantity !== null && formatQuantity(line.quantity)}
                {line.unit && ` ${line.unit}`}
              </span>
              <span>
                {line.item}
                {line.note && (
                  <span className="text-muted"> ({line.note})</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.recipe.steps}
        </h2>
        <ol className="flex flex-col gap-2">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="w-5 shrink-0 text-right font-mono text-muted"
              >
                {index + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Tips come after the Steps, and vanish when there are none. */}
      {recipe.tips.length > 0 && (
        <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
          <h2 className="font-display text-lg uppercase tracking-tight">
            {copy.recipe.tips}
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm text-muted">
            {recipe.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
