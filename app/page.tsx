import { copy } from "@/lib/copy";

// Placeholder. The real dashboard — stat widgets, Proposals, recent Recipes —
// is OR-47 and OR-48. This exists only so no English scaffold copy survives.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-semibold">{copy.app.name}</h1>
      <p className="text-sm opacity-60">{copy.library.empty}</p>
    </main>
  );
}
