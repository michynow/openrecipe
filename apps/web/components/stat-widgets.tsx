import Link from "next/link";

import { copy } from "@/lib/copy";
import type { DashboardStats } from "@/lib/dashboard-query";
import { count, formatNumber, plural } from "@/lib/format";

/**
 * The dashboard's numbers (OR-47).
 *
 * A tile is only rendered when it has something to say: zero Drafts waiting is
 * not news, and a "most cooked" tile on a library nobody has cooked from is a
 * label over an empty space. The grid is what is true today, not a fixed set of
 * six boxes with dashes in four of them.
 */
export function StatWidgets({ stats }: { stats: DashboardStats }) {
  const { total, addedThisWeek, cookedThisWeek, draftsWaiting } = stats;

  if (total === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label={copy.dashboard.total} value={formatNumber(total)} />

      {addedThisWeek > 0 && (
        <Tile
          label={copy.dashboard.addedThisWeek}
          value={formatNumber(addedThisWeek)}
        />
      )}

      {cookedThisWeek > 0 && (
        <Tile
          label={copy.dashboard.cookedThisWeek}
          value={formatNumber(cookedThisWeek)}
        />
      )}

      {draftsWaiting > 0 && (
        <Tile
          label={copy.dashboard.draftsWaiting}
          value={formatNumber(draftsWaiting)}
          href="/drafts"
          accent
        />
      )}

      {stats.mostCooked && (
        <Tile
          label={copy.dashboard.mostCooked}
          value={stats.mostCooked.title}
          detail={count(stats.mostCooked.times, copy.units.times)}
          href={`/recipes/${stats.mostCooked.slug}`}
          wide
        />
      )}

      {stats.neglected && (
        <Tile
          label={copy.dashboard.neglected}
          value={stats.neglected.title}
          detail={
            stats.neglected.days === null
              ? copy.dashboard.neverCooked
              : `${stats.neglected.days} ${plural(stats.neglected.days, copy.units.days)} temu`
          }
          href={`/recipes/${stats.neglected.slug}`}
          wide
        />
      )}
    </ul>
  );
}

function Tile({
  label,
  value,
  detail,
  href,
  accent = false,
  wide = false,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  accent?: boolean;
  wide?: boolean;
}) {
  const body = (
    <>
      <span className="text-sm font-extrabold uppercase tracking-wide text-text">
        {label}
      </span>
      <span
        className={`font-display text-2xl uppercase leading-tight ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </span>
      {detail && <span className="text-sm text-muted">{detail}</span>}
    </>
  );

  return (
    <li className={wide ? "col-span-2" : ""}>
      {href ? (
        <Link
          href={href}
          className="flex h-full flex-col gap-1 rounded-card border border-line bg-surface p-3 transition-colors hover:border-muted"
        >
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col gap-1 rounded-card border border-line bg-surface p-3">
          {body}
        </div>
      )}
    </li>
  );
}
