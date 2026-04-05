import type { CultureVenueRow, MobilityPlaceRow } from "@/lib/dashboard-types";

/** Labels we synthesize when OSM has no `name` tag (see `lib/data/overpass.ts`). */
const GENERIC_OSM_FALLBACK = new RegExp(
  `^(${[
    "Park",
    "Restaurant",
    "Café",
    "Cafe",
    "Fast food",
    "Bar",
    "Pub",
    "Food court",
    "Parking",
    "Fuel station",
    "EV charging",
    "Hospital",
    "Police",
    "Fire station",
    "Theatre",
    "Arts centre",
    "Museum",
    "Gallery",
    "Library",
    "Place of worship",
    "Viewpoint",
    "Monument",
    "Artwork",
    "Attraction",
    "Transit platform",
    "Bus stop",
    "Rail",
  ].join("|")})\\s*\\(OSM\\)$`,
  "i"
);

export function isGenericOsmFallbackLabel(label: string): boolean {
  return GENERIC_OSM_FALLBACK.test(label.trim());
}

export type NamedPlaceHint = {
  name: string;
  /** Address from OSM, else approximate coordinates. */
  where: string | null;
  lat: number;
  lng: number;
};

function whereForRow(
  address: string | null | undefined,
  lat: number,
  lng: number
): string | null {
  const a = address?.trim();
  if (a) return a;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

/** Skip generic "(OSM)" placeholders; scan more rows so we still fill `limit`. */
export function pickNamedMobilityPlaces(
  rows: MobilityPlaceRow[],
  limit: number,
  scanCap = 120
): NamedPlaceHint[] {
  const out: NamedPlaceHint[] = [];
  for (const r of rows.slice(0, scanCap)) {
    if (isGenericOsmFallbackLabel(r.name)) continue;
    out.push({
      name: r.name.trim(),
      where: whereForRow(r.address, r.lat, r.lng),
      lat: r.lat,
      lng: r.lng,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function pickNamedCultureVenues(
  rows: CultureVenueRow[],
  limit: number,
  scanCap = 120
): NamedPlaceHint[] {
  const out: NamedPlaceHint[] = [];
  for (const v of rows.slice(0, scanCap)) {
    if (isGenericOsmFallbackLabel(v.title)) continue;
    out.push({
      name: v.title.trim(),
      where: whereForRow(v.address, v.lat, v.lng),
      lat: v.lat,
      lng: v.lng,
    });
    if (out.length >= limit) break;
  }
  return out;
}
