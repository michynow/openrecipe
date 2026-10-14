import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CookLogButton } from "@/components/cook-log-button";
import { CookingPanel } from "@/components/cooking-panel";
import { DeleteRecipeDialog } from "@/components/delete-recipe-dialog";
import { Icon } from "@/components/icons";
import { ReimportButton } from "@/components/reimport-button";
import { StatTile } from "@/components/stat-tile";
import { TagChip } from "@/components/tag-chip";
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
  const { isAdmin } = await requireUser();

  const { slug } = await params;
  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();

  const cookLog = await getCookLog(recipe.id);
  const duration = formatDuration(recipe.totalMinutes);
  const editedByOther = recipe.lastEditor !== null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
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
          <span className="font-display text-6xl uppercase text-muted">
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

        {/* Servings are not here: the stepper below owns them, and showing the
            stored count as well would leave two numbers disagreeing on screen.
            Scoreboard tiles: "how long" and "how heavy" are what decides
            whether it is tonight's dinner, so they are read before anything. */}
        {(duration || recipe.kcalPerServing !== null) && (
          <dl className="flex flex-wrap gap-3">
            {/* Each of these disappears entirely when null. */}
            {duration && (
              <StatTile icon="clock" label={copy.recipe.time} value={duration} />
            )}
            {recipe.kcalPerServing !== null && (
              <StatTile
                icon="flame"
                label={copy.recipe.kcalPerServing}
                value={String(recipe.kcalPerServing)}
              />
            )}
          </dl>
        )}

        {recipe.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {recipe.tags.map((tag) => (
              <li key={tag.slug}>
                <TagChip tag={tag} />
              </li>
            ))}
          </ul>
        )}

        {/* Chunky buttons, not links: these are things you do to the Recipe.
            Members are read-only: they keep the source link and nothing else. */}
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <Link href={`/recipes/${recipe.slug}/edit`} className="inline-flex min-h-11 items-center gap-2 rounded-input border border-line px-3 text-sm font-extrabold text-text">
              <Icon name="edit" className="size-5" />
              {copy.recipe.edit}
            </Link>
          )}
          {recipe.sourceUrl && (
            <>
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-input border border-line px-3 text-sm font-extrabold text-text"
              >
                <Icon name="external" className="size-5" />
                {copy.recipe.openSource}
              </a>
              {/* Only a Recipe that came from somewhere can be fetched again. */}
              {isAdmin && <ReimportButton recipeId={recipe.id} />}
            </>
          )}
          {isAdmin && (
            <DeleteRecipeDialog recipeId={recipe.id} title={recipe.title} />
          )}
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

      <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-xl uppercase tracking-tight">
          {copy.recipe.steps}
        </h2>
        <ol className="flex flex-col gap-2">
          {recipe.steps.map((step, index) => (
            <li key={index} className="flex gap-3 text-lg leading-relaxed">
              <span
                aria-hidden
                className="w-8 shrink-0 text-right font-mono font-bold text-accent"
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
          <ul className="flex flex-col gap-2 text-base leading-relaxed">
            {recipe.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Last thing on the page, because it is the last thing you do. */}
      {isAdmin && (
        <CookLogButton
          recipeId={recipe.id}
          times={cookLog.times}
          lastCookedAt={cookLog.lastCookedAt}
        />
      )}
    </main>
  );
}
