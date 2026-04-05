"use client";

import { useCallback, useRef, useState } from "react";
import type { VisualPlanStep } from "@/lib/dashboard-types";
import PlanTimeline from "@/components/PlanTimeline";

type Msg =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      visualPlan?: VisualPlanStep[];
    };

type Props = {
  /** Must match homepage `?q=` so chat uses the same dashboard snapshot. */
  placeQuery: string;
};

export default function CitizenChat({ placeQuery }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi — ask for a concrete plan (e.g. “I have 2 hours — what should I do?”) and you’ll get a timeline with real place names and map pins, plus a written reply when an AI key is set.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          place: placeQuery,
        }),
      });
      const data = (await res.json()) as {
        reply?: string;
        error?: string;
        visualPlan?: VisualPlanStep[];
      };
      const reply =
        data.reply ??
        data.error ??
        "Something went wrong. Check GROQ_API_KEY (free) or OPENAI_API_KEY in .env.local.";
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: reply,
          ...(data.visualPlan?.length ? { visualPlan: data.visualPlan } : {}),
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Network error. Try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(
        () =>
          listRef.current?.scrollTo({
            top: listRef.current.scrollHeight,
            behavior: "smooth",
          }),
        50
      );
    }
  }, [input, loading, messages, placeQuery]);

  return (
    <div className="flex h-[min(32rem,72vh)] min-h-[420px] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Planning assistant</h2>
        <p className="text-xs text-slate-500">
          Free tier: set <code className="text-slate-400">GROQ_API_KEY</code> from
          groq.com — or use OpenAI. Plans show a visual timeline + map pins even
          without a key.
        </p>
      </div>
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.role === "user"
                ? "ml-8 rounded-lg bg-cyan-950/50 px-3 py-2 text-cyan-50"
                : "mr-2 rounded-lg bg-slate-800/80 px-3 py-2 text-slate-200"
            }
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
            {msg.role === "assistant" && msg.visualPlan?.length ? (
              <PlanTimeline steps={msg.visualPlan} />
            ) : null}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-slate-500">Thinking…</div>
        )}
      </div>
      <div className="flex gap-2 border-t border-[var(--border)] p-3">
        <input
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan-600 focus:outline-none"
          placeholder="e.g. I have 2 hours — suggest a plan"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !e.shiftKey && (e.preventDefault(), void send())
          }
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={loading}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-cyan-500 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
