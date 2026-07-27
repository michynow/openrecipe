import { eq } from "drizzle-orm";

import { auth } from "../lib/auth.ts";
import { db } from "../lib/db/index.ts";
import { user } from "../lib/db/schema.ts";
import { isMasterEmail } from "../lib/roles.ts";

/**
 * Create the very first account: the Master's.
 *
 * Needed because accounts only exist via an Invite, and minting an Invite requires
 * a signed-in Master — circular on an empty database. This is the one door in, and
 * it only opens from a machine holding the database credentials.
 *
 * The password comes from the environment so it is chosen by whoever runs this and
 * never appears in a command line (visible in `ps`), a shell history file, or a
 * chat log.
 *
 *   MASTER_PASSWORD='...' pnpm bootstrap-master
 *
 * Safe to re-run: it refuses if the account already exists rather than clobbering
 * it, so it cannot be used to reset a forgotten password by accident.
 */
async function main() {
  const email = process.env.MASTER_EMAIL?.trim();
  const password = process.env.MASTER_PASSWORD;

  if (!email) {
    throw new Error("MASTER_EMAIL is not set. Check .env.local.");
  }
  if (!password || password.length < 8) {
    throw new Error(
      "Set MASTER_PASSWORD (at least 8 characters):\n" +
        "  MASTER_PASSWORD='your-password' pnpm bootstrap-master",
    );
  }
  if (!isMasterEmail(email)) {
    // Belt and braces: this would mean MASTER_EMAIL disagrees with itself.
    throw new Error(`${email} is not the configured Master email.`);
  }

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log(`${email} already exists — nothing to do.`);
    console.log("To change its password, reset it deliberately; this script won't.");
    return;
  }

  await auth.api.signUpEmail({
    body: { email, password, name: process.env.MASTER_NAME?.trim() || "Michy" },
  });

  const [created] = await db
    .select({ id: user.id, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  console.log(`Created ${email} with role "${created.role}".`);
  console.log("Sign in, then mint Invites from /settings.");
}

await main();
