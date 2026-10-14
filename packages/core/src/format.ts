/**
 * pl-PL formatting. Everything user-visible goes through here — no ad-hoc
 * `toLocaleDateString` calls scattered around components.
 */

/** The three Polish plural forms. English's two are not enough. */
export type PluralForms = {
  /** 1 porcja */
  one: string;
  /** 2, 3, 4 porcje — and 22, 23, 24 */
  few: string;
  /** 0, 5…21 porcji — and fractions */
  many: string;
};

/**
 * Pick the right form for `n`.
 *
 * The CLDR rule for Polish, written out by hand rather than via
 * `Intl.PluralRules`: Hermes on Android (the phone app) has no PluralRules and
 * a module-level `new` crashes every screen that imports this file. Fractions
 * (1,5 porcji) take the same genitive form as `many`.
 */
export function plural(n: number, forms: PluralForms): string {
  if (!Number.isInteger(n)) return forms.many;
  const abs = Math.abs(n);
  if (abs === 1) return forms.one;
  const tens = abs % 100;
  if (abs % 10 >= 2 && abs % 10 <= 4 && (tens < 12 || tens > 14)) return forms.few;
  return forms.many;
}

/** "1 porcja", "3 porcje", "7 porcji" */
export function count(n: number, forms: PluralForms): string {
  return `${formatNumber(n)} ${plural(n, forms)}`;
}

const numberFormat = new Intl.NumberFormat("pl-PL", {
  maximumFractionDigits: 2,
});

/** Polish uses a comma as the decimal separator: 1,5 — not 1.5 */
export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

const dateFormat = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "12 czerwca 2026" */
export function formatDate(value: Date | string | number): string {
  return dateFormat.format(new Date(value));
}

/** Hand-rolled for the same reason as `plural`: Hermes has no RelativeTimeFormat. */
const RELATIVE = {
  day: {
    forms: { one: "dzień", few: "dni", many: "dni" },
    near: { "-2": "przedwczoraj", "-1": "wczoraj", "0": "dzisiaj", "1": "jutro", "2": "pojutrze" },
  },
  month: {
    forms: { one: "miesiąc", few: "miesiące", many: "miesięcy" },
    near: { "-1": "w zeszłym miesiącu", "0": "w tym miesiącu", "1": "w przyszłym miesiącu" },
  },
  year: {
    forms: { one: "rok", few: "lata", many: "lat" },
    near: { "-1": "w zeszłym roku", "0": "w tym roku", "1": "w przyszłym roku" },
  },
} satisfies Record<string, { forms: PluralForms; near: Record<string, string> }>;

/** Same output as `Intl.RelativeTimeFormat("pl-PL", { numeric: "auto" })`. */
function relative(n: number, unit: keyof typeof RELATIVE): string {
  const { forms, near } = RELATIVE[unit];
  const word = (near as Record<string, string>)[String(n)];
  if (word) return word;
  const phrase = `${formatNumber(Math.abs(n))} ${plural(Math.abs(n), forms)}`;
  return n < 0 ? `${phrase} temu` : `za ${phrase}`;
}

/**
 * "wczoraj", "3 dni temu", "2 miesiące temu" — for added dates and Cook Log
 * entries, where the exact day rarely matters.
 */
export function formatRelativeDays(value: Date | string | number): string {
  const then = new Date(value);
  const days = Math.round((then.getTime() - Date.now()) / 86_400_000);

  if (Math.abs(days) < 30) return relative(days, "day");
  if (Math.abs(days) < 365)
    return relative(Math.round(days / 30), "month");
  return relative(Math.round(days / 365), "year");
}

/** "35 min", "1 h 15 min" — nothing at all when the Recipe has no time. */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

const clockFormat = new Intl.DateTimeFormat("pl-PL", {
  timeZone: "Europe/Warsaw",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * "12.10, 21:52" on the household's clock — for a time that is coming, like a
 * retry after a usage limit. The zone is pinned: the Worker runs in UTC and
 * the server renders in UTC, but the reader lives in Warsaw.
 */
export function formatClock(value: Date | string | number): string {
  return clockFormat.format(new Date(value));
}
