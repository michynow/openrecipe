import Image from "next/image";
import Link from "next/link";

import { imageSrc } from "@/lib/blob";
import { copy } from "@/lib/copy";
import { formatDuration } from "@/lib/format";

/**
 * What a card needs. Deliberately narrower than a Recipe — list queries must not
 * pull steps, tips and ingredient lines just to render a tile.
 */
export type RecipeCardData = {
  slug: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  /** Polish Tag labels, already resolved. At most 3 render. */
  tagLabels: string[];
};

const MAX_TAGS_ON_CARD = 3;

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
      <span className="font-display text-3xl uppercase text-muted/40">
        {title.slice(0, 2)}
      </span>
    </div>
  );
}

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  const duration = formatDuration(recipe.totalMinutes);

  return (
    <Link
      href={`/recipes/${recipe.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-muted"
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="font-display text-lg uppercase leading-tight tracking-tight">
          {recipe.title}
        </h3>

        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs">
          {recipe.tagLabels.slice(0, MAX_TAGS_ON_CARD).map((label) => (
            <span
              key={label}
              className="rounded-input border border-line px-1.5 py-0.5 text-muted"
            >
              {label}
            </span>
          ))}
          {/* null total time renders as nothing at all — no dash, no "unknown" */}
          {duration && (
            <span className="ml-auto font-mono text-muted">{duration}</span>
          )}
        </div>
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
        <div className="h-5 w-3/4 animate-pulse rounded-input bg-fill" />
        <div className="h-4 w-1/2 animate-pulse rounded-input bg-fill" />
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
