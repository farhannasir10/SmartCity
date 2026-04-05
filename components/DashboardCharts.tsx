"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import type {
  ChartSeriesSource,
  NamedCount,
  WeatherHour,
} from "@/lib/dashboard-types";

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/50 px-4 text-center text-xs text-slate-500">
      {message}
    </div>
  );
}

type Props = {
  weatherHourly: WeatherHour[];
  neighborhoodCounts: NamedCount[];
  incidentOrTypeCounts: NamedCount[];
  openMeteoOk: boolean;
  dataSfFilmOk: boolean;
  dataSfFilmSkipped: boolean;
  traffic511Ok: boolean;
  traffic511Skipped: boolean;
  regionBayArea: boolean;
  chartNeighborhoodsSource: ChartSeriesSource;
  chartIncidentsSource: ChartSeriesSource;
  weatherAreaLabel?: string;
};

export default function DashboardCharts({
  weatherHourly,
  neighborhoodCounts,
  incidentOrTypeCounts,
  openMeteoOk,
  dataSfFilmOk,
  dataSfFilmSkipped,
  traffic511Ok,
  traffic511Skipped,
  regionBayArea,
  chartNeighborhoodsSource,
  chartIncidentsSource,
  weatherAreaLabel,
}: Props) {
  const tempSeries = weatherHourly.map((h) => ({
    time: h.time,
    tempC: h.tempC,
    precipPct: h.precipPct,
  }));

  const middleTitle =
    chartNeighborhoodsSource === "datasf"
      ? "Film permits by neighborhood (DataSF)"
      : chartNeighborhoodsSource === "osm"
        ? "Places by type in map area (OpenStreetMap)"
        : "Culture / film chart";

  const rightTitle =
    chartIncidentsSource === "511"
      ? "511 events by type (SF Bay)"
      : chartIncidentsSource === "osm"
        ? "Mapped layers in view (OpenStreetMap)"
        : "Traffic / layers chart";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">
          Weather (Open-Meteo)
          {weatherAreaLabel ? (
            <span className="mt-1 block text-xs font-normal text-slate-500">
              Near {weatherAreaLabel}
            </span>
          ) : null}
        </h3>
        {openMeteoOk && tempSeries.length > 0 ? (
          <>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tempSeries}>
                  <defs>
                    <linearGradient id="temp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop
                        offset="100%"
                        stopColor="#22d3ee"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "#0c1222",
                      border: "1px solid #1e293b",
                      borderRadius: "8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tempC"
                    name="°C"
                    stroke="#22d3ee"
                    fill="url(#temp)"
                  />
                  <Area
                    type="monotone"
                    dataKey="precipPct"
                    name="Rain %"
                    stroke="#94a3b8"
                    fill="transparent"
                    strokeDasharray="4 4"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Solid: temperature (°C) · Dashed: precipitation probability (%)
            </p>
          </>
        ) : (
          <EmptyChart message="No Open-Meteo data — request failed or returned empty." />
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">{middleTitle}</h3>
        {neighborhoodCounts.length > 0 ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={neighborhoodCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#0c1222",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : dataSfFilmSkipped ? (
          <EmptyChart message="DataSF film is San Francisco only. No mapped parks, libraries, sights, or arts venues in this window — try the city center or another search." />
        ) : dataSfFilmOk ? (
          <EmptyChart message="DataSF returned no neighborhood rows for film permits right now." />
        ) : (
          <EmptyChart message="DataSF request failed — check network or Socrata status." />
        )}
        {chartNeighborhoodsSource === "osm" && neighborhoodCounts.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Counts from OSM (parks, libraries, worship, viewpoints, monuments,
            attractions, theatres, museums, etc.) in the geocoded bbox — not a live
            events calendar.
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">{rightTitle}</h3>
        {incidentOrTypeCounts.length > 0 ? (
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentOrTypeCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={9} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "#0c1222",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : traffic511Skipped && !regionBayArea ? (
          <EmptyChart message="511 highway data is SF Bay only. When you are outside that region, this chart fills from OSM layers — if the map area has no tagged nodes, the chart stays empty." />
        ) : traffic511Skipped ? (
          <EmptyChart message="Add SF_BAY_511_API_KEY in .env.local (511.org), restart dev, and search the Bay Area to load 511 breakdown — or rely on OSM layer counts when 511 has nothing to show." />
        ) : traffic511Ok ? (
          <EmptyChart message="511 connected — no events returned for the type breakdown (may be zero active incidents)." />
        ) : (
          <EmptyChart message="511 request failed — check API key and 511 status. If OSM returned layers, they may still appear after a successful Overpass response." />
        )}
        {chartIncidentsSource === "osm" && incidentOrTypeCounts.length > 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            Parking, transit, fuel/EV, parks, food & drink, arts, libraries/sights,
            civic — from OpenStreetMap in the same bbox as the map.
          </p>
        ) : chartIncidentsSource === "511" ? (
          <p className="mt-2 text-xs text-slate-500">
            Free token:{" "}
            <a
              className="text-cyan-500 hover:underline"
              href="https://511.org/open-data/token"
              target="_blank"
              rel="noreferrer"
            >
              511.org/open-data/token
            </a>
          </p>
        ) : null}
      </div>
    </div>
  );
}
