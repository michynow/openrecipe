"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth. Same origin as the app, so no baseURL is needed — hardcoding
 * one here would break preview deployments, which each get their own hostname.
 */
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
