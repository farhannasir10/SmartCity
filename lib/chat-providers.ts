/**
 * OpenAI-compatible chat completions (same JSON shape).
 * Groq: free dev tier — https://console.groq.com/keys
 */

type Msg = { role: string; content: string };

async function postChatCompletions(input: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  messages: Msg[];
  maxTokens: number;
  providerLabel: string;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const res = await fetch(`${input.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: "system", content: input.system }, ...input.messages],
      temperature: 0.4,
      max_tokens: input.maxTokens,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return {
      ok: false,
      error: `${input.providerLabel} error (${res.status}): ${err.slice(0, 280)}`,
    };
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) {
    return { ok: false, error: `${input.providerLabel}: empty reply from model.` };
  }
  return { ok: true, text };
}

export function resolveChatProvider():
  | { kind: "groq"; apiKey: string; model: string }
  | { kind: "openai"; apiKey: string; model: string }
  | { kind: "none" } {
  const groq = process.env.GROQ_API_KEY?.trim();
  if (groq) {
    return {
      kind: "groq",
      apiKey: groq,
      model: process.env.GROQ_MODEL?.trim() || "llama-3.1-8b-instant",
    };
  }
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return {
      kind: "openai",
      apiKey: openai,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }
  return { kind: "none" };
}

export async function runChatCompletion(input: {
  system: string;
  messages: Msg[];
  maxTokens?: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const maxTokens = input.maxTokens ?? 750;
  const p = resolveChatProvider();
  if (p.kind === "none") {
    return { ok: false, error: "no_key" };
  }
  if (p.kind === "groq") {
    return postChatCompletions({
      baseUrl: "https://api.groq.com/openai/v1",
      apiKey: p.apiKey,
      model: p.model,
      system: input.system,
      messages: input.messages,
      maxTokens,
      providerLabel: "Groq",
    });
  }
  return postChatCompletions({
    baseUrl: "https://api.openai.com/v1",
    apiKey: p.apiKey,
    model: p.model,
    system: input.system,
    messages: input.messages,
    maxTokens,
    providerLabel: "OpenAI",
  });
}
