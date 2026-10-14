import type { Metadata } from "next";
import Image from "next/image";

import { copy } from "@openrecipe/core/copy";

import icon from "./icon.png";
import { ShareButton } from "./share-button";

/** Public on purpose (proxy.ts): you open this before you have the app, so before you are signed in. */
const APK_URL = "https://github.com/michynow/openrecipe/releases/latest/download/openrecipe.apk";

export const metadata: Metadata = { title: copy.appDownload.title };

export default function AppDownloadPage() {
  const t = copy.appDownload;

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <Image src={icon} alt={t.iconAlt} width={128} height={128} priority className="rounded-card border-2 border-line" />
      <h1 className="font-display text-3xl uppercase tracking-tight">{t.title}</h1>
      <p className="text-muted">{t.pitch}</p>

      <a
        href={APK_URL}
        className="w-full rounded-input bg-accent px-6 py-4 font-display text-xl uppercase text-accent-ink"
      >
        {t.download}
      </a>

      <section className="w-full rounded-card border border-line bg-surface p-4 text-left">
        <h2 className="mb-2 font-display text-xl uppercase">{t.stepsTitle}</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {t.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <ShareButton />
    </div>
  );
}
