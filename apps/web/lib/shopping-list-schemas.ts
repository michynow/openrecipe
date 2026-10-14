import { z } from "zod";

/**
 * Request shapes for the Shopping List, shared by the Server Actions and the
 * /api/v1 handlers so the two front doors accept exactly the same thing.
 */

const servings = z.number().int().min(1).max(99);

export const shoppingListSchemas = {
  add: z.object({
    recipeId: z.uuid(),
    servings,
    excludedLineIds: z.array(z.uuid()).max(500).default([]),
  }),
  servings: z.object({ servings }),
  tick: z.object({
    // A row key is item + unit; items are at most 80 chars, units 20. Checked
    // against the current list server-side; the quantity is the server's own.
    key: z.string().min(1).max(200),
    ticked: z.boolean(),
  }),
  clear: z.object({ scope: z.enum(["ticked", "all"]) }),
};
