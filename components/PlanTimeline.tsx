"use client";

import type { VisualPlanStep } from "@/lib/dashboard-types";
import { openStreetMapPinUrl } from "@/lib/map-links";

type Props = {
  steps: VisualPlanStep[];
};

export default function PlanTimeline({ steps }: Props) {
  if (!steps.length) return null;

  return (
    <div className="mt-3 border-t border-slate-700/60 pt-3">
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        Timeline · real names & pins from this search
      </p>
      <ul className="space-y-2.5">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-3">
            <div className="flex w-[4.25rem] shrink-0 flex-col items-end gap-0.5 pt-0.5 text-right">
              <span className="text-[10px] font-semibold tabular-nums text-cyan-400">
                {s.timeLabel}
              </span>
              <span className="text-base leading-none" aria-hidden>
                {s.emoji}
              </span>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-cyan-900/35 bg-gradient-to-br from-cyan-950/35 to-slate-900/55 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {s.headline}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-white">{s.placeName}</p>
              {s.subtitle ? (
                <p className="mt-0.5 text-xs leading-snug text-slate-400">{s.subtitle}</p>
              ) : null}
              <a
                href={openStreetMapPinUrl(s.lat, s.lng)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                <span aria-hidden>📍</span>
                Map pin
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
