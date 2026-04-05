import type { AlertItem, MapPoint, TrafficSegment } from "@/lib/dashboard-types";

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** Open511 Traffic JSON uses GeoJSON under `geography` ([lng, lat]). */
function coordinatesFromEvent(e: Record<string, unknown>): {
  lat: number;
  lng: number;
} | null {
  const g = e.geography;
  if (g && typeof g === "object") {
    const geo = g as Record<string, unknown>;
    const type = String(geo.type ?? "");
    const c = geo.coordinates;
    const pairFrom = (lng: unknown, lat: unknown) => {
      const la = Number(lat);
      const ln = Number(lng);
      return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
    };
    if (type === "Point" && Array.isArray(c) && c.length >= 2) {
      const p = pairFrom(c[0], c[1]);
      if (p) return p;
    }
    if (type === "LineString" && Array.isArray(c) && c[0] && Array.isArray(c[0])) {
      const p0 = c[0] as unknown[];
      const p = pairFrom(p0[0], p0[1]);
      if (p) return p;
    }
    if (type === "MultiPoint" && Array.isArray(c) && c[0] && Array.isArray(c[0])) {
      const p0 = c[0] as unknown[];
      const p = pairFrom(p0[0], p0[1]);
      if (p) return p;
    }
    if (type === "MultiLineString" && Array.isArray(c) && c[0]) {
      const line = c[0] as unknown[];
      if (Array.isArray(line?.[0])) {
        const p0 = line[0] as unknown[];
        const p = pairFrom(p0[0], p0[1]);
        if (p) return p;
      }
    }
  }
  const lat =
    typeof e.latitude === "number"
      ? e.latitude
      : typeof e.Latitude === "number"
        ? e.Latitude
        : parseFloat(String(e.latitude ?? e.Latitude ?? ""));
  const lng =
    typeof e.longitude === "number"
      ? e.longitude
      : typeof e.Longitude === "number"
        ? e.Longitude
        : parseFloat(String(e.longitude ?? e.Longitude ?? ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function flatten511Events(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const root = data as Record<string, unknown>;

  if (Array.isArray(root.features)) {
    return root.features.map((f) =>
      f && typeof f === "object" ? (f as Record<string, unknown>) : {}
    );
  }

  const events = root.Events ?? root.events ?? root.Event;
  if (Array.isArray(events)) {
    return events.filter((e) => e && typeof e === "object") as Record<
      string,
      unknown
    >[];
  }
  if (events && typeof events === "object") {
    return [events as Record<string, unknown>];
  }

  if (Array.isArray(root)) {
    return root.filter((e) => e && typeof e === "object") as Record<
      string,
      unknown
    >[];
  }

  return [];
}

function eventHeadline(e: Record<string, unknown>): string {
  return (
    pickString(
      e.headline,
      e.Headline,
      e.title,
      e.Title,
      e.description,
      e.Description,
      e.roadway,
      e.RoadwayName
    ) ?? "Traffic event"
  );
}

/** Map Open511 severity (MINOR | MODERATE | MAJOR | UNKNOWN) to a 0–100-style score. */
function severityToCongestion(e: Record<string, unknown>): number {
  const s = pickString(
    e.severity,
    e.Severity,
    e.eventType,
    e.EventType,
    e.impact,
    e.Impact
  )?.toUpperCase();
  if (!s) return 55;
  if (
    s.includes("MAJOR") ||
    s.includes("HIGH") ||
    s.includes("CRITICAL") ||
    s.includes("CLOSURE")
  )
    return 88;
  if (s.includes("MODERATE") || s.includes("MEDIUM")) return 68;
  if (s.includes("MINOR") || s.includes("LOW")) return 42;
  if (s.includes("UNKNOWN")) return 55;
  return 58;
}

export type Traffic511Result = {
  mapPoints: MapPoint[];
  trafficSegments: TrafficSegment[];
  alerts: AlertItem[];
  byType: { name: string; count: number }[];
};

export async function fetch511Traffic(
  apiKey: string | undefined
): Promise<Traffic511Result | null> {
  const key = apiKey?.trim();
  if (!key) return null;

  const params = new URLSearchParams({ api_key: key, format: "json" });
  const url = `https://api.511.org/traffic/events?${params}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`511 ${res.status}`);

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`511: expected JSON (${text.slice(0, 120)}…)`);
  }
  const raw = flatten511Events(data);

  const mapPoints: MapPoint[] = [];
  const trafficSegments: TrafficSegment[] = [];
  const alerts: AlertItem[] = [];
  const typeCounts = new Map<string, number>();

  for (let i = 0; i < raw.length; i++) {
    const e = raw[i];
    const headline = eventHeadline(e);
    const type =
      pickString(e.event_type, e.eventType, e.EventType, e.type, e.Type) ??
      "Event";
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);

    const ll = coordinatesFromEvent(e);
    if (ll && mapPoints.length < 40) {
      mapPoints.push({
        id: `511-${i}`,
        lat: ll.lat,
        lng: ll.lng,
        intensity: Math.min(0.95, 0.45 + severityToCongestion(e) / 200),
        label: headline.slice(0, 80),
        kind: "incident",
      });
    }

    if (trafficSegments.length < 8) {
      trafficSegments.push({
        id: `511-t-${i}`,
        name: headline.slice(0, 56),
        congestion: severityToCongestion(e),
        trend: "flat",
        etaMin: Math.max(5, Math.round(20 - severityToCongestion(e) / 8)),
        sourceNote: "511 SF Bay traffic events",
      });
    }

    if (alerts.length < 6) {
      alerts.push({
        id: `511-a-${i}`,
        level: severityToCongestion(e) >= 75 ? "warning" : "info",
        text: headline.slice(0, 140),
        source: "511.org",
      });
    }
  }

  const byType = [...typeCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { mapPoints, trafficSegments, alerts, byType };
}
