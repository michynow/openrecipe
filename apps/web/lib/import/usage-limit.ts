/**
 * The Master's Claude subscription ran out for now (ADR-0006). Not the page's
 * fault and not the Worker's: the same link will import fine once the limit
 * resets, so the Draft waits for that instead of failing.
 *
 * The CLI says so in prose, which is all there is to go on:
 *
 *   You've hit your session limit · resets 9:50pm (UTC)
 *   You've hit your weekly limit · resets Oct 15, 9pm (Europe/Warsaw)
 *   Claude AI usage limit reached|1760306400          (older CLIs, epoch seconds)
 */

const LIMIT = /hit your [\w ]*limit|usage limit reached|(session|weekly) limit/i;
const EPOCH = /limit reached\|(\d{10})/i;
const RESETS = /resets\s+(?:([A-Z][a-z]{2})\w*\s+(\d{1,2}),?\s+(?:at\s+)?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?:\s*\(([^)]+)\))?/i;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Without a readable reset time: try again in an hour, the cron's second pass. */
export const LIMIT_FALLBACK_MS = 60 * 60_000;

/** A little past the stated reset, so the first retry does not land a second early. */
const SLACK_MS = 2 * 60_000;

export function isUsageLimit(message: string | undefined): boolean {
  return !!message && LIMIT.test(message);
}

/**
 * When to try again, or null when the message is not about a usage limit.
 * Never in the past: a reset time that already went by means "tomorrow" for a
 * bare clock time, and an unreadable one means the fallback.
 */
export function usageLimitRetryAt(message: string | undefined, now: Date = new Date()): Date | null {
  if (!message || !isUsageLimit(message)) return null;

  const epoch = EPOCH.exec(message);
  if (epoch) return atLeast(new Date(Number(epoch[1]) * 1000 + SLACK_MS), now);

  const resets = RESETS.exec(message);
  if (!resets) return new Date(now.getTime() + LIMIT_FALLBACK_MS);

  const [, monthName, dayText, hourText, minuteText, meridiem, zone] = resets;
  const hour = (Number(hourText) % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
  const minute = Number(minuteText ?? 0);
  const offset = zoneOffsetMs(zone?.trim() || "UTC", now);
  if (offset === null) return new Date(now.getTime() + LIMIT_FALLBACK_MS);

  // Wall-clock fields in the CLI's zone, as if they were UTC, then shifted.
  const local = new Date(now.getTime() + offset);
  const month = monthName ? MONTHS.indexOf(monthName.toLowerCase()) : local.getUTCMonth();
  const day = dayText ? Number(dayText) : local.getUTCDate();
  if (month === -1) return new Date(now.getTime() + LIMIT_FALLBACK_MS);

  let at = Date.UTC(local.getUTCFullYear(), month, day, hour, minute) - offset;
  if (at <= now.getTime()) {
    // A bare time already gone by is tomorrow's; a dated one is next year's.
    at = monthName
      ? Date.UTC(local.getUTCFullYear() + 1, month, day, hour, minute) - offset
      : at + 24 * 60 * 60_000;
  }

  return new Date(at + SLACK_MS);
}

const atLeast = (at: Date, now: Date) => (at.getTime() > now.getTime() ? at : new Date(now.getTime() + SLACK_MS));

/** How far `zone` is ahead of UTC at `now`, or null for a zone Intl does not know. */
function zoneOffsetMs(zone: string, now: Date): number | null {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      })
        .formatToParts(now)
        .map((part) => [part.type, Number(part.value)]),
    );
    const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return wall - Math.floor(now.getTime() / 1000) * 1000;
  } catch {
    return null;
  }
}
