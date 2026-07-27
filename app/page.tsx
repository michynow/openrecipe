import { RecipeGrid, type RecipeCardData } from "@/components/recipe-card";
import { copy } from "@/lib/copy";

// Placeholder dashboard. Stat widgets and Proposals are OR-47 and OR-48; the
// recent-Recipes listing below is real, it just has nothing to list until the
// database exists (OR-9) and Recipes can be created (OR-23).
export default function Home() {
  const recipes: RecipeCardData[] = [];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-tight sm:text-4xl">
        {copy.library.recent}
      </h1>
      <RecipeGrid recipes={recipes} />
    </main>
  );
}
