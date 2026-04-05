"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type { MobilityPlaceRow, NamedCount } from "@/lib/dashboard-types";
import {
  locationLineFromAddressOrCoords,
  openStreetMapPinUrl,
} from "@/lib/map-links";

const LAYER_ORDER = [
  "Parking",
  "Transit",
  "Fuel & EV",
  "Parks",
  "Food & drink",
  "Arts & culture",
  "Libraries & sights",
  "Civic & safety",
] as const;

type Props = {
  children: ReactNode;
  osmLayerCounts: NamedCount[];
  mobilityPlaceLists: Record<string, MobilityPlaceRow[]>;
  overpassOk: boolean;
};

function defaultLayer(counts: NamedCount[]): string {
  const m = new Map(counts.map((c) => [c.name, c.count]));
  for (const name of LAYER_ORDER) {
    if ((m.get(name) ?? 0) > 0) return name;
  }
  return counts[0]?.name ?? "Parking";
}

function locationLine(row: MobilityPlaceRow): string {
  return locationLineFromAddressOrCoords(row.address, row.lat, row.lng);
}

export default function OsmMobilityExplorer({
  children,
  osmLayerCounts,
  mobilityPlaceLists,
  overpassOk,
}: Props) {
  const initial = useMemo(
    () => defaultLayer(osmLayerCounts),
    [osmLayerCounts]
  );
  const [selectedLayer, setSelectedLayer] = useState(initial);

  const rows = mobilityPlaceLists[selectedLayer] ?? [];
  const isParking = selectedLayer === "Parking";
  const totalInLayer =
    osmLayerCounts.find((c) => c.name === selectedLayer)?.count ?? rows.length;
  const listTruncated = totalInLayer > rows.length;

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">
          Getting around
        </h2>
        {children}
        {overpassOk && osmLayerCounts.length > 0 ? (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/60 px-3 py-2 text-xs">
            <p className="font-medium text-slate-300">
              OpenStreetMap layers (this search area)
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
              Tap a row for names, addresses or coordinates, and an OSM map link.
            </p>
            <ul className="mt-2 space-y-1.5 text-slate-400">
              {osmLayerCounts.map((row) => {
                const active = row.name === selectedLayer;
                return (
                  <li key={row.name}>
                    <button
                      type="button"
                      onClick={() => setSelectedLayer(row.name)}
                      className={`flex w-full items-baseline justify-between gap-4 rounded-md border px-2 py-1.5 text-left transition-colors ${
                        active
                          ? "border-cyan-800/60 bg-cyan-950/25 text-slate-200"
                          : "border-transparent hover:border-slate-700 hover:bg-slate-900/40"
                      }`}
                    >
                      <span>{row.name}</span>
                      <span className="shrink-0 font-mono text-sm text-slate-200 tabular-nums">
                        {row.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : overpassOk ? (
          <p className="mt-3 text-xs text-slate-600">
            No layer counts in this bbox (sparse OSM for the tags we query).
          </p>
        ) : (
          <p className="mt-3 text-xs text-slate-600">
            OpenStreetMap layer list needs a successful Overpass response.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {selectedLayer}{" "}
          <span className="font-normal text-slate-500">(OpenStreetMap)</span>
        </h2>
        <p className="mb-2 text-xs text-slate-500">
          {isParking
            ? "Names and mapped addresses where tagged; capacity only if the community added it."
            : "Names and mapped addresses where tagged; otherwise coordinates are shown for the pin."}
        </p>
        {overpassOk && rows.length > 0 ? (
          <p className="mb-2 text-[11px] text-slate-400">
            {listTruncated ? (
              <>
                Showing <span className="tabular-nums text-slate-200">{rows.length}</span> of{" "}
                <span className="tabular-nums text-slate-200">{totalInLayer}</span> in this
                category (same total as the left column; list is capped per category for cache
                size).
              </>
            ) : (
              <>
                Listing all{" "}
                <span className="tabular-nums text-slate-200">{rows.length}</span> in this
                category.
              </>
            )}
          </p>
        ) : null}
        {!overpassOk ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-6 text-center text-sm text-slate-500">
            OpenStreetMap query failed (Overpass timeout, overload, or network).
            Wait a minute and reload, or try a simpler place name so the map bbox
            stays small.
          </p>
        ) : rows.length > 0 ? (
          <ul className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto overscroll-y-contain pr-1 text-sm">
            {rows.map((p) => (
              <li
                key={p.id}
                className="rounded-lg border border-slate-800/60 bg-[var(--surface-2)]/50 px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-slate-200">{p.name}</span>
                  <span className="shrink-0 text-right text-xs text-slate-500">
                    {isParking ? (
                      p.capacity != null ? (
                        <span>{p.capacity} cap.</span>
                      ) : (
                        <span>no cap. tag</span>
                      )
                    ) : p.category ? (
                      p.category
                    ) : (
                      <span className="text-slate-600">OSM</span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-snug text-slate-400">
                  {locationLine(p)}
                </p>
                {isParking && p.capacity != null ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full w-full rounded-full bg-cyan-600/60"
                      title="Tagged capacity only — not live occupancy"
                    />
                  </div>
                ) : null}
                <a
                  href={openStreetMapPinUrl(p.lat, p.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-[11px] text-cyan-500 hover:underline"
                >
                  Open location on map →
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hidden rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-6 text-center text-sm text-slate-500">
            No rows returned for this layer in the downloaded sample (Overpass or
            server list limit). The count on the left still reflects every match in
            OSM for this map area — try a smaller city or reload.
          </p>
        )}
      </div>
    </section>
  );
}
