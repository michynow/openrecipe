# Better Auth over Auth.js/NextAuth

The requirement is that email+password and Google resolve to the *same* account when the
email matches. Auth.js treats its Credentials provider as second-class — it writes no
Account row and pushes you to JWT-only sessions — and cross-provider linking rides on a
flag called `allowDangerousEmailAccountLinking`. Better Auth treats both as first-class
and expresses linking as ordinary configuration, with a native Drizzle adapter.

Accepted cost: a smaller ecosystem and fewer answered questions when something goes odd.

## Consequences

- Sessions are database-backed for both login paths.
- There is no public sign-up route. Account creation is reachable only with a valid
  Invite token.
- The Master role is a column on the user table, seeded by matching a `MASTER_EMAIL`
  environment variable at first login — not a row someone can grant themselves.
