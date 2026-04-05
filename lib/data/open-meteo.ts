import type { WeatherHour } from "@/lib/dashboard-types";

type OmHourly = {
  time?: string[];
  temperature_2m?: number[];
  precipitation_probability?: number[];
};

export async function fetchWeatherHourly(
  latitude: number,
  longitude: number
): Promise<WeatherHour[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    hourly: "temperature_2m,precipitation_probability",
    forecast_days: "1",
    timezone: "auto",
  });
  const url = `https://api.open-meteo.com/v1/forecast?${params}`;
  const res = await fetch(url, { next: { revalidate: 900 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = (await res.json()) as { hourly?: OmHourly };
  const h = json.hourly;
  if (!h?.time?.length) return [];
  const out: WeatherHour[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = h.time[i];
    const tempC = h.temperature_2m?.[i] ?? 0;
    const precipPct = h.precipitation_probability?.[i] ?? 0;
    const short = t.includes("T") ? t.split("T")[1]?.slice(0, 5) ?? t : t;
    out.push({ time: short, tempC, precipPct });
  }
  return out;
}
