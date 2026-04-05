/**
 * OpenStreetMap Nominatim — free geocoding.
 * Policy: https://operations.osmfoundation.org/policies/nominatim/ (identify app, cache, be polite).
 */

export type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
  south: number;
  west: number;
  north: number;
  east: number;
};

const UA =
  "CityPulseDashboard/1.0 (local portfolio; contact via repo owner)";

function clampBBox(
  south: number,
  west: number,
  north: number,
  east: number,
  maxSpanDeg = 0.14
): { south: number; west: number; north: number; east: number } {
  const midLat = (south + north) / 2;
  const midLon = (west + east) / 2;
  const ns = north - south;
  const ew = east - west;
  if (ns > maxSpanDeg) {
    south = midLat - maxSpanDeg / 2;
    north = midLat + maxSpanDeg / 2;
  }
  if (ew > maxSpanDeg) {
    west = midLon - maxSpanDeg / 2;
    east = midLon + maxSpanDeg / 2;
  }
  return { south, west, north, east };
}

export async function geocodePlace(
  query: string
): Promise<GeocodeResult | null> {
  const q = query.trim().slice(0, 200);
  if (!q) return null;

  const params = new URLSearchParams({
    q,
    format: "json",
    limit: "1",
    addressdetails: "0",
  });
  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as {
    lat?: string;
    lon?: string;
    display_name?: string;
    boundingbox?: [string, string, string, string];
  }[];
  const hit = rows[0];
  if (!hit?.lat || !hit?.lon) return null;

  const lat = parseFloat(hit.lat);
  const lon = parseFloat(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  let south: number;
  let north: number;
  let west: number;
  let east: number;

  if (hit.boundingbox?.length === 4) {
    south = parseFloat(hit.boundingbox[0]);
    north = parseFloat(hit.boundingbox[1]);
    west = parseFloat(hit.boundingbox[2]);
    east = parseFloat(hit.boundingbox[3]);
    if (![south, north, west, east].every(Number.isFinite)) {
      south = lat - 0.04;
      north = lat + 0.04;
      west = lon - 0.05;
      east = lon + 0.05;
    }
  } else {
    south = lat - 0.04;
    north = lat + 0.04;
    west = lon - 0.05;
    east = lon + 0.05;
  }

  const box = clampBBox(south, west, north, east);

  return {
    lat,
    lon,
    displayName: hit.display_name ?? q,
    ...box,
  };
}

/** BART + 511 SF Bay jurisdiction (rough bounding box). */
export function isBayArea(lat: number, lon: number): boolean {
  return lat >= 36.85 && lat <= 38.55 && lon >= -123.65 && lon <= -121.35;
}

/** DataSF film dataset is City of San Francisco only. */
export function isSanFranciscoDatasetArea(
  lat: number,
  lon: number,
  displayName: string
): boolean {
  const n = displayName.toLowerCase();
  if (n.includes("san francisco")) return true;
  return lat >= 37.64 && lat <= 37.88 && lon >= -122.54 && lon <= -122.34;
}
