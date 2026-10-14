import { useQueryClient } from "@tanstack/react-query";
import type { DraftStatus } from "@openrecipe/core/drafts";
import { usePathname, useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";

import { useDraftPulse } from "../../lib/hooks/drafts";
import { pulseMap, pulseToasts } from "../../lib/pulse";
import { showToast } from "../ui/toast";

/**
 * MC Kiełbas announces a Draft the Worker has finished, on whatever screen you
 * are on. Admin only (the caller gates it); polling pauses in the background
 * through the AppState-driven focusManager.
 */
export function PulseToasts() {
  const router = useRouter();
  const qc = useQueryClient();
  const pathname = usePathname();
  const openId = /^\/drafts\/([^/]+)$/.exec(pathname)?.[1] ?? null;
  const { data } = useDraftPulse(true);
  const previous = useRef<Map<string, DraftStatus> | null>(null);
  const open = useRef(openId);
  open.current = openId;

  useEffect(() => {
    if (!data) return;
    const toasts = pulseToasts(previous.current, data.drafts, open.current);
    previous.current = pulseMap(data.drafts);
    if (toasts.length === 0) return;
    for (const t of toasts) {
      showToast({
        message: t.message,
        action: { label: t.actionLabel, onPress: () => router.push(t.href as Href) },
      });
    }
    // The list and the Home counters changed under the user.
    qc.invalidateQueries({ queryKey: ["drafts"], exact: true });
    qc.invalidateQueries({ queryKey: ["home"] });
  }, [data, router, qc]);

  return null;
}
