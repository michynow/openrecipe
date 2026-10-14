import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "./db/index.ts";
import * as schema from "./db/schema.ts";
import { roleFor } from "./roles.ts";

/**
 * Auth. See ADR-0003 for why Better Auth rather than Auth.js: this app needs a
 * password account and a Google account on the same email to resolve to ONE user,
 * and Better Auth expresses that as configuration instead of a workaround.
 */

/**
 * Google is registered only when both credentials are present.
 *
 * Registering it with `undefined` values would either throw at import time or fail
 * at the callback with something unhelpful — and every other login path would be
 * dead in the meantime. A missing OAuth credential should cost you Google sign-in,
 * not the whole app.
 */
const googleConfigured =
  Boolean(process.env.GOOGLE_CLIENT_ID) &&
  Boolean(process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    // No email provider exists by design (ADR: copy-link invites), so there is
    // nothing to send a verification mail with. The Master vouches for accounts
    // by handing out the Invite in the first place.
    requireEmailVerification: false,
  },

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  account: {
    accountLinking: {
      enabled: true,
      /**
       * Google verifies the email addresses it hands over, so matching on it is
       * safe here. This is the whole requirement: one account, two ways in.
       */
      trustedProviders: ["google"],
    },
  },

  session: {
    // Database-backed for both login paths, not a JWT.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "member",
        /** Derived from MASTER_EMAIL (OR-12) — never accepted from a request. */
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        /**
         * Stamp the role at creation so queries and displayed labels agree with
         * reality. This is a denormalisation, not the authority — `isMasterEmail`
         * is what actually gates anything (see lib/roles.ts). Even if this row
         * said "master", a check against MASTER_EMAIL would still say no.
         */
        before: async (newUser) => ({
          data: { ...newUser, role: roleFor(newUser.email) },
        }),
      },
    },
  },

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  /**
   * Every hostname this deployment answers on. Better Auth trusts only baseURL by
   * default, and the project has more than one production domain
   * (openrecipe-red.vercel.app as well as the team URL): signing in from the
   * other one was a flat 403 "Invalid origin" that the form showed as a wrong
   * password. Vercel's system variables name the domains exactly — no
   * `*.vercel.app` wildcard, which would trust every app on the platform.
   */
  trustedOrigins: [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ]
    .filter((host): host is string => Boolean(host))
    .map((host) => `https://${host}`),
});

/** True when Google sign-in can actually be offered. The login screen reads this. */
export const isGoogleEnabled = googleConfigured;
