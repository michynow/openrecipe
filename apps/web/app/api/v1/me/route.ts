import { guard, ok } from "@/lib/api";

export async function GET() {
  const user = await guard("user");
  if (user instanceof Response) return user;

  return ok("GET /api/v1/me", user);
}
