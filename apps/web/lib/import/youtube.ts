import * as cheerio from "cheerio";

import type { ExtractResult } from "./extract.ts";

/**
 * YouTube links. A watch page is a JavaScript app with no recipe in its HTML,
 * so this asks YouTube's own player API for what the app would show: the title,
 * the description, and the caption tracks.
 *
 * The description comes first and wins: many cooks paste the ingredient list
 * there. The spoken transcript (the cook's own captions, else YouTube's
 * auto-generated ones) goes after it whenever there is one, because a
 * description with every quantity still rarely says what to do with them.
 *
 * ponytail: the ANDROID client is what works without a key or a PO token today;
 * YouTube changes this every year or so. When it breaks, the fix is a newer
 * clientVersion here, or yt-dlp.
 *
 * From a server IP YouTube may answer LOGIN_REQUIRED (its bot check). The
 * cloud Worker then hands the link to the laptop (`laptopCanRetry`), whose home
 * connection still gets the transcript. On the laptop itself, with
 * YOUTUBE_API_KEY set, the official Data API supplies the title and the
 * description — but no transcript: downloading captions there needs the
 * owner's OAuth.
 */

const PLAYER_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";
const CLIENT = { clientName: "ANDROID", clientVersion: "20.10.38" };
const DATA_API_URL = "https://www.googleapis.com/youtube/v3/videos";
const TIMEOUT_MS = 20_000;
const MAX_CHARS = 12_000;

/** The video id of a youtube.com / youtu.be link, or null for anything else. */
export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^(www|m)\./, "");
  const id =
    host === "youtu.be"
      ? parsed.pathname.slice(1)
      : host === "youtube.com"
        ? parsed.searchParams.get("v") ?? /^\/(?:shorts|live|embed)\/([^/]+)/.exec(parsed.pathname)?.[1]
        : null;
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/**
 * Several lines that start with a quantity — not a chapter timestamp like
 * "0:22" — or an ingredient heading over at least three lines, since plenty of
 * cooks list what goes in without saying how much ("-łopatka wieprzowa").
 */
export function descriptionHasRecipe(description: string): boolean {
  const lines = description.split("\n");
  const quantified = lines.filter(
    (line) => /^\s*(?:[-•*▪️✅]\s*)?[\d½⅓⅔¼¾]/u.test(line) && !/^\s*\d+:\d\d/.test(line),
  );
  if (quantified.length >= 3) return true;

  const heading = lines.findIndex((line) => /^\s*(składniki|ingredients)\b/iu.test(line));
  if (heading === -1) return false;
  const after = lines.slice(heading + 1);
  const listed = after.findIndex((line) => !line.trim());
  return (listed === -1 ? after.length : listed) >= 3;
}

type CaptionTrack = { baseUrl: string; languageCode: string; kind?: string };

/** The cook's own captions over YouTube's guesses; Polish over anything else. */
export function pickCaptionTrack(tracks: readonly CaptionTrack[]): CaptionTrack | null {
  const manual = tracks.filter((track) => track.kind !== "asr");
  return (
    manual.find((track) => track.languageCode.startsWith("pl")) ??
    tracks.find((track) => track.kind === "asr") ??
    manual[0] ??
    null
  );
}

/** A timedtext (srv3) document as plain text, with "[Music]"-style cues dropped. */
export function captionText(xml: string): string {
  const $ = cheerio.load(xml, { xml: true });
  return $("p")
    .map((_, element) => $(element).text())
    .get()
    .join(" ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type PlayerResponse = {
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: {
    title?: string;
    shortDescription?: string;
    author?: string;
    lengthSeconds?: string;
    thumbnail?: { thumbnails?: { url: string; width?: number }[] };
  };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
};

type DataApiResponse = {
  items?: {
    snippet?: {
      title?: string;
      description?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url: string; width?: number }>;
    };
  }[];
};

/** The same video from the official Data API, shaped like a captionless player response. */
async function playerFromDataApi(videoId: string, key: string): Promise<PlayerResponse> {
  const url = `${DATA_API_URL}?part=snippet&id=${videoId}&key=${encodeURIComponent(key)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Data API HTTP ${response.status}`);
  const snippet = ((await response.json()) as DataApiResponse).items?.[0]?.snippet;
  if (!snippet) return { playabilityStatus: { status: "ERROR", reason: "Data API: no such video" } };
  return {
    playabilityStatus: { status: "OK" },
    videoDetails: {
      title: snippet.title,
      shortDescription: snippet.description,
      author: snippet.channelTitle,
      thumbnail: { thumbnails: Object.values(snippet.thumbnails ?? {}) },
    },
  };
}

export async function extractFromYoutube(
  videoId: string,
  { laptopCanRetry = false }: { laptopCanRetry?: boolean } = {},
): Promise<ExtractResult> {
  const started = Date.now();
  let player: PlayerResponse;
  try {
    const response = await fetch(PLAYER_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ context: { client: CLIENT }, videoId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, reason: "fetch-blocked", detail: `YouTube HTTP ${response.status}` };
    player = (await response.json()) as PlayerResponse;
    if (player.playabilityStatus?.status === "LOGIN_REQUIRED") {
      if (laptopCanRetry) return { ok: false, reason: "login-required", detail: "YouTube: LOGIN_REQUIRED" };
      const key = process.env.YOUTUBE_API_KEY?.trim();
      if (key) player = await playerFromDataApi(videoId, key);
    }
  } catch (error) {
    return { ok: false, reason: "fetch-blocked", detail: `YouTube: ${(error as Error).message}` };
  }

  const status = player.playabilityStatus?.status;
  if (status !== "OK") {
    const detail = `YouTube: ${status ?? "?"} ${player.playabilityStatus?.reason ?? ""}`.trim();
    return { ok: false, reason: status === "ERROR" ? "not-found" : "fetch-blocked", detail };
  }

  const details = player.videoDetails ?? {};
  const title = details.title?.trim() || null;
  const description = details.shortDescription?.trim() ?? "";

  let transcript = "";
  const track = pickCaptionTrack(player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []);
  if (track) {
    try {
      const response = await fetch(track.baseUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (response.ok) transcript = captionText(await response.text());
    } catch {
      // Not fatal: the description may still be enough.
    }
  }

  const text = [
    title && `Tytuł filmu: ${title}`,
    description && `Opis filmu:\n${description}`,
    transcript && `Transkrypcja tego, co mówi autor (automatyczna, bez interpunkcji, mogą być błędy):\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_CHARS);

  if (!transcript && !descriptionHasRecipe(description)) {
    return { ok: false, reason: "no-recipe-found", detail: "YouTube: brak przepisu w opisie i brak napisów" };
  }

  const thumbnails = details.thumbnail?.thumbnails ?? [];
  const biggest = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];

  return {
    ok: true,
    page: {
      path: "video",
      title,
      imageUrl: biggest?.url ?? null,
      ingredients: [],
      instructions: [],
      servings: null,
      totalMinutes: null,
      kcalPerServing: null,
      author: details.author ?? null,
      text,
    },
    fetched: { status: 200, bytes: Buffer.byteLength(text), ms: Date.now() - started },
  };
}
