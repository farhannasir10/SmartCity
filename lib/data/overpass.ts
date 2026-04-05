import type {
  CultureVenueRow,
  MapPoint,
  MapPointKind,
  MobilityPlaceRow,
  NamedCount,
  ParkingLotRow,
} from "@/lib/dashboard-types";

/**
 * One HTTP request: parking quota + other layers quota (avoids starving parking).
 * Two parallel requests to overpass-api.de often hit 429 / timeouts — single POST is gentler.
 */
function buildCombinedCityLayersQuery(
  south: number,
  west: number,
  north: number,
  east: number
): string {
  return `
[out:json][timeout:55];
(
  node["amenity"="parking"](${south},${west},${north},${east});
  way["amenity"="parking"](${south},${west},${north},${east});
);
out center 160;
(
  node["public_transport"="platform"](${south},${west},${north},${east});
  node["highway"="bus_stop"](${south},${west},${north},${east});
  node["railway"="station"](${south},${west},${north},${east});
  node["amenity"="hospital"](${south},${west},${north},${east});
  node["amenity"="police"](${south},${west},${north},${east});
  node["amenity"="fire_station"](${south},${west},${north},${east});
  node["amenity"="theatre"](${south},${west},${north},${east});
  node["amenity"="arts_centre"](${south},${west},${north},${east});
  node["tourism"="museum"](${south},${west},${north},${east});
  node["tourism"="gallery"](${south},${west},${north},${east});
  node["amenity"="fuel"](${south},${west},${north},${east});
  node["amenity"="charging_station"](${south},${west},${north},${east});
  node["amenity"="restaurant"](${south},${west},${north},${east});
  node["amenity"="cafe"](${south},${west},${north},${east});
  node["amenity"="fast_food"](${south},${west},${north},${east});
  node["amenity"="bar"](${south},${west},${north},${east});
  node["amenity"="pub"](${south},${west},${north},${east});
  node["amenity"="food_court"](${south},${west},${north},${east});
  node["leisure"="park"](${south},${west},${north},${east});
  node["amenity"="library"](${south},${west},${north},${east});
  node["amenity"="place_of_worship"](${south},${west},${north},${east});
  node["tourism"="viewpoint"](${south},${west},${north},${east});
  node["historic"="monument"](${south},${west},${north},${east});
  node["tourism"="artwork"](${south},${west},${north},${east});
  node["tourism"="attraction"](${south},${west},${north},${east});
);
out center 400;
`;
}

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

type OverpassJson = OverpassResp & {
  remark?: string;
  error?: string | { text?: string };
};

async function runOverpassCombined(query: string): Promise<OverpassEl[]> {
  let lastErr: Error | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "CityPulseDashboard/1.0 (https://github.com; cached server-side)",
        },
        body: `data=${encodeURIComponent(query)}`,
        next: { revalidate: 1800 },
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status} @ ${endpoint}`);
        continue;
      }
      const json = (await res.json()) as OverpassJson;
      const errText =
        typeof json.error === "string"
          ? json.error
          : json.error?.text;
      if (errText) {
        lastErr = new Error(`Overpass: ${errText.slice(0, 180)}`);
        continue;
      }
      if (
        typeof json.remark === "string" &&
        /runtime error|too many requests|rate limit|timeout|504/i.test(
          json.remark
        )
      ) {
        lastErr = new Error(`Overpass: ${json.remark.slice(0, 180)}`);
        continue;
      }
      return json.elements ?? [];
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("Overpass: all endpoints failed");
}

type OverpassEl = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResp = { elements?: OverpassEl[] };

const MAX_PLACES_PER_LAYER = 500;

function formatOsmAddress(tags: Record<string, string>): string | null {
  const full = tags["addr:full"]?.trim();
  if (full) return full;
  const line1 = [tags["addr:housenumber"], tags["addr:street"] || tags["addr:road"]]
    .filter(Boolean)
    .join(" ")
    .trim();
  const line2 = [
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"] || tags["addr:place"] || tags["addr:district"],
    tags["addr:state"] || tags["addr:province"],
    tags["addr:postcode"],
  ]
    .filter(Boolean)
    .join(", ")
    .trim();
  const parts = [line1, line2].filter((p) => p.length > 0);
  if (parts.length === 0) return null;
  const joined = parts.join(" · ");
  return joined.length > 2 ? joined : null;
}

function kindToMobilityLayer(kind: MapPointKind): string | null {
  switch (kind) {
    case "parking":
      return "Parking";
    case "transit":
      return "Transit";
    case "services":
      return "Fuel & EV";
    case "park":
      return "Parks";
    case "food":
      return "Food & drink";
    case "culture":
      return "Arts & culture";
    case "library":
    case "worship":
    case "viewpoint":
    case "heritage":
    case "attraction":
      return "Libraries & sights";
    case "civic":
      return "Civic & safety";
    default:
      return null;
  }
}

function pushMobilityPlace(
  lists: Record<string, MobilityPlaceRow[]>,
  layer: string,
  row: MobilityPlaceRow
) {
  const arr = lists[layer] ?? (lists[layer] = []);
  if (arr.length >= MAX_PLACES_PER_LAYER) return;
  arr.push(row);
}

function classifyNode(
  tags: Record<string, string>
): {
  kind: MapPointKind;
  label: string;
  cultureDetail?: string;
  lot?: { name: string; capacity: number | null };
} | null {
  const amenity = tags.amenity;
  const tourism = tags.tourism;
  const highway = tags.highway;
  const pt = tags.public_transport;
  const railway = tags.railway;
  const leisure = tags.leisure;

  if (amenity === "parking") {
    const name =
      tags.name ??
      tags.ref ??
      (tags.parking ? `Parking (${tags.parking})` : "Parking (OSM)");
    const capRaw = tags.capacity;
    const capacity = capRaw ? parseInt(capRaw, 10) : NaN;
    const cap = Number.isFinite(capacity) ? capacity : null;
    return {
      kind: "parking",
      label: name,
      lot: { name, capacity: cap },
    };
  }

  if (leisure === "park") {
    return {
      kind: "park",
      label: tags.name ?? "Park (OSM)",
      cultureDetail: "Park",
    };
  }

  if (pt === "platform" || highway === "bus_stop" || railway === "station") {
    const mode =
      railway === "station"
        ? "Rail"
        : pt === "platform"
          ? "Transit platform"
          : "Bus stop";
    const name =
      tags.name ?? tags.ref ?? tags.network ?? `${mode} (OSM)`;
    return { kind: "transit", label: name };
  }

  if (amenity === "hospital") {
    return {
      kind: "civic",
      label: tags.name ?? "Hospital (OSM)",
    };
  }
  if (amenity === "police") {
    return {
      kind: "civic",
      label: tags.name ?? "Police (OSM)",
    };
  }
  if (amenity === "fire_station") {
    return {
      kind: "civic",
      label: tags.name ?? "Fire station (OSM)",
    };
  }

  if (amenity === "fuel") {
    return {
      kind: "services",
      label: tags.name ?? tags.brand ?? "Fuel station (OSM)",
    };
  }
  if (amenity === "charging_station") {
    return {
      kind: "services",
      label: tags.name ?? tags.operator ?? "EV charging (OSM)",
    };
  }

  if (
    amenity === "restaurant" ||
    amenity === "cafe" ||
    amenity === "fast_food" ||
    amenity === "bar" ||
    amenity === "pub" ||
    amenity === "food_court"
  ) {
    const cat =
      amenity === "restaurant"
        ? "Restaurant"
        : amenity === "cafe"
          ? "Café"
          : amenity === "fast_food"
            ? "Fast food"
            : amenity === "bar"
              ? "Bar"
              : amenity === "pub"
                ? "Pub"
                : "Food court";
    return {
      kind: "food",
      label:
        tags.name ??
        tags.brand ??
        tags.operator ??
        `${cat} (OSM)`,
      cultureDetail: cat,
    };
  }

  if (amenity === "theatre") {
    return {
      kind: "culture",
      label: tags.name ?? "Theatre (OSM)",
      cultureDetail: "Theatre",
    };
  }
  if (amenity === "arts_centre") {
    return {
      kind: "culture",
      label: tags.name ?? "Arts centre (OSM)",
      cultureDetail: "Arts centre",
    };
  }
  if (tourism === "museum") {
    return {
      kind: "culture",
      label: tags.name ?? "Museum (OSM)",
      cultureDetail: "Museum",
    };
  }
  if (tourism === "gallery") {
    return {
      kind: "culture",
      label: tags.name ?? "Gallery (OSM)",
      cultureDetail: "Gallery",
    };
  }

  if (amenity === "library") {
    return {
      kind: "library",
      label: tags.name ?? "Library (OSM)",
      cultureDetail: "Library",
    };
  }
  if (amenity === "place_of_worship") {
    return {
      kind: "worship",
      label: tags.name ?? "Place of worship (OSM)",
      cultureDetail: "Place of worship",
    };
  }
  if (tourism === "viewpoint") {
    return {
      kind: "viewpoint",
      label: tags.name ?? "Viewpoint (OSM)",
      cultureDetail: "Viewpoint",
    };
  }
  if (tags.historic === "monument") {
    return {
      kind: "heritage",
      label: tags.name ?? "Monument (OSM)",
      cultureDetail: "Monument",
    };
  }
  if (tourism === "artwork") {
    return {
      kind: "heritage",
      label: tags.name ?? "Artwork (OSM)",
      cultureDetail: "Artwork",
    };
  }
  if (tourism === "attraction") {
    return {
      kind: "attraction",
      label: tags.name ?? "Attraction (OSM)",
      cultureDetail: "Attraction",
    };
  }

  return null;
}

function layerCountsFromPoints(
  points: MapPoint[]
): NamedCount[] {
  const m: Record<string, number> = {};
  for (const p of points) {
    const key = kindToMobilityLayer(p.kind);
    if (key) m[key] = (m[key] ?? 0) + 1;
  }
  const order = [
    "Parking",
    "Transit",
    "Fuel & EV",
    "Parks",
    "Food & drink",
    "Arts & culture",
    "Libraries & sights",
    "Civic & safety",
  ];
  return order
    .filter((k) => (m[k] ?? 0) > 0)
    .map((name) => ({ name, count: m[name]! }));
}

const VISIT_KINDS = new Set<MapPointKind>([
  "culture",
  "park",
  "library",
  "worship",
  "viewpoint",
  "heritage",
  "attraction",
]);

function cultureCountsFromPoints(points: MapPoint[]): NamedCount[] {
  const m: Record<string, number> = {};
  for (const p of points) {
    if (!VISIT_KINDS.has(p.kind)) continue;
    const d = p.detail ?? "Place";
    m[d] = (m[d] ?? 0) + 1;
  }
  return Object.entries(m)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function elementLatLon(el: OverpassEl): { lat: number; lon: number } | null {
  if (el.type === "node" && el.lat != null && el.lon != null) {
    return { lat: el.lat, lon: el.lon };
  }
  if (
    el.type === "way" &&
    el.center &&
    Number.isFinite(el.center.lat) &&
    Number.isFinite(el.center.lon)
  ) {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

/**
 * Parking (nodes + lot polygons as centroids), transit, civic, and culture — worldwide OSM.
 */
export async function fetchOverpassCityLayers(
  south: number,
  west: number,
  north: number,
  east: number
): Promise<{
  mapPoints: MapPoint[];
  lots: ParkingLotRow[];
  cultureVenues: CultureVenueRow[];
  chartOsmLayers: NamedCount[];
  chartOsmCulture: NamedCount[];
  mobilityPlaceLists: Record<string, MobilityPlaceRow[]>;
}> {
  const rawElements = await runOverpassCombined(
    buildCombinedCityLayersQuery(south, west, north, east)
  );
  const seen = new Set<string>();
  const elements: OverpassEl[] = [];
  for (const el of rawElements) {
    const k = `${el.type}-${el.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    elements.push(el);
  }

  const mapPoints: MapPoint[] = [];
  const lots: ParkingLotRow[] = [];
  const cultureVenues: CultureVenueRow[] = [];
  const mobilityPlaceLists: Record<string, MobilityPlaceRow[]> = {};

  for (const el of elements) {
    if (el.type !== "node" && el.type !== "way") continue;
    const pos = elementLatLon(el);
    if (!pos) continue;
    const tags = el.tags ?? {};
    const c = classifyNode(tags);
    if (!c) continue;

    const idSuffix = `${el.type}-${el.id}`;
    if (c.kind === "parking" && c.lot) {
      const id = `osm-p-${idSuffix}`;
      const sourceWay =
        el.type === "way"
          ? "OpenStreetMap (parking area centroid)"
          : "OpenStreetMap (amenity=parking)";
      const displayName =
        el.type === "way" && !tags.name ? `${c.lot.name} (lot)` : c.lot.name;
      const address = formatOsmAddress(tags);
      mapPoints.push({
        id,
        lat: pos.lat,
        lng: pos.lon,
        intensity: el.type === "way" ? 0.5 : 0.42,
        label:
          el.type === "way" && !tags.name
            ? `${c.label} (lot)`
            : c.label,
        kind: "parking",
      });
      lots.push({
        id,
        name: displayName,
        capacity: c.lot.capacity,
        source: sourceWay,
        address,
        lat: pos.lat,
        lng: pos.lon,
      });
      pushMobilityPlace(mobilityPlaceLists, "Parking", {
        id,
        name: displayName,
        address,
        lat: pos.lat,
        lng: pos.lon,
        capacity: c.lot.capacity,
        category: null,
      });
      continue;
    }

    if (el.type === "way") continue;

    const id = `osm-${c.kind}-${idSuffix}`;
    const base: MapPoint = {
      id,
      lat: pos.lat,
      lng: pos.lon,
      intensity:
        c.kind === "civic"
          ? 0.55
          : c.kind === "culture"
            ? 0.48
            : c.kind === "services"
              ? 0.52
              : c.kind === "food"
                ? 0.5
                : c.kind === "park"
                  ? 0.4
                  : c.kind === "library"
                    ? 0.46
                    : c.kind === "worship"
                      ? 0.47
                      : c.kind === "viewpoint"
                        ? 0.44
                        : c.kind === "heritage" || c.kind === "attraction"
                          ? 0.49
                          : 0.45,
      label: c.label,
      kind: c.kind,
      ...(c.cultureDetail ? { detail: c.cultureDetail } : {}),
    };
    mapPoints.push(base);

    const layer = kindToMobilityLayer(c.kind);
    if (layer) {
      pushMobilityPlace(mobilityPlaceLists, layer, {
        id,
        name: c.label,
        address: formatOsmAddress(tags),
        lat: pos.lat,
        lng: pos.lon,
        capacity: null,
        category: c.cultureDetail ?? null,
      });
    }

    if (c.cultureDetail && VISIT_KINDS.has(c.kind)) {
      cultureVenues.push({
        id,
        title: c.label,
        category: c.cultureDetail,
        source: "OpenStreetMap",
        address: formatOsmAddress(tags),
        lat: pos.lat,
        lng: pos.lon,
      });
    }
  }

  const chartOsmLayers = layerCountsFromPoints(mapPoints);
  const chartOsmCulture = cultureCountsFromPoints(mapPoints);

  return {
    mapPoints,
    lots: lots.slice(0, 20),
    cultureVenues,
    chartOsmLayers,
    chartOsmCulture,
    mobilityPlaceLists,
  };
}

/** @deprecated use fetchOverpassCityLayers */
export async function fetchOverpassParkingBBox(
  south: number,
  west: number,
  north: number,
  east: number
) {
  const r = await fetchOverpassCityLayers(south, west, north, east);
  return { mapPoints: r.mapPoints, lots: r.lots };
}
