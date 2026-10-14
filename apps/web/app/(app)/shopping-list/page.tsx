import type { Metadata } from "next";

import { ShoppingList } from "@/components/shopping-list";
import { copy } from "@openrecipe/core/copy";
import { requireUser } from "@/lib/session";
import { getShoppingList } from "@/lib/shopping-list";

export const metadata: Metadata = { title: copy.shoppingList.title };

/** The household Shopping List. Members use it too (ADR-0009). */
export default async function ShoppingListPage() {
  await requireUser();
  const list = await getShoppingList();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="font-display text-3xl uppercase tracking-tight">
        {copy.shoppingList.title}
      </h1>
      <ShoppingList initial={list} />
    </main>
  );
}
