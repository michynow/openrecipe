import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /**
     * Recipe images live in this instance's Blob store (OR-22). The store id is a
     * subdomain assigned by Vercel, hence the wildcard; `pathname` stays open
     * because `addRandomSuffix` decides the path.
     */
    remotePatterns: [
      /**
       * Recipe images are NOT here: the Blob store is private, so they are served
       * same-origin through /api/image and need no pattern at all (OR-22).
       */
      /**
       * Google account avatars, shown as the Recipe's author. Not ours and not
       * uploaded — Better Auth stores whatever URL the provider hands over, and
       * without this entry the Recipe page throws the moment anyone who signed
       * in with Google has authored something.
       */
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
