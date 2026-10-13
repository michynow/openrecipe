import { AccountForms } from "@/components/account-forms";
import { copy } from "@/lib/copy";
import { requireUser } from "@/lib/session";

/** Every role gets this page: your name, your password, and what you may do. */
export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl uppercase tracking-tight">
          {copy.account.title}
        </h1>
        <p className="text-sm text-muted">
          {user.email} · {copy.account.roles[user.role]}
        </p>
      </div>

      <AccountForms name={user.name} />
    </main>
  );
}
