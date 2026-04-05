import type { DashboardData, VisualPlanStep } from "@/lib/dashboard-types";
import {
  pickNamedCultureVenues,
  pickNamedMobilityPlaces,
  type NamedPlaceHint,
} from "@/lib/osm-place-names";

export function wantsVisualPlanMessage(content: string): boolean {
  return /\b(plan|itinerary|suggest|what should i|things to do|have \d+\s*h|two hours|one hour|\d+\s*hours?)\b/i.test(
    content
  );
}

function dedupeNamed(hints: NamedPlaceHint[]): NamedPlaceHint[] {
  const seen = new Set<string>();
  const out: NamedPlaceHint[] = [];
  for (const h of hints) {
    const k = h.name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
  }
  return out;
}

/**
 * Deterministic sample day from named OSM rows (real coordinates for map links).
 */
export function buildVisualPlanFromDashboard(
  d: DashboardData
): VisualPlanStep[] {
  if (d.geocodeError) return [];

  const food = pickNamedMobilityPlaces(
    d.mobilityPlaceLists["Food & drink"] ?? [],
    8,
    160
  );
  const parks = pickNamedMobilityPlaces(
    d.mobilityPlaceLists["Parks"] ?? [],
    8,
    160
  );
  const arts = pickNamedMobilityPlaces(
    d.mobilityPlaceLists["Arts & culture"] ?? [],
    6,
    120
  );
  const visit = pickNamedCultureVenues(d.cultureVenues, 6, 120);
  const culturePool = dedupeNamed([...arts, ...visit]);

  const slots: {
    timeLabel: string;
    emoji: string;
    headline: string;
    kind: "food" | "culture" | "park";
  }[] = [
    { timeLabel: "9:00 AM", emoji: "☕", headline: "Breakfast & coffee", kind: "food" },
    {
      timeLabel: "10:30 AM",
      emoji: "🎨",
      headline: "Culture & sights",
      kind: "culture",
    },
    { timeLabel: "12:30 PM", emoji: "🍽", headline: "Lunch", kind: "food" },
    { timeLabel: "2:00 PM", emoji: "🌳", headline: "Park walk", kind: "park" },
  ];

  let fi = 0;
  let ci = 0;
  let pi = 0;
  const steps: VisualPlanStep[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    let hint: NamedPlaceHint | undefined;
    if (slot.kind === "food") {
      hint = food[fi];
      if (hint) fi += 1;
    } else if (slot.kind === "culture") {
      hint = culturePool[ci];
      if (hint) ci += 1;
    } else {
      hint = parks[pi];
      if (hint) pi += 1;
    }
    if (!hint) continue;

    steps.push({
      id: `vp-step-${steps.length}`,
      timeLabel: slot.timeLabel,
      emoji: slot.emoji,
      headline: slot.headline,
      placeName: hint.name,
      subtitle: hint.where,
      lat: hint.lat,
      lng: hint.lng,
    });
  }

  return steps;
}
