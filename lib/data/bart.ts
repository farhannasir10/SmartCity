import type { MapPoint } from "@/lib/dashboard-types";
import bartFallback from "./bart-fallback-stations.json";

const DEFAULT_KEY = "MW9S-E7SL-26DU-VV8V";

type BartStation = {
  name?: string;
  gtfs_latitude?: string;
  gtfs_longitude?: string;
  abbr?: string;
};

function normalizeStations(raw: unknown): BartStation[] {
  if (!raw || typeof raw !== "object") return [];
  const root = (raw as { root?: { stations?: { station?: unknown } } }).root;
  const s = root?.stations?.station;
  if (Array.isArray(s)) return s as BartStation[];
  if (s && typeof s === "object") return [s as BartStation];
  return [];
}

function stationsToMapPoints(stations: BartStation[]): MapPoint[] {
  return stations
    .map((st) => {
      const lat = parseFloat(st.gtfs_latitude ?? "");
      const lng = parseFloat(st.gtfs_longitude ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !st.name)
        return null;
      return {
        id: `bart-${st.abbr ?? st.name}`,
        lat,
        lng,
        intensity: 0.55,
        label: `BART: ${st.name}`,
        kind: "bart" as const,
      };
    })
    .filter(Boolean) as MapPoint[];
}

export async function fetchBartMapPoints(): Promise<MapPoint[]> {
  const envKey = process.env.BART_API_KEY?.trim();
  const keys =
    envKey && envKey !== DEFAULT_KEY ? [envKey, DEFAULT_KEY] : [DEFAULT_KEY];

  for (const key of keys) {
    try {
      const url = `https://api.bart.gov/api/stn.aspx?cmd=stns&json=y&key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "CityPulseDashboard/1.0 (BART station map; educational portfolio)",
        },
      });
      if (!res.ok) continue;

      const text = await res.text();
      const cleaned = text.replace(/^\uFEFF/, "").trimStart();
      if (cleaned.startsWith("<") || cleaned.startsWith("<!DOCTYPE")) continue;

      let data: unknown;
      try {
        data = JSON.parse(cleaned) as unknown;
      } catch {
        continue;
      }

      const stations = normalizeStations(data);
      const points = stationsToMapPoints(stations);
      if (points.length > 0) return points;
    } catch {
      /* try next key or fallback */
    }
  }

  return stationsToMapPoints(bartFallback as BartStation[]);
}
