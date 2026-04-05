import type { CityEvent, MapPoint, NamedCount } from "@/lib/dashboard-types";

const FILM_URL =
  "https://data.sfgov.org/resource/yitu-d5am.json?$limit=500&$select=title,locations,release_year,latitude,longitude,analysis_neighborhood";

type FilmRow = {
  title?: string;
  locations?: string;
  release_year?: string;
  latitude?: string;
  longitude?: string;
  analysis_neighborhood?: string;
};

export async function fetchDataSfFilm(): Promise<{
  events: CityEvent[];
  mapPoints: MapPoint[];
  byNeighborhood: NamedCount[];
}> {
  const res = await fetch(FILM_URL, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`DataSF ${res.status}`);
  const rows = (await res.json()) as unknown;
  if (!Array.isArray(rows)) {
    throw new Error("DataSF: response was not a JSON array");
  }
  const counts = new Map<string, number>();
  const events: CityEvent[] = [];
  const mapPoints: MapPoint[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as FilmRow;
    const title = r.title?.trim();
    if (!title) continue;
    const hood = r.analysis_neighborhood?.trim() || "Unknown";
    counts.set(hood, (counts.get(hood) ?? 0) + 1);

    const lat = parseFloat(r.latitude ?? "");
    const lng = parseFloat(r.longitude ?? "");
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

    events.push({
      id: `film-row-${i}`,
      title,
      start: "—",
      venue: r.locations?.trim() || hood,
      expectedCrowd: 0,
      category: r.release_year ? `Film · ${r.release_year}` : "Film location",
      source: "DataSF: Film Locations in San Francisco",
      ...(hasCoords ? { lat, lng } : {}),
    });
    if (mapPoints.length < 90 && hasCoords) {
      mapPoints.push({
        id: `film-m-${i}`,
        lat,
        lng,
        intensity: 0.5,
        label: title,
        kind: "film",
      });
    }
  }

  const byNeighborhood = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 14);

  return { events, mapPoints, byNeighborhood };
}
