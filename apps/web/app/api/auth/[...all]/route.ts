import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Better Auth's own endpoints: sign-in, sign-out, callbacks, session.
export const { GET, POST } = toNextJsHandler(auth);
