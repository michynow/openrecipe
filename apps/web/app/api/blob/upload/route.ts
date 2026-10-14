import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { IMAGE_RULES } from "@/lib/recipe-schema";
import { getCurrentUser } from "@/lib/session";

/**
 * Mints the short-lived token the editor uses to upload straight to Blob (OR-22).
 *
 * The bytes never pass through this function — the browser sends them to Blob
 * itself, which is what makes a progress bar and a cancel possible. What this
 * route decides is *whether* an upload may happen and under what limits, and Blob
 * enforces those limits itself: a client that lies about size or type is rejected
 * by the store, not merely by our UI.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => {
        // Admins only. This is a public endpoint that hands out write access.
        const user = await getCurrentUser();
        if (!user?.isAdmin) throw new Error("Unauthorised");

        return {
          allowedContentTypes: [...IMAGE_RULES.mimeTypes],
          maximumSizeInBytes: IMAGE_RULES.maxBytes,
          /**
           * Two people uploading `IMG_2043.webp` must not overwrite each other,
           * and a Recipe's old image must survive until the save that replaces it
           * (lib/recipes.ts deletes it then, deliberately).
           */
          addRandomSuffix: true,
        };
      },
      // No onUploadCompleted: nothing is written to the database until the editor
      // is saved, so there is nothing for a completion callback to do.
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
