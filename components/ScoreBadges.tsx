import type { CityScores } from "@/lib/dashboard-types";

type Props = { scores: CityScores };

export default function ScoreBadges({ scores }: Props) {
  const items: {
    label: string;
    emoji: string;
    value: number;
    accent: string;
  }[] = [
    {
      label: "Activity",
      emoji: "🟢",
      value: scores.activity,
      accent: "border-emerald-900/40 bg-emerald-950/25 text-emerald-200",
    },
    {
      label: "Mobility",
      emoji: "🚗",
      value: scores.mobility,
      accent: "border-amber-900/40 bg-amber-950/20 text-amber-100",
    },
    {
      label: "Environment",
      emoji: "🌿",
      value: scores.environment,
      accent: "border-teal-900/40 bg-teal-950/25 text-teal-100",
    },
  ];

  return (
    <div className="mt-3 hidden flex flex-wrap gap-2" aria-hidden>
      {items.map((x) => (
        <div
          key={x.label}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${x.accent}`}
          title="Heuristic 0–10 from this snapshot (weather, POI density, traffic signals). Not a scientific index."
        >
          <span className="text-sm" aria-hidden>
            {x.emoji}
          </span>
          <div>
            <span className="font-medium text-slate-200">{x.label} score</span>
            <span className="ml-2 font-mono text-sm font-semibold tabular-nums text-white">
              {x.value.toFixed(1)}/10
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
