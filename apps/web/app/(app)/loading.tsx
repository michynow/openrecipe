import { copy } from "@openrecipe/core/copy";

/**
 * Every page under (app) is dynamic, so without this a click waits for the
 * server's whole answer before anything moves. With it the header stays, this
 * shows at once, and the page streams in behind it.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 text-muted sm:px-6" aria-busy="true">
      {copy.common.loading}
    </main>
  );
}
