import type {
  CityScores,
  MapPoint,
  MobilityBrief,
  TrafficSegment,
} from "@/lib/dashboard-types";

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function comfortTempBonus(b: MobilityBrief): number {
  const mid = (b.tempMinC + b.tempMaxC) / 2;
  if (mid >= 16 && mid <= 28) return 1.2;
  if (mid >= 10 && mid <= 32) return 0.5;
  return 0;
}

/**
 * Heuristic 0–10 scores from the current map snapshot (not a scientific index).
 */
export function computeCityScores(input: {
  mapPoints: MapPoint[];
  mobilityBrief: MobilityBrief | null;
  trafficSegments: TrafficSegment[];
}): CityScores {
  const { mapPoints, mobilityBrief, trafficSegments } = input;
  const food = mapPoints.filter((p) => p.kind === "food").length;
  const parks = mapPoints.filter((p) => p.kind === "park").length;
  const cultureLike = mapPoints.filter((p) =>
    [
      "culture",
      "library",
      "worship",
      "viewpoint",
      "heritage",
      "attraction",
      "film",
    ].includes(p.kind)
  ).length;
  const transit = mapPoints.filter(
    (p) => p.kind === "transit" || p.kind === "bart"
  ).length;
  const parking = mapPoints.filter((p) => p.kind === "parking").length;
  const incidents = mapPoints.filter((p) => p.kind === "incident").length;
  const avgCong =
    trafficSegments.length > 0
      ? trafficSegments.reduce((s, t) => s + t.congestion, 0) /
        trafficSegments.length
      : 0;

  const poiMix = food + parks + cultureLike;
  let activity =
    4 +
    Math.min(3, poiMix / 35) +
    (mobilityBrief && mobilityBrief.peakPrecipPct < 25 ? 1 : 0) -
    (mobilityBrief && mobilityBrief.peakPrecipPct > 55 ? 1.5 : 0);
  activity = clamp(activity, 0, 10);

  let mobility =
    5 +
    Math.min(2.5, transit / 45) +
    Math.min(1.5, parking / 80) -
    Math.min(2, trafficSegments.length * 0.25) -
    Math.min(2, avgCong / 50) -
    Math.min(1.5, incidents * 0.3);
  mobility = clamp(mobility, 0, 10);

  let environment =
    4 +
    Math.min(3, parks / 6) +
    (mobilityBrief ? comfortTempBonus(mobilityBrief) : 0) -
    (mobilityBrief && mobilityBrief.peakPrecipPct > 45 ? 1.5 : 0);
  environment = clamp(environment, 0, 10);

  return {
    activity: round1(activity),
    mobility: round1(mobility),
    environment: round1(environment),
  };
}
