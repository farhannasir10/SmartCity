import type {
  MobilityBrief,
  NamedCount,
  ResourceRec,
  SmartInsight,
  TrafficSegment,
} from "@/lib/dashboard-types";

export function buildSmartInsights(input: {
  mobilityBrief: MobilityBrief | null;
  trafficSegments: TrafficSegment[];
  resourceRecommendations: ResourceRec[];
  geocodeError: string | null;
  osmLayerCounts: NamedCount[];
}): SmartInsight[] {
  const out: SmartInsight[] = [];
  const { mobilityBrief, trafficSegments, resourceRecommendations } = input;

  if (input.geocodeError) {
    return [
      {
        id: "geo",
        headline: "Pick a place to unlock insights",
        body: "Search for a city or neighborhood to load weather, map signals, and tailored suggestions.",
        variant: "info",
      },
    ];
  }

  if (mobilityBrief) {
    const p = mobilityBrief.peakPrecipPct;
    if (p >= 40) {
      out.push({
        id: "wx-outdoor",
        headline: "Outdoor plans may need a backup",
        body: `Peak rain likelihood is around ${Math.round(p)}% (${mobilityBrief.peakPrecipTime}). Favour indoor venues, covered stops, or short hops between cafés and galleries.`,
        variant: "watch",
      });
    } else if (p < 18) {
      out.push({
        id: "wx-clear",
        headline: "Friendly window for walking around",
        body: `Rain stays relatively low (~${Math.round(p)}% peak). Good moment to chain parks, food stops, and sights on foot if you like being outside.`,
        variant: "good",
      });
    } else if (p < 40) {
      out.push({
        id: "wx-mixed",
        headline: "Mixed sky — keep a dry backup",
        body: `Peak rain around ${Math.round(p)}% (${mobilityBrief.peakPrecipTime}). Outdoor plans can work; tuck in a café, gallery, or covered stop between legs.`,
        variant: "info",
      });
    }
  }

  if (trafficSegments.length >= 4) {
    out.push({
      id: "traffic-busy",
      headline: "Allow extra time on the road",
      body: "Several active traffic items appear in this snapshot — pad travel times, check live navigation, or consider transit where it is available.",
      variant: "watch",
    });
  }

  for (const r of resourceRecommendations.slice(0, 2)) {
    out.push({
      id: `rec-${r.id}`,
      headline:
        r.priority === "high"
          ? "Worth attention now"
          : "Signal from your data",
      body: `${r.action} ${r.reason ? `— ${r.reason}` : ""}`.trim(),
      variant: r.priority === "high" ? "watch" : "info",
    });
  }

  const osmTotal = input.osmLayerCounts.reduce((s, x) => s + x.count, 0);
  if (osmTotal > 0 && osmTotal < 25 && out.length < 4) {
    out.push({
      id: "sparse-osm",
      headline: "Lighter map coverage here",
      body: "Fewer mapped amenities showed up in this view — use suggestions as starting points and confirm hours on official sites.",
      variant: "info",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "calm",
      headline: "Calm snapshot",
      body: "No strong weather or traffic warnings in the current feeds. Explore layers on the map to see what is mapped nearby.",
      variant: "info",
    });
  }

  return out.slice(0, 8);
}
