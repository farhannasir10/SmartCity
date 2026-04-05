export type MapPointKind =
  | "bart"
  | "parking"
  | "film"
  | "incident"
  | "transit"
  | "civic"
  | "culture"
  /** Fuel stations, EV charging — mobility-adjacent OSM. */
  | "services"
  /** Mapped green space (leisure=park nodes in bbox). */
  | "park"
  /** Restaurants, cafés, bars, etc. */
  | "food"
  | "library"
  | "worship"
  | "viewpoint"
  | "heritage"
  | "attraction";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  intensity: number;
  label: string;
  kind: MapPointKind;
  /** OSM culture subtype for charts (e.g. Theatre, Museum). */
  detail?: string;
};

export type TrafficSegment = {
  id: string;
  name: string;
  congestion: number;
  trend: "up" | "down" | "flat";
  etaMin: number;
  sourceNote?: string;
};

export type CityEvent = {
  id: string;
  title: string;
  start: string;
  venue: string;
  expectedCrowd: number;
  category: string;
  source?: string;
  /** When the upstream dataset includes coordinates (e.g. DataSF film). */
  lat?: number;
  lng?: number;
};

export type ParkingLotRow = {
  id: string;
  name: string;
  capacity: number | null;
  source: string;
  /** From OSM addr:* when tagged; UI may fall back to coordinates. */
  address?: string | null;
  lat?: number;
  lng?: number;
};

/** Rows for OSM mobility / places panels (one list per layer tab). */
export type MobilityPlaceRow = {
  id: string;
  name: string;
  /** Structured addr:* from OSM; null if untagged. */
  address: string | null;
  lat: number;
  lng: number;
  capacity: number | null;
  /** Subtype label (e.g. Café, Bus stop). */
  category?: string | null;
};

export type ResourceRec = {
  id: string;
  resource: string;
  action: string;
  priority: "high" | "medium" | "low";
  reason: string;
};

export type AlertItem = {
  id: string;
  level: "warning" | "info";
  text: string;
  source?: string;
};

export type WeatherHour = {
  time: string;
  tempC: number;
  precipPct: number;
};

export type NamedCount = {
  name: string;
  count: number;
};

/** When DataSF film does not apply, we list mapped culture POIs from OSM. */
export type CultureVenueRow = {
  id: string;
  title: string;
  category: string;
  source: string;
  address: string | null;
  lat: number;
  lng: number;
};

export type ChartSeriesSource = "datasf" | "511" | "openmeteo" | "osm" | "none";

export type MobilityBrief = {
  tempMinC: number;
  tempMaxC: number;
  peakPrecipPct: number;
  peakPrecipTime: string;
};

export type CityScores = {
  /** Things to do / outing suitability (0–10, heuristic). */
  activity: number;
  /** Getting around: transit, parking vs congestion (0–10). */
  mobility: number;
  /** Green space & comfort vs rain (0–10). */
  environment: number;
};

export type SmartInsight = {
  id: string;
  headline: string;
  body: string;
  variant: "good" | "watch" | "info";
};

/** Structured day plan for Planning assistant timeline + map links. */
export type VisualPlanStep = {
  id: string;
  timeLabel: string;
  emoji: string;
  headline: string;
  placeName: string;
  subtitle: string | null;
  lat: number;
  lng: number;
};

export type DashboardData = {
  cityName: string;
  /** Raw search string used for this snapshot (for URL + chat sync). */
  placeQuery: string;
  /** Nominatim could not resolve the place. */
  geocodeError: string | null;
  mapCenter: [number, number];
  mapPoints: MapPoint[];
  trafficSegments: TrafficSegment[];
  parkingLots: ParkingLotRow[];
  /** OSM layer counts for the map bbox (independent of 511 chart override). */
  osmLayerCounts: NamedCount[];
  /** Named lists for Parking, Transit, Fuel & EV, etc. */
  mobilityPlaceLists: Record<string, MobilityPlaceRow[]>;
  todayEvents: CityEvent[];
  resourceRecommendations: ResourceRec[];
  alerts: AlertItem[];
  weatherHourly: WeatherHour[];
  chartNeighborhoods: NamedCount[];
  /** Bar chart: DataSF neighborhoods in SF, else OSM culture mix for this bbox. */
  chartNeighborhoodsSource: ChartSeriesSource;
  chartIncidentsByType: NamedCount[];
  /** Bar chart: 511 types in Bay Area with key, else OSM layer mix (parking/transit/civic/culture). */
  chartIncidentsSource: ChartSeriesSource;
  cultureVenues: CultureVenueRow[];
  mobilityBrief: MobilityBrief | null;
  scores: CityScores;
  smartInsights: SmartInsight[];
  sources: Record<string, "ok" | "error" | "skipped">;
  /** Geocoded place vs feeds that only support SF Bay / SF. */
  region: { bayArea: boolean; sanFranciscoFilm: boolean };
  fetchedAt: string;
};
