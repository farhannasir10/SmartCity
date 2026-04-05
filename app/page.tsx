import type { ReactNode } from "react";
import CitizenChat from "@/components/CitizenChat";
import CitySearch from "@/components/CitySearch";
import DashboardCharts from "@/components/DashboardCharts";
import MapPanel from "@/components/MapPanel";
import OsmMobilityExplorer from "@/components/OsmMobilityExplorer";
import ScoreBadges from "@/components/ScoreBadges";
import {
  loadDashboardData,
  DEFAULT_PLACE_QUERY,
} from "@/lib/load-dashboard";
import {
  locationLineFromAddressOrCoords,
  openStreetMapPinUrl,
} from "@/lib/map-links";

export const revalidate = 300;

type PageProps = { searchParams: Promise<{ q?: string }> };

function SourceBadges({
  sources,
}: {
  sources: Record<string, "ok" | "error" | "skipped">;
}) {
  const order = [
    "bart",
    "openMeteo",
    "overpass",
    "dataSfFilm",
    "traffic511",
  ] as const;
  return (
    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-500">
      {order.map((k) => {
        const v = sources[k];
        if (!v) return null;
        const cls =
          v === "ok"
            ? "border-emerald-900/50 text-emerald-400"
            : v === "skipped"
              ? "border-slate-700 text-slate-500"
              : "border-rose-900/50 text-rose-300";
        return (
          <span
            key={k}
            className={`rounded border px-2 py-0.5 font-medium uppercase tracking-wide ${cls}`}
          >
            {k}: {v}
          </span>
        );
      })}
    </div>
  );
}

function EmptyPanel({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const d = await loadDashboardData(q);
  const searchDefault = q?.trim() || DEFAULT_PLACE_QUERY;
  const weatherShort = d.geocodeError
    ? undefined
    : d.cityName.split(",").slice(0, 2).join(",").trim();

  return (
    <div className="min-h-screen bg-[var(--bg-deep)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-cyan-500">
              CityPulse
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {d.geocodeError ? d.placeQuery : d.cityName}
            </h1>
            <p className="mt-2 max-w-2xl text-base font-medium leading-snug text-slate-200">
              Turn any location into actionable insights in seconds.
            </p>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Search any city — <strong className="font-medium text-slate-300">weather</strong>{" "}
              and <strong className="font-medium text-slate-300">OpenStreetMap</strong>{" "}
              (parking, transit, fuel/EV, parks, food & drink, civic, culture) follow the map.{" "}
              <strong className="font-medium text-slate-300">BART</strong>,{" "}
              <strong className="font-medium text-slate-300">511</strong>, and{" "}
              <strong className="font-medium text-slate-300">DataSF film</strong> are extra layers
              for the SF Bay / San Francisco.
            </p>
            <CitySearch defaultQuery={searchDefault} />
            {!d.geocodeError && !d.region.bayArea ? (
              <p className="mt-3 max-w-xl rounded-lg border border-slate-700/80 bg-slate-900/35 px-3 py-2 text-xs leading-relaxed text-slate-400">
                <span className="font-medium text-slate-300">
                  {weatherShort ?? d.cityName.split(",")[0]?.trim() ?? "This area"}
                </span>{" "}
                is outside the SF Bay: you still get{" "}
                <strong className="font-normal text-slate-300">live weather</strong> and{" "}
                <strong className="font-normal text-slate-300">OSM city layers</strong> (parking,
                transit, fuel/EV, parks, restaurants & cafés, civic, culture) worldwide. U.S. Bay Area feeds stay off —
                expected, not broken.
              </p>
            ) : null}
            {d.geocodeError ? (
              <p className="mt-2 rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                {d.geocodeError}
              </p>
            ) : null}
            {!d.geocodeError ? <ScoreBadges scores={d.scores} /> : null}
            <div className="mt-3">
              <SourceBadges sources={d.sources} />
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex gap-2 text-xs text-slate-500">
              <span className="rounded-full border border-[var(--border)] px-3 py-1">
                Next.js · TypeScript
              </span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1">
                Free public APIs
              </span>
            </div>
            <p className="text-[10px] text-slate-600">
              Cached ~5m · {new Date(d.fetchedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Live map</h2>
              <span className="text-xs text-slate-500">
                {d.region.bayArea
                  ? "Cyan BART · Green parking · Teal services · Mint parks · Rose dining · Sky libraries · Violet worship · Yellow viewpoints · Stone/rose heritage · Pink arts · Amber transit · Orange civic · Violet DataSF · Red 511"
                  : "Green parking · Teal services · Mint parks · Rose dining · Sky libraries · Violet worship · Yellow viewpoints · Stone/rose heritage · Pink arts · Amber transit · Orange civic (OSM)"}
              </span>
            </div>
            {d.mapPoints.length > 0 ? (
              <MapPanel center={d.mapCenter} points={d.mapPoints} />
            ) : (
              <EmptyPanel>
                {d.region.bayArea ? (
                  <>
                    No map points — a feed may have failed or returned no coordinates. Check
                    Overpass (OSM) and regional sources in the badges above.
                  </>
                ) : (
                  <>
                    No OSM nodes in this window (parking, transit, fuel/EV, parks, food, civic,
                    culture) or Overpass
                    failed. Weather still reflects this search. Bay Area-only feeds are off here by
                    design.
                  </>
                )}
              </EmptyPanel>
            )}
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white">
              Smart insights
            </h2>
            <p className="mb-2 text-[11px] text-slate-500">
              Plain-language read on weather, traffic, and signals — not raw
              percentages alone.
            </p>
            {d.smartInsights.length > 0 ? (
              <ul className="space-y-2">
                {d.smartInsights.map((ins) => (
                  <li
                    key={ins.id}
                    className={
                      ins.variant === "good"
                        ? "rounded-lg border border-emerald-900/45 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-50"
                        : ins.variant === "watch"
                          ? "rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-sm text-amber-50"
                          : "rounded-lg border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-sm text-slate-200"
                    }
                  >
                    <span className="block text-xs font-semibold text-slate-300">
                      {ins.headline}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug text-slate-200/95">
                      {ins.body}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyPanel>No insights for this snapshot.</EmptyPanel>
            )}
          </div>
        </section>

        <OsmMobilityExplorer
          key={d.placeQuery}
          osmLayerCounts={d.osmLayerCounts}
          mobilityPlaceLists={d.mobilityPlaceLists}
          overpassOk={d.sources.overpass === "ok"}
        >
          {d.trafficSegments.length > 0 ? (
            <>
              <p className="mb-2 text-xs text-slate-500">
                Live highway-style incidents from 511 (SF Bay Area).
              </p>
              <ul className="space-y-2">
                {d.trafficSegments.map((t) => (
                  <li
                    key={t.id}
                    className="flex flex-col gap-0.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="font-medium text-slate-200">{t.name}</span>
                    <span className="text-slate-400">
                      {t.congestion}% · ETA ~{t.etaMin}m ·{" "}
                      <span
                        className={
                          t.trend === "up"
                            ? "text-rose-400"
                            : t.trend === "down"
                              ? "text-emerald-400"
                              : "text-slate-500"
                        }
                      >
                        {t.trend}
                      </span>
                    </span>
                    {t.sourceNote ? (
                      <span className="text-[10px] text-slate-600">
                        {t.sourceNote}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="space-y-3 text-sm text-slate-400">
              {d.sources.traffic511 === "skipped" && !d.region.bayArea ? (
                <p>
                  <strong className="text-slate-300">511</strong> only publishes
                  highway incidents for the{" "}
                  <strong className="text-slate-300">San Francisco Bay Area</strong>.
                  For other cities we show a weather + OpenStreetMap snapshot instead.
                </p>
              ) : d.sources.traffic511 === "skipped" ? (
                <p>
                  Add <code className="text-cyan-600">SF_BAY_511_API_KEY</code> and
                  search the Bay Area for 511 rows — token:{" "}
                  <a
                    className="text-cyan-500 hover:underline"
                    href="https://511.org/open-data/token"
                    target="_blank"
                    rel="noreferrer"
                  >
                    511.org/open-data/token
                  </a>
                  .
                </p>
              ) : d.sources.traffic511 === "ok" ? (
                <p className="text-slate-500">
                  511 is connected but returned no parsed corridor rows right now.
                </p>
              ) : (
                <p className="text-slate-500">
                  511 request failed (see badge). Mobility snapshot below still uses
                  Open-Meteo + OSM.
                </p>
              )}
              {d.mobilityBrief ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-xs">
                  <p className="font-medium text-slate-300">
                    Next ~24h (Open-Meteo)
                  </p>
                  <ul className="mt-1 list-inside list-disc text-slate-400">
                    <li>
                      Temperature about{" "}
                      {d.mobilityBrief.tempMinC.toFixed(0)}°C –{" "}
                      {d.mobilityBrief.tempMaxC.toFixed(0)}°C
                    </li>
                    <li>
                      Peak rain chance ~{Math.round(d.mobilityBrief.peakPrecipPct)}%
                      (around {d.mobilityBrief.peakPrecipTime})
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </OsmMobilityExplorer>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">
              Things to do
            </h2>
            {d.todayEvents.length > 0 || d.cultureVenues.length > 0 ? (
              <div className="min-h-0 space-y-4">
                {d.todayEvents.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">
                      Film permits (DataSF) — San Francisco ·{" "}
                      <span className="text-slate-400">
                        {d.todayEvents.length} rows
                      </span>
                    </p>
                    <div className="max-h-[480px] overflow-y-auto overscroll-y-contain rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40">
                      <ul className="space-y-2 p-2 text-sm">
                        {d.todayEvents.map((e) => {
                          const hasPin =
                            e.lat != null &&
                            e.lng != null &&
                            Number.isFinite(e.lat) &&
                            Number.isFinite(e.lng);
                          return (
                            <li
                              key={e.id}
                              className="rounded-lg bg-[var(--surface-2)] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium text-slate-200">
                                  {e.title}
                                </span>
                                <span className="text-right text-xs text-slate-500">
                                  {e.category}
                                </span>
                              </div>
                              <p className="mt-1 text-xs leading-snug text-slate-400">
                                {hasPin
                                  ? `${e.venue} · ${locationLineFromAddressOrCoords(null, e.lat!, e.lng!)}`
                                  : e.venue}
                              </p>
                              {hasPin ? (
                                <a
                                  href={openStreetMapPinUrl(e.lat!, e.lng!)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-block text-[11px] text-cyan-500 hover:underline"
                                >
                                  Open location on map →
                                </a>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                ) : null}
                {d.cultureVenues.length > 0 ? (
                  <div>
                    <p className="mb-2 text-xs text-slate-500">
                      Places of interest (OpenStreetMap) ·{" "}
                      <span className="text-slate-400">
                        {d.cultureVenues.length} in this area
                      </span>
                    </p>
                    <div className="max-h-[480px] overflow-y-auto overscroll-y-contain rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40">
                      <ul className="space-y-2 p-2 text-sm">
                        {d.cultureVenues.map((v) => (
                          <li
                            key={v.id}
                            className="rounded-lg bg-[var(--surface-2)] px-3 py-2"
                          >
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="font-medium text-slate-200">
                                {v.title}
                              </span>
                              <span className="text-right text-xs text-slate-500">
                                {v.category}
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-snug text-slate-400">
                              {locationLineFromAddressOrCoords(
                                v.address,
                                v.lat,
                                v.lng
                              )}
                            </p>
                            <a
                              href={openStreetMapPinUrl(v.lat, v.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[11px] text-cyan-500 hover:underline"
                            >
                              Open location on map →
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : d.sources.dataSfFilm === "skipped" ? (
              <EmptyPanel>
                DataSF film permits are San Francisco only. No theatres, museums, or
                galleries were returned from OSM for this bbox — try a denser city
                center or another query.
              </EmptyPanel>
            ) : d.sources.dataSfFilm === "ok" ? (
              <EmptyPanel>
                DataSF returned no film permit rows for this request.
              </EmptyPanel>
            ) : (
              <EmptyPanel>
                DataSF request failed — no backup list for this panel.
              </EmptyPanel>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">
              Smart recommendations
            </h2>
            <p className="mb-2 text-[11px] text-slate-500">
              Heuristics from the same live feeds — ops-style cues, not
              predictions.
            </p>
            {d.resourceRecommendations.length > 0 ? (
              <ul className="space-y-3 text-sm">
                {d.resourceRecommendations.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          r.priority === "high"
                            ? "text-xs font-medium text-rose-400"
                            : r.priority === "medium"
                              ? "text-xs font-medium text-amber-400"
                              : "text-xs font-medium text-slate-500"
                        }
                      >
                        {r.priority}
                      </span>
                      <span className="font-medium text-cyan-200">
                        {r.resource}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-300">{r.action}</p>
                    <p className="mt-1 text-xs text-slate-500">{r.reason}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyPanel>
                No heuristics fired (e.g. few 511 items, low rain probability, no
                OSM capacity tags). This is expected when signals are quiet.
              </EmptyPanel>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-white">
            Analytics (real series only)
          </h2>
          <DashboardCharts
            weatherHourly={d.weatherHourly}
            neighborhoodCounts={d.chartNeighborhoods}
            incidentOrTypeCounts={d.chartIncidentsByType}
            openMeteoOk={d.sources.openMeteo === "ok"}
            dataSfFilmOk={d.sources.dataSfFilm === "ok"}
            dataSfFilmSkipped={d.sources.dataSfFilm === "skipped"}
            traffic511Ok={d.sources.traffic511 === "ok"}
            traffic511Skipped={d.sources.traffic511 === "skipped"}
            regionBayArea={d.region.bayArea}
            chartNeighborhoodsSource={d.chartNeighborhoodsSource}
            chartIncidentsSource={d.chartIncidentsSource}
            weatherAreaLabel={weatherShort}
          />
        </section>

        <section>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="mb-2 text-sm font-semibold text-white">
              Planning assistant
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Ask for timed plans or “what to avoid” — uses named places from this
              page plus weather. Add a free{" "}
              <code className="text-slate-400">GROQ_API_KEY</code>{" "}
              (<a
                className="text-cyan-500 hover:underline"
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
              >
                Groq
              </a>
              ) or <code className="text-slate-400">OPENAI_API_KEY</code> for LLM
              replies; otherwise answers are rule-based from the same JSON. Not a
              substitute for official city services.
            </p>
            <CitizenChat placeQuery={d.placeQuery} />
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-slate-600">
        Public datasets only — verify each provider&apos;s terms. No synthetic
        filler rows on this dashboard.
      </footer>
    </div>
  );
}
