import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { isGoogleEnabled } from "@/lib/auth";
import { safeNext } from "@/lib/redirects";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  // Already signed in? There is nothing to do here.
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { next } = await searchParams;

  return <LoginForm googleEnabled={isGoogleEnabled} next={safeNext(next)} />;
}
