"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/lib/dashboard-types";

const CityMap = dynamic(() => import("@/components/CityMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-slate-500">
      Loading map…
    </div>
  ),
});

type Props = {
  center: [number, number];
  points: MapPoint[];
};

export default function MapPanel({ center, points }: Props) {
  return <CityMap center={center} points={points} />;
}
