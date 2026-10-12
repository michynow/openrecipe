import { Icon, type IconName } from "@/components/icons";

/** A gold HUD tile: icon, the number big, what it is small. */
export function StatTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border-2 border-line bg-gold px-4 py-2 text-ink">
      <Icon name={icon} className="size-8 shrink-0" />
      <div className="flex flex-col-reverse">
        <dt className="text-xs font-extrabold uppercase tracking-wide">{label}</dt>
        <dd className="font-mono text-2xl font-bold leading-tight tabular-nums">{value}</dd>
      </div>
    </div>
  );
}
