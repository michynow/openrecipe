import { revalidatePath } from "next/cache";

import { guard, ok } from "@/lib/api";
import { bumpReroll } from "@/lib/proposals-query";

export async function POST(request: Request) {
  const user = await guard("user", request);
  if (user instanceof Response) return user;

  const n = await bumpReroll(user.id);
  revalidatePath("/");

  return ok("POST /api/v1/home/reroll", { n });
}
