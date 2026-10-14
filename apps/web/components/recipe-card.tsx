import Image from "next/image";
import Link from "next/link";

import { TagChip } from "@/components/tag-chip";
import { imageSrc } from "@openrecipe/core/blob";
import type { ChipTag } from "@openrecipe/core/tags";
import { copy } from "@openrecipe/core/copy";
import { formatDuration } from "@openrecipe/core/format";

/**
 * What a card needs. Deliberately narrower than a Recipe — list queries must not
 * pull steps, tips and ingredient lines just to render a tile.
 */
export type RecipeCardData = {
  slug: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  /** In Facet order. As many as fit two rows render. */
  tags: ChipTag[];
};

/**
 * Placeholder for a Recipe with no photo. Deliberately not an icon of a camera or
 * a broken image — it reads as a designed tile rather than a failure, since plenty
 * of hand-typed Recipes will never have a picture.
 */
function CardPlaceholder({ title }: { title: string }) {
  return (
    <div
      aria-hidden
      className="flex h-full w-full items-center justify-center bg-fill"
    >
      <span className="font-display text-3xl uppercase text-muted">
        {title.slice(0, 2)}
      </span>
    </div>
  );
}

export function RecipeCard({
  recipe,
  fill = "h-full",
}: {
  recipe: RecipeCardData;
  /** How the card fills its slot: `h-full` as a grid cell, `flex-1` under a label. */
  fill?: "h-full" | "flex-1";
}) {
  const duration = formatDuration(recipe.totalMinutes);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      /* Filling its slot, every card in a row is as tall as its neighbours.
         The fixed title and tag areas below keep that true across rows too. */
      className={`group flex ${fill} flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-muted`}
    >
      <div className="relative aspect-4/3 w-full overflow-hidden">
        {recipe.imageUrl ? (
          <Image
            src={imageSrc(recipe.imageUrl)!}
            alt={recipe.title}
            fill
            /* Served through /api/image, which the optimizer cannot authenticate. */
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 320px"
          />
        ) : (
          <CardPlaceholder title={recipe.title} />
        )}
        {/* null total time renders as nothing at all — no dash, no "unknown" */}
        {duration && (
          <span className="absolute right-2 bottom-2 rounded-input border-2 border-line bg-gold px-1.5 font-mono text-xs leading-6 font-bold text-ink">
            {duration}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Always two lines tall, even for a one-word title. */}
        <h3 className="line-clamp-2 min-h-[2lh] font-display text-lg uppercase leading-tight tracking-tight">
          {recipe.title}
        </h3>

        {/*
          Exactly two rows of chips, whatever the Recipe carries: a third row
          would be clipped whole by the fixed height rather than stretching
          this card past its neighbours. Chips are 1.75rem with a 0.25rem gap.
        */}
        <ul className="mt-auto flex h-[3.75rem] flex-wrap content-start gap-1 overflow-hidden">
          {recipe.tags.map((tag) => (
            <li key={tag.slug} className="max-w-full">
              <TagChip tag={tag} size="sm" />
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

/** Same footprint as a card, so a loading grid does not reflow when data lands. */
export function RecipeCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <div className="aspect-4/3 w-full animate-pulse bg-fill" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-[2lh] w-3/4 animate-pulse rounded-input bg-fill text-lg leading-tight" />
        <div className="h-[3.75rem] w-1/2 animate-pulse rounded-input bg-fill" />
      </div>
    </div>
  );
}

function EmptyLibrary() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-line px-6 py-16 text-center">
      <p className="text-muted">{copy.library.empty}</p>
      <Link
        href="/recipes/new"
        className="rounded-input bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
      >
        {copy.nav.add}
      </Link>
    </div>
  );
}

/**
 * The one grid. Search results, the dashboard's recent list and Proposals all use
 * this — none of them grow their own card.
 *
 * `loading` renders skeletons; an empty `recipes` array renders the empty state,
 * which is a different thing from "still loading" and must not look the same.
 */
export function RecipeGrid({
  recipes,
  loading = false,
  skeletonCount = 6,
}: {
  recipes: RecipeCardData[];
  loading?: boolean;
  skeletonCount?: number;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (recipes.length === 0) return <EmptyLibrary />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.slug} recipe={recipe} />
      ))}
    </div>
  );
}
