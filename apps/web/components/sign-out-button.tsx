"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { signOut } from "@/lib/auth-client";
import { copy } from "@openrecipe/core/copy";

/** Ends the session and lands on /login. Styled as a nav item, it lives in the header. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          router.push("/login");
          router.refresh();
        })
      }
      className={className}
    >
      {copy.nav.signOut}
    </button>
  );
}
