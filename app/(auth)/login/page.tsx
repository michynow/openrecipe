import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { isGoogleEnabled } from "@/lib/auth";
import { getCurrentUser } from "@/lib/session";

export default async function LoginPage() {
  // Already signed in? There is nothing to do here.
  const user = await getCurrentUser();
  if (user) redirect("/");

  return <LoginForm googleEnabled={isGoogleEnabled} />;
}
