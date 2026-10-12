import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CookLogButton } from "@/components/cook-log-button";
import { CookingPanel } from "@/components/cooking-panel";
import { DeleteRecipeDialog } from "@/components/delete-recipe-dialog";
import { ReimportButton } from "@/components/reimport-button";
import WakeLockToggle from "@/components/wake-lock-toggle";
import { imageSrc } from "@/lib/blob";
import { getCookLog } from "@/lib/cook-log";
import { copy } from "@/lib/copy";
import { formatDate, formatDuration } from "@/lib/format";
import { getRecipeBySlug } from "@/lib/recipe-query";
import { requireUser } from "@/lib/session";

/**
 * The Recipe page.
 *
 * A server component with a handful of interactive islands: the CookingPanel owns
 * the Servings stepper, the Pantry Check, the Shopping Export and the Substitutes
 * sheet, and the wake lock, Cook Log and delete each own themselves. Everything
 * else here is server rendered — there is nothing to wait for, so nothing spins.
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

  const cookLog = await getCookLog(recipe.id);
  const duration = formatDuration(recipe.totalMinutes);
  const editedByOther = recipe.lastEditor !== null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      {recipe.imageUrl ? (
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-card">
          <Image
            src={imageSrc(recipe.imageUrl)!}
            alt={recipe.title}
            fill
            priority
            /* Served through /api/image, which the optimizer cannot authenticate. */
            unoptimized
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex aspect-4/3 w-full items-center justify-center rounded-card bg-fill"
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

        {/* Servings are not here: the stepper below owns them, and showing the
            stored count as well would leave two numbers disagreeing on screen. */}
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
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
            <>
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted underline"
              >
                {copy.recipe.openSource}
              </a>
              {/* Only a Recipe that came from somewhere can be fetched again. */}
              <ReimportButton recipeId={recipe.id} />
            </>
          )}
          {/* Free-for-all, per PRD §5 — the dialog is the only gate. */}
          <DeleteRecipeDialog recipeId={recipe.id} title={recipe.title} />
        </div>
      </header>

      {/* Absent entirely where the browser has no Wake Lock API. */}
      <WakeLockToggle />

      <CookingPanel
        recipeId={recipe.id}
        title={recipe.title}
        servings={recipe.servings}
        lines={recipe.ingredientLines}
      />

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

      {/* Last thing on the page, because it is the last thing you do. */}
      <CookLogButton
        recipeId={recipe.id}
        times={cookLog.times}
        lastCookedAt={cookLog.lastCookedAt}
      />
    </main>
  );
}
