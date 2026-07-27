import { copy } from "@/lib/copy";

// Placeholder. The real dashboard — stat widgets, Proposals, recent Recipes —
// is OR-47 and OR-48. This exists only so no English scaffold copy survives.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-3 px-4 py-16 sm:px-6">
      <h1 className="font-display text-5xl uppercase tracking-tight sm:text-7xl">
        {copy.app.name}
      </h1>
      <p className="text-sm text-muted">{copy.library.empty}</p>
    </main>
  );
}
