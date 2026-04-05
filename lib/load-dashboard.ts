import { unstable_cache } from "next/cache";
import type {
  DashboardData,
  MapPoint,
  MobilityBrief,
  MobilityPlaceRow,
  NamedCount,
  ResourceRec,
  WeatherHour,
} from "@/lib/dashboard-types";
import { fetchBartMapPoints } from "@/lib/data/bart";
import { fetchDataSfFilm } from "@/lib/data/datasf-film";
import { fetchWeatherHourly } from "@/lib/data/open-meteo";
import { fetchOverpassCityLayers } from "@/lib/data/overpass";
import { fetch511Traffic } from "@/lib/data/traffic511";
import {
  geocodePlace,
  isBayArea,
  isSanFranciscoDatasetArea,
} from "@/lib/geocode";
import { computeCityScores } from "@/lib/city-scores";
import { buildSmartInsights } from "@/lib/smart-insights";

export const DEFAULT_PLACE_QUERY = "San Francisco, California, USA";

function mobilityFromWeather(hours: WeatherHour[]): MobilityBrief | null {
  if (!hours.length) return null;
  const temps = hours.map((h) => h.tempC);
  const maxP = Math.max(...hours.map((h) => h.precipPct));
  const idx = hours.findIndex((h) => h.precipPct === maxP);
  return {
    tempMinC: Math.min(...temps),
    tempMaxC: Math.max(...temps),
    peakPrecipPct: maxP,
    peakPrecipTime: hours[idx]?.time ?? "—",
  };
}

function countOsmKind(points: MapPoint[], kind: MapPoint["kind"]): number {
  return points.filter((p) => p.kind === kind).length;
}

const VISIT_POI_KINDS = new Set<MapPoint["kind"]>([
  "culture",
  "park",
  "library",
  "worship",
  "viewpoint",
  "heritage",
  "attraction",
]);

function countVisitPois(points: MapPoint[]): number {
  return points.filter((p) => VISIT_POI_KINDS.has(p.kind)).length;
}

function buildResources(
  incidentCount: number,
  maxPrecip: number,
  parkingWithCap: number,
  weatherLabel: string,
  osmTransit: number,
  visitPoiCount: number
): ResourceRec[] {
  const out: ResourceRec[] = [];
  if (incidentCount >= 4) {
    out.push({
      id: "live-r1",
      resource: "Traffic / field units",
      action: `Monitor ${Math.min(incidentCount, 25)} active 511 corridor events (Bay Area).`,
      priority: "high",
      reason: "511 traffic feed reports multiple active items.",
    });
  }
  if (incidentCount === 0 && osmTransit >= 6) {
    out.push({
      id: "live-r1b",
      resource: "Transit & wayfinding",
      action:
        "OpenStreetMap lists multiple stops/platforms in this view — use local agency apps for live schedules.",
      priority: "medium",
      reason: `${osmTransit} mapped transit-related nodes in the search bbox.`,
    });
  }
  if (maxPrecip >= 40) {
    out.push({
      id: "live-r2",
      resource: "Events & sanitation",
      action:
        "Pre-stage drainage / event staffing if outdoor programs run tonight.",
      priority: "medium",
      reason: `Open-Meteo shows peak rain likelihood ~${Math.round(maxPrecip)}% in the next 24h (${weatherLabel}).`,
    });
  }
  if (parkingWithCap > 0) {
    out.push({
      id: "live-r3",
      resource: "Parking comms",
      action:
        "Mapped OSM lots with capacity tags still have no public live occupancy here.",
      priority: "low",
      reason: `${parkingWithCap} lots include a capacity tag from OpenStreetMap.`,
    });
  }
  if (visitPoiCount >= 6) {
    out.push({
      id: "live-r4",
      resource: "Places & visitors",
      action:
        "OSM lists parks, libraries, sights, and culture venues — verify hours on official sites before routing visitors.",
      priority: "low",
      reason: `${visitPoiCount} visit-related POIs in this map window.`,
    });
  }
  return out;
}

function emptyFilmResult(): Awaited<ReturnType<typeof fetchDataSfFilm>> {
  return { events: [], mapPoints: [], byNeighborhood: [] };
}

function geocodeFailedDashboard(
  placeQuery: string,
  message: string
): DashboardData {
  return {
    cityName: placeQuery,
    placeQuery,
    geocodeError: message,
    mapCenter: [37.7749, -122.4194],
    mapPoints: [],
    trafficSegments: [],
    parkingLots: [],
    osmLayerCounts: [],
    mobilityPlaceLists: {} as Record<string, MobilityPlaceRow[]>,
    todayEvents: [],
    resourceRecommendations: [],
    alerts: [],
    weatherHourly: [],
    chartNeighborhoods: [],
    chartNeighborhoodsSource: "none",
    chartIncidentsByType: [],
    chartIncidentsSource: "none",
    cultureVenues: [],
    mobilityBrief: null,
    scores: { activity: 0, mobility: 0, environment: 0 },
    smartInsights: buildSmartInsights({
      mobilityBrief: null,
      trafficSegments: [],
      resourceRecommendations: [],
      geocodeError: message,
      osmLayerCounts: [],
    }),
    sources: {
      bart: "skipped",
      openMeteo: "skipped",
      overpass: "skipped",
      dataSfFilm: "skipped",
      traffic511: "skipped",
    },
    region: { bayArea: false, sanFranciscoFilm: false },
    fetchedAt: new Date().toISOString(),
  };
}

function capMapPoints(mapPoints: MapPoint[], max = 160): MapPoint[] {
  if (mapPoints.length <= max) return mapPoints;
  const rank = (k: MapPoint["kind"]) => {
    const o = [
      "incident",
      "film",
      "bart",
      "culture",
      "attraction",
      "heritage",
      "viewpoint",
      "worship",
      "library",
      "food",
      "civic",
      "services",
      "park",
      "parking",
      "transit",
    ] as const;
    return o.indexOf(k);
  };
  return [...mapPoints]
    .sort((a, b) => rank(a.kind) - rank(b.kind))
    .slice(0, max);
}

async function loadDashboardUncached(
  placeQuery: string
): Promise<DashboardData> {
  const normalized = placeQuery.trim().slice(0, 200) || DEFAULT_PLACE_QUERY;
  const geo = await geocodePlace(normalized);
  if (!geo) {
    return geocodeFailedDashboard(
      normalized,
      "Place not found — try a clearer name (e.g. city, country)."
    );
  }

  const { lat, lon, displayName, south, west, north, east } = geo;
  const bay = isBayArea(lat, lon);
  const sfFilm = isSanFranciscoDatasetArea(lat, lon, displayName);
  const sources: Record<string, "ok" | "error" | "skipped"> = {};
  const api511 = process.env.SF_BAY_511_API_KEY?.trim();

  const [weatherR, overpassR, bartR, filmR, traffic511R] =
    await Promise.allSettled([
      fetchWeatherHourly(lat, lon),
      fetchOverpassCityLayers(south, west, north, east),
      bay ? fetchBartMapPoints() : Promise.resolve([] as MapPoint[]),
      sfFilm ? fetchDataSfFilm() : Promise.resolve(emptyFilmResult()),
      bay && api511 ? fetch511Traffic(api511) : Promise.resolve(null),
    ]);

  const mapPoints: DashboardData["mapPoints"] = [];
  let parkingLots: DashboardData["parkingLots"] = [];
  let osmLayerCounts: NamedCount[] = [];
  let mobilityPlaceLists: Record<string, MobilityPlaceRow[]> = {};
  let todayEvents: DashboardData["todayEvents"] = [];
  let chartNeighborhoods: NamedCount[] = [];
  let chartNeighborhoodsSource: DashboardData["chartNeighborhoodsSource"] =
    "none";
  let chartIncidentsByType: NamedCount[] = [];
  let chartIncidentsSource: DashboardData["chartIncidentsSource"] = "none";
  let cultureVenues: DashboardData["cultureVenues"] = [];
  let trafficSegments: DashboardData["trafficSegments"] = [];
  const alerts: DashboardData["alerts"] = [];
  let incidentCount = 0;
  let maxPrecip = 0;
  let osmBasePoints: MapPoint[] = [];

  if (!bay) {
    sources.bart = "skipped";
  } else if (bartR.status === "fulfilled") {
    sources.bart = "ok";
    mapPoints.push(...bartR.value);
  } else {
    sources.bart = "error";
  }

  if (weatherR.status === "fulfilled" && weatherR.value.length) {
    sources.openMeteo = "ok";
    maxPrecip = Math.max(...weatherR.value.map((h) => h.precipPct), 0);
    if (maxPrecip >= 30) {
      alerts.push({
        id: "wx-1",
        level: "info",
        text: `Weather: peak precipitation likelihood ~${Math.round(maxPrecip)}% in the next 24h (Open-Meteo near ${displayName.split(",").slice(0, 2).join(",")}).`,
        source: "Open-Meteo",
      });
    }
  } else {
    sources.openMeteo = "error";
  }

  if (overpassR.status === "fulfilled") {
    sources.overpass = "ok";
    const ov = overpassR.value;
    osmBasePoints = ov.mapPoints;
    mapPoints.push(...ov.mapPoints);
    parkingLots = ov.lots.slice(0, 20);
    cultureVenues = ov.cultureVenues;
    osmLayerCounts = ov.chartOsmLayers;
    mobilityPlaceLists = ov.mobilityPlaceLists;
  } else {
    sources.overpass = "error";
  }

  if (!sfFilm) {
    sources.dataSfFilm = "skipped";
  } else if (filmR.status === "fulfilled") {
    sources.dataSfFilm = "ok";
    mapPoints.push(...filmR.value.mapPoints);
    todayEvents = filmR.value.events;
    chartNeighborhoods = filmR.value.byNeighborhood.map((n) => ({
      name: n.name.slice(0, 18),
      count: n.count,
    }));
    if (chartNeighborhoods.length > 0) {
      chartNeighborhoodsSource = "datasf";
    }
  } else {
    sources.dataSfFilm = "error";
  }

  if (chartNeighborhoods.length === 0 && overpassR.status === "fulfilled") {
    const oc = overpassR.value.chartOsmCulture;
    if (oc.length > 0) {
      chartNeighborhoods = oc;
      chartNeighborhoodsSource = "osm";
    }
  }

  if (!bay || !api511) {
    sources.traffic511 = "skipped";
  } else if (traffic511R.status === "fulfilled" && traffic511R.value) {
    sources.traffic511 = "ok";
    const t = traffic511R.value;
    mapPoints.push(...t.mapPoints);
    incidentCount = t.trafficSegments.length;
    trafficSegments = t.trafficSegments;
    chartIncidentsByType =
      t.byType.length > 0
        ? t.byType
        : t.trafficSegments.length > 0
          ? [{ name: "Active items", count: t.trafficSegments.length }]
          : [];
    chartIncidentsSource = "511";
    if (t.alerts.length > 0) {
      alerts.unshift(...t.alerts.slice(0, 10));
    }
  } else {
    sources.traffic511 = "error";
  }

  if (
    overpassR.status === "fulfilled" &&
    overpassR.value.chartOsmLayers.length > 0 &&
    !(sources.traffic511 === "ok" && chartIncidentsByType.length > 0)
  ) {
    chartIncidentsByType = overpassR.value.chartOsmLayers;
    chartIncidentsSource = "osm";
  }

  const weatherHourly =
    weatherR.status === "fulfilled" && weatherR.value.length
      ? weatherR.value
      : [];

  const mobilityBrief =
    sources.openMeteo === "ok" ? mobilityFromWeather(weatherHourly) : null;

  const parkingWithCap = parkingLots.filter((p) => p.capacity != null).length;
  const osmTransit = countOsmKind(osmBasePoints, "transit");
  const visitPoiCount = countVisitPois(osmBasePoints);

  const shortLabel = displayName.split(",").slice(0, 2).join(",").trim();

  const resourceRecommendations = buildResources(
    incidentCount,
    maxPrecip,
    parkingWithCap,
    shortLabel || "selected area",
    osmTransit,
    visitPoiCount
  );
  const cappedMapPoints = capMapPoints(mapPoints);
  const scores = computeCityScores({
    mapPoints: cappedMapPoints,
    mobilityBrief,
    trafficSegments,
  });
  const smartInsights = buildSmartInsights({
    mobilityBrief,
    trafficSegments,
    resourceRecommendations,
    geocodeError: null,
    osmLayerCounts,
  });

  return {
    cityName: displayName,
    placeQuery: normalized,
    geocodeError: null,
    mapCenter: [lat, lon],
    mapPoints: cappedMapPoints,
    trafficSegments,
    parkingLots,
    osmLayerCounts,
    mobilityPlaceLists,
    todayEvents,
    resourceRecommendations,
    alerts,
    weatherHourly,
    chartNeighborhoods,
    chartNeighborhoodsSource,
    chartIncidentsByType,
    chartIncidentsSource,
    cultureVenues,
    mobilityBrief,
    scores,
    smartInsights,
    sources,
    region: { bayArea: bay, sanFranciscoFilm: sfFilm },
    fetchedAt: new Date().toISOString(),
  };
}

const getCachedDashboard = unstable_cache(
  async (place: string) => loadDashboardUncached(place),
  ["citypulse-dashboard-v20-insights-scores-mapux"],
  { revalidate: 300 }
);

export async function loadDashboardData(
  placeQuery?: string | null
): Promise<DashboardData> {
  const q = placeQuery?.trim().slice(0, 200) || DEFAULT_PLACE_QUERY;
  return getCachedDashboard(q);
}
