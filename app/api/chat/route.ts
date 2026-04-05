import { NextResponse } from "next/server";
import {
  buildAssistantContextString,
  buildChatContextCompact,
} from "@/lib/assistant-context";
import { runChatCompletion, resolveChatProvider } from "@/lib/chat-providers";
import { loadDashboardData } from "@/lib/load-dashboard";
import type { DashboardData, VisualPlanStep } from "@/lib/dashboard-types";
import {
  buildVisualPlanFromDashboard,
  wantsVisualPlanMessage,
} from "@/lib/visual-plan";

type PlanSpot = { name: string; where?: string | null };

type PlanningSnap = {
  parks: (PlanSpot | string)[];
  foodAndDrink: (PlanSpot | string)[];
  artsCulture: (PlanSpot | string)[];
  visitPlaces: (PlanSpot | string)[];
  weatherOneLiner: string | null;
  avoidOrDefer: string[];
};

function formatPlanSpot(s: PlanSpot | string): string {
  if (typeof s === "string") return s;
  return s.where ? `${s.name} — ${s.where}` : s.name;
}

function offlinePlanReply(
  city: string,
  snap: PlanningSnap | undefined
): string | null {
  if (!snap) return null;
  const lines: string[] = [
    `Sample plan for ${city} (from the live snapshot — not real-time crowds):`,
    "",
  ];
  if (snap.parks.length) {
    lines.push(
      `• Green space: ${snap.parks.slice(0, 2).map(formatPlanSpot).join(" · ")}.`
    );
  }
  if (snap.foodAndDrink.length) {
    lines.push(
      `• Eat / drink: ${snap.foodAndDrink.slice(0, 2).map(formatPlanSpot).join(" · ")}.`
    );
  }
  const culture =
    snap.visitPlaces[0] ?? snap.artsCulture[0];
  if (culture) {
    lines.push(`• Culture / sight: ${formatPlanSpot(culture)}.`);
  }
  const namedCount =
    snap.parks.length +
    snap.foodAndDrink.length +
    snap.visitPlaces.length +
    snap.artsCulture.length;
  if (namedCount === 0) {
    lines.push(
      "• OpenStreetMap shows parks/cafés here, but none had usable names in this download — use the map pins, or try a denser area."
    );
  }
  if (snap.weatherOneLiner) {
    lines.push("", `Weather: ${snap.weatherOneLiner}.`);
  }
  if (snap.avoidOrDefer.length) {
    lines.push(
      "",
      `Watch out: ${snap.avoidOrDefer.join(" ")}`
    );
  }
  lines.push(
    "",
    "Confirm opening hours before you go — data is from open maps and forecasts only."
  );
  return lines.join("\n");
}

type ChatBody = {
  messages?: { role: string; content: string }[];
  /** Same `q` as homepage URL — keeps chat aligned with map. */
  place?: string;
};

/** Groq free tier: keep prompt + history under TPM limits. */
function trimChatMessages(
  msgs: { role: string; content: string }[],
  maxMessages = 6,
  maxCharsPerMessage = 900
): { role: string; content: string }[] {
  return msgs.slice(-maxMessages).map((m) => ({
    role: m.role,
    content:
      m.content.length > maxCharsPerMessage
        ? `${m.content.slice(0, maxCharsPerMessage)}…`
        : m.content,
  }));
}

function visualPlanPayload(
  lastUserContent: string,
  dashboard: DashboardData
): { visualPlan?: VisualPlanStep[] } {
  if (!wantsVisualPlanMessage(lastUserContent)) return {};
  const steps = buildVisualPlanFromDashboard(dashboard);
  return steps.length > 0 ? { visualPlan: steps } : {};
}

async function offlineReplyContent(
  lastUser: string,
  dashboard: DashboardData
): Promise<string> {
  const ctx = JSON.parse(buildAssistantContextString(dashboard)) as {
    city: string;
    parking: { name: string; capacity: number | null; note: string }[];
    eventsList: { title: string; venue: string; time: string }[];
    cultureVenuesOsm: { title: string; category: string }[];
    traffic511: { name: string; congestionPercent: number }[];
    osmLayerCounts: { name: string; count: number }[];
    mobilityBrief: {
      tempMinC: number;
      tempMaxC: number;
      peakPrecipPct: number;
      peakPrecipTime: string;
    } | null;
    sources: Record<string, string>;
    planningSnapshot?: PlanningSnap;
  };
  const q = lastUser.toLowerCase();

  if (wantsVisualPlanMessage(lastUser)) {
    const plan = offlinePlanReply(ctx.city, ctx.planningSnapshot);
    if (plan) return plan;
  }

  if (q.includes("park")) {
    if (ctx.parking.length === 0) {
      return "No parking rows in the current snapshot — Overpass failed or returned nothing for this area.";
    }
    const withCap = ctx.parking.filter((p) => p.capacity != null);
    if (withCap.length === 0) {
      return `${ctx.parking.length} OSM parking feature(s) listed; none include a capacity tag in the data.`;
    }
    const best = withCap.reduce((a, b) =>
      (b.capacity ?? 0) > (a.capacity ?? 0) ? b : a
    );
    return `Largest mapped capacity: ${best.name} (~${best.capacity} spaces, OSM tag — not live occupancy).`;
  }
  if (q.includes("event") || q.includes("film") || q.includes("today")) {
    if (ctx.eventsList.length > 0) {
      const lines = ctx.eventsList
        .slice(0, 8)
        .map((e) => `• ${e.title} — ${e.venue}`)
        .join("\n");
      return `Film permits (DataSF, San Francisco):\n${lines}`;
    }
    if (ctx.cultureVenuesOsm?.length) {
      const lines = ctx.cultureVenuesOsm
        .slice(0, 8)
        .map((v) => `• ${v.title} (${v.category}, OSM)`)
        .join("\n");
      return `Mapped culture venues (OpenStreetMap) near your search:\n${lines}`;
    }
    if (ctx.sources?.dataSfFilm === "skipped") {
      return "DataSF film permits are San Francisco only. For your area, check the dashboard for OSM culture venues if any were returned for this map window.";
    }
    return "No film permit rows from DataSF and no culture POIs from OSM in the current snapshot.";
  }
  if (q.includes("traffic") || q.includes("congest") || q.includes("511")) {
    if (ctx.traffic511?.length) {
      const top = ctx.traffic511.slice(0, 4).map((t) => t.name).join("; ");
      return `511 traffic (SF Bay): ${top}`;
    }
    const layers = ctx.osmLayerCounts
      ?.map((x) => `${x.name}: ${x.count}`)
      .join("; ");
    const wx = ctx.mobilityBrief
      ? ` Weather ~24h: ${ctx.mobilityBrief.tempMinC.toFixed(0)}–${ctx.mobilityBrief.tempMaxC.toFixed(0)}°C, peak rain ~${Math.round(ctx.mobilityBrief.peakPrecipPct)}%.`
      : "";
    if (ctx.sources?.traffic511 === "skipped") {
      return `511 highway incidents only cover the SF Bay Area.${wx}${layers ? ` OSM layers in view: ${layers}.` : ""}`;
    }
    return `No 511 rows in context.${wx}${layers ? ` OSM: ${layers}.` : ""}`;
  }
  return `No AI key configured. Add a free Groq key (GROQ_API_KEY from console.groq.com) or OPENAI_API_KEY. Map: ${dashboard.cityName}. You can still use rule-based answers: try “I have 2 hours — suggest a plan”, or ask about parking, weather, transit, film data, or highway feeds.`;
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body.messages?.filter(
    (m) => m.role === "user" || m.role === "assistant"
  );
  if (!raw?.length) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  const lastUser = [...raw].reverse().find((m) => m.role === "user");
  if (!lastUser?.content) {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  const place = typeof body.place === "string" ? body.place : undefined;

  const dashboard = await loadDashboardData(place);
  const planExtras = visualPlanPayload(lastUser.content, dashboard);

  if (resolveChatProvider().kind === "none") {
    return NextResponse.json({
      reply: await offlineReplyContent(lastUser.content, dashboard),
      ...planExtras,
    });
  }
  const compactJson = buildChatContextCompact(dashboard);
  const system = `CityPulse assistant for ${dashboard.cityName}. Use ONLY this JSON as facts — no invented occupancy or closures.

The UI already shows a visual timeline with map pins for plan requests — add weather tips, what to avoid, or tweaks; do not duplicate every timed stop unless you add new context.

Plans (e.g. "2 hours"): planningSnapshot uses {name, where}. Quote exact "name" strings. Never use generic "Park (OSM)" / "Café (OSM)".

≤5 short bullets when planning; mention avoidOrDefer if present. Be concise.
JSON:\n${compactJson}`;

  const result = await runChatCompletion({
    system,
    messages: trimChatMessages(raw),
    maxTokens: 512,
  });

  if (!result.ok) {
    return NextResponse.json({
      reply:
        result.error === "no_key"
          ? await offlineReplyContent(lastUser.content, dashboard)
          : result.error,
      ...planExtras,
    });
  }

  return NextResponse.json({ reply: result.text, ...planExtras });
}
