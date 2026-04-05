"use client";

import { useMemo, useState, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip,
} from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPoint, MapPointKind } from "@/lib/dashboard-types";

function colorForKind(kind: MapPointKind): string {
  switch (kind) {
    case "incident":
      return "#f87171";
    case "film":
      return "#a78bfa";
    case "parking":
      return "#34d399";
    case "transit":
      return "#fbbf24";
    case "civic":
      return "#fb923c";
    case "culture":
      return "#f472b6";
    case "services":
      return "#2dd4bf";
    case "park":
      return "#86efac";
    case "food":
      return "#fb7185";
    case "library":
      return "#7dd3fc";
    case "worship":
      return "#c4b5fd";
    case "viewpoint":
      return "#fde047";
    case "heritage":
      return "#d6d3d1";
    case "attraction":
      return "#f9a8d4";
    default:
      return "#22d3ee";
  }
}

type FilterKey = "parking" | "food" | "parks" | "culture" | "mobilityOther";

const FILTER_LABELS: Record<FilterKey, string> = {
  parking: "Parking",
  food: "Food",
  parks: "Parks",
  culture: "Culture",
  mobilityOther: "Transit & services",
};

function passesFilter(kind: MapPointKind, f: Record<FilterKey, boolean>): boolean {
  if (kind === "parking") return f.parking;
  if (kind === "food") return f.food;
  if (kind === "park") return f.parks;
  if (
    [
      "culture",
      "library",
      "worship",
      "viewpoint",
      "heritage",
      "attraction",
      "film",
    ].includes(kind)
  )
    return f.culture;
  if (
    ["transit", "bart", "services", "civic", "incident"].includes(kind)
  )
    return f.mobilityOther;
  return f.mobilityOther;
}

type Props = {
  center: [number, number];
  points: MapPoint[];
};

export default function CityMap({ center, points }: Props) {
  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    parking: true,
    food: true,
    parks: true,
    culture: true,
    mobilityOther: true,
  });
  const [heatmap, setHeatmap] = useState(false);

  const toggle = useCallback((k: FilterKey) => {
    setFilters((prev) => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const visible = useMemo(
    () => points.filter((p) => passesFilter(p.kind, filters)),
    [points, filters]
  );

  const c: LatLngExpression = [center[0], center[1]];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
          Layers
        </span>
        {(Object.keys(FILTER_LABELS) as FilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggle(k)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              filters[k]
                ? "border-cyan-800/60 bg-cyan-950/40 text-cyan-100"
                : "border-slate-700 bg-slate-900/40 text-slate-500 line-through decoration-slate-600"
            }`}
          >
            {FILTER_LABELS[k]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setHeatmap((h) => !h)}
          className={`ml-auto rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            heatmap
              ? "border-rose-800/60 bg-rose-950/40 text-rose-100"
              : "border-slate-700 text-slate-400 hover:border-slate-600"
          }`}
        >
          Heatmap
        </button>
      </div>
      <div className="h-[320px] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <MapContainer
          center={c}
          zoom={12}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {visible.map((p) => {
            const stroke = heatmap ? "#f97316" : colorForKind(p.kind);
            const fill = heatmap
              ? `rgba(249, 115, 22, ${0.2 + p.intensity * 0.45})`
              : colorForKind(p.kind);
            const radius = heatmap
              ? 14 + p.intensity * 38
              : 10 + p.intensity * 22;
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{
                  color: heatmap ? "rgba(249,115,22,0.35)" : stroke,
                  fillColor: fill,
                  fillOpacity: heatmap
                    ? 0.55 + p.intensity * 0.25
                    : 0.32 + p.intensity * 0.22,
                  weight: heatmap ? 0 : 2,
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                  <div className="max-w-[220px] text-xs text-slate-900">
                    <p className="font-semibold uppercase tracking-wide text-slate-600">
                      {p.kind}
                    </p>
                    <p className="font-medium leading-snug">
                      {p.label.slice(0, 72)}
                      {p.label.length > 72 ? "…" : ""}
                    </p>
                    {p.detail ? (
                      <p className="mt-0.5 text-[10px] text-slate-600">
                        {p.detail}
                      </p>
                    ) : null}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="max-w-xs text-slate-900">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {p.kind}
                    </p>
                    <p className="font-semibold">{p.label}</p>
                    {p.detail ? (
                      <p className="text-xs text-slate-600">{p.detail}</p>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
