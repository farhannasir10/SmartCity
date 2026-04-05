import type { DashboardData } from "@/lib/dashboard-types";
import {
  pickNamedCultureVenues,
  pickNamedMobilityPlaces,
} from "@/lib/osm-place-names";

function trunc(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Small JSON for LLM system prompts (Groq free tier TPM ~6k).
 * Keeps planningSnapshot + layer counts; trims long lists and prose.
 */
export function buildChatContextCompact(data: DashboardData): string {
  const parking = data.parkingLots.slice(0, 8).map((p) => ({
    name: trunc(p.name, 56),
    capacity: p.capacity,
  }));

  const cultureVenuesOsm = data.cultureVenues.slice(0, 8).map((v) => ({
    title: trunc(v.title, 52),
    category: v.category,
  }));

  const eventsList = data.todayEvents.slice(0, 6).map((e) => ({
    title: trunc(e.title, 48),
    venue: trunc(e.venue, 48),
    category: e.category,
  }));

  const traffic511 = data.trafficSegments.slice(0, 6).map((t) => ({
    name: trunc(t.name, 64),
    congestion: t.congestion,
  }));

  const smartInsights = data.smartInsights.slice(0, 3).map((i) => ({
    headline: trunc(i.headline, 64),
    body: trunc(i.body, 120),
    variant: i.variant,
  }));

  const recommendations = data.resourceRecommendations.slice(0, 4).map((r) => ({
    priority: r.priority,
    resource: trunc(r.resource, 40),
    action: trunc(r.action, 140),
  }));

  return JSON.stringify({
    city: trunc(data.cityName, 120),
    placeQuery: trunc(data.placeQuery, 80),
    geocodeError: data.geocodeError,
    region: data.region,
    sources: data.sources,
    mobilityBrief: data.mobilityBrief,
    scores: data.scores,
    osmLayerCounts: data.osmLayerCounts.slice(0, 14),
    chartIncidents: data.chartIncidentsByType.slice(0, 14),
    planningSnapshot: {
      parks: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Parks"] ?? [],
        6
      ).map((p) => ({
        name: trunc(p.name, 48),
        where: p.where ? trunc(p.where, 72) : null,
      })),
      foodAndDrink: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Food & drink"] ?? [],
        6
      ).map((p) => ({
        name: trunc(p.name, 48),
        where: p.where ? trunc(p.where, 72) : null,
      })),
      artsCulture: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Arts & culture"] ?? [],
        5
      ).map((p) => ({
        name: trunc(p.name, 48),
        where: p.where ? trunc(p.where, 72) : null,
      })),
      visitPlaces: pickNamedCultureVenues(data.cultureVenues, 6).map((p) => ({
        name: trunc(p.name, 48),
        where: p.where ? trunc(p.where, 72) : null,
      })),
      weatherOneLiner: data.mobilityBrief
        ? `${data.mobilityBrief.tempMinC.toFixed(0)}–${data.mobilityBrief.tempMaxC.toFixed(0)}°C; peak rain ~${Math.round(data.mobilityBrief.peakPrecipPct)}% @ ${data.mobilityBrief.peakPrecipTime}`
        : null,
      avoidOrDefer: [
        ...(data.trafficSegments.length >= 3
          ? [
              "Multiple traffic items — allow extra drive time.",
            ]
          : []),
        ...(data.mobilityBrief && data.mobilityBrief.peakPrecipPct >= 40
          ? ["Elevated rain risk — shorten outdoor legs."]
          : []),
      ],
    },
    parking,
    cultureVenuesOsm,
    eventsList,
    traffic511,
    smartInsights,
    recommendations,
    weatherNextHours: data.weatherHourly.slice(0, 6).map((h) => ({
      time: h.time,
      tempC: h.tempC,
      precipPct: h.precipPct,
    })),
    note: "Use only these facts; do not invent occupancy or closures. Each planning place has a real name (generic 'Park (OSM)' rows are omitted). Use the exact `name` strings; add `where` (address or coords) when helpful.",
  });
}

export function buildAssistantContextString(data: DashboardData): string {
  const parkingSummary = data.parkingLots.map((p) => ({
    name: p.name,
    capacity: p.capacity,
    address: p.address ?? null,
    note:
      p.capacity == null
        ? "Occupancy not published"
        : "Capacity from OSM tag; live occupancy unknown",
  }));

  return JSON.stringify({
    city: data.cityName,
    placeQuery: data.placeQuery,
    geocodeError: data.geocodeError,
    region: data.region,
    chartNeighborhoodsSource: data.chartNeighborhoodsSource,
    chartIncidentsSource: data.chartIncidentsSource,
    mobilityBrief: data.mobilityBrief,
    disclaimer:
      "Public feeds only — no synthetic rows. BART and 511 traffic are SF Bay Area. DataSF film permits are San Francisco. Anywhere else: Open-Meteo weather plus OpenStreetMap (parking, transit, fuel/EV, parks, restaurants/cafés/bars, libraries, worship, viewpoints, monuments/artworks, attractions, theatres/museums, civic) in the geocoded bbox.",
    sources: data.sources,
    fetchedAt: data.fetchedAt,
    parking: parkingSummary,
    eventsList: data.todayEvents.map((e) => ({
      title: e.title,
      venue: e.venue,
      time: e.start,
      category: e.category,
      source: e.source,
      lat: e.lat ?? null,
      lng: e.lng ?? null,
    })),
    cultureVenuesOsm: data.cultureVenues.map((v) => ({
      title: v.title,
      category: v.category,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
    })),
    traffic511: data.trafficSegments.map((t) => ({
      name: t.name,
      congestionPercent: t.congestion,
      etaMin: t.etaMin,
      source: t.sourceNote,
    })),
    osmLayerCounts: data.osmLayerCounts,
    chartIncidentOr511Breakdown: data.chartIncidentsByType,
    mobilitySampleCounts: Object.fromEntries(
      Object.entries(data.mobilityPlaceLists).map(([k, v]) => [k, v.length])
    ),
    scores: data.scores,
    smartInsights: data.smartInsights,
    planningSnapshot: {
      parks: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Parks"] ?? [],
        6
      ).map((p) => ({ name: p.name, where: p.where })),
      foodAndDrink: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Food & drink"] ?? [],
        6
      ).map((p) => ({ name: p.name, where: p.where })),
      artsCulture: pickNamedMobilityPlaces(
        data.mobilityPlaceLists["Arts & culture"] ?? [],
        5
      ).map((p) => ({ name: p.name, where: p.where })),
      visitPlaces: pickNamedCultureVenues(data.cultureVenues, 6).map((p) => ({
        name: p.name,
        where: p.where,
      })),
      weatherOneLiner: data.mobilityBrief
        ? `${data.mobilityBrief.tempMinC.toFixed(0)}–${data.mobilityBrief.tempMaxC.toFixed(0)}°C; peak rain ~${Math.round(data.mobilityBrief.peakPrecipPct)}% around ${data.mobilityBrief.peakPrecipTime}`
        : null,
      avoidOrDefer: [
        ...(data.trafficSegments.length >= 3
          ? [
              "Several active traffic items in this snapshot — pad driving time or check live navigation.",
            ]
          : []),
        ...(data.mobilityBrief && data.mobilityBrief.peakPrecipPct >= 40
          ? [
              "Forecast shows meaningful rain risk — deprioritize long outdoor legs.",
            ]
          : []),
      ],
    },
    recommendations: data.resourceRecommendations,
    alerts: data.alerts.map((a) => a.text),
    weatherNextHours: data.weatherHourly.slice(0, 8),
  });
}
