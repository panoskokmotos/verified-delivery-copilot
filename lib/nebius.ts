import OpenAI from "openai";
import type { Usage } from "./prices";

export const models = {
  vision: process.env.NEMOTRON_VISION_MODEL || "google/gemma-3-27b-it",
  // Used when the vision model doesn't answer in time. Faster, but echoes the request more, so it's not the default.
  visionFallback: process.env.NEMOTRON_VISION_FALLBACK || "openbmb/MiniCPM-V-4_5",
  reasoning: process.env.NEMOTRON_REASONING_MODEL || "nvidia/nemotron-3-super-120b-a12b",
  writer: process.env.NEMOTRON_WRITER_MODEL || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  // Only for borderline calls: bigger and pricier per token, so everyday decisions stay on Super.
  escalation: process.env.NEMOTRON_ULTRA_MODEL || "nvidia/Nemotron-3-Ultra-550b-a55b",
};

export const isLive = () => Boolean(process.env.NEBIUS_API_KEY);

// Hard stop on model calls per UTC day, so a bug, a loop or a busy demo can't burn the credits.
// A verification makes 3 or 4 calls. Counted per server process.
const MAX_CALLS_PER_DAY = Number(process.env.NEBIUS_MAX_CALLS_PER_DAY || 300);
const budget = { day: "", calls: 0 };

function spendCall() {
  const today = new Date().toISOString().slice(0, 10);
  if (budget.day !== today) Object.assign(budget, { day: today, calls: 0 });
  if (budget.calls >= MAX_CALLS_PER_DAY) {
    throw new Error(`Daily model call limit reached (${MAX_CALLS_PER_DAY}). Try again tomorrow or raise NEBIUS_MAX_CALLS_PER_DAY.`);
  }
  budget.calls++;
}

let client: OpenAI | null = null;
function nebius() {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.NEBIUS_API_KEY,
      baseURL: process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1",
      // The SDK default is 10 minutes with 2 retries. One slow model call must not stall a delivery check.
      timeout: 60_000,
      maxRetries: 1,
    });
  }
  return client;
}

/** Pull the first JSON object out of a model reply (handles ```json fences and reasoning text). */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : cleaned;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Model did not return JSON");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

type Content = OpenAI.Chat.Completions.ChatCompletionContentPart[] | string;

export async function askJson<T>(opts: {
  model: string;
  system: string;
  user: Content;
  maxTokens?: number;
  usage?: Usage[]; // token counts of every call made here get appended, for the cost of the check
}): Promise<T> {
  const track = (model: string, u?: OpenAI.CompletionUsage) =>
    opts.usage?.push({ model, input: u?.prompt_tokens ?? 0, output: u?.completion_tokens ?? 0 });
  spendCall();
  const res = await nebius().chat.completions.create({
    model: opts.model,
    temperature: 0.1,
    max_tokens: opts.maxTokens ?? 1200,
    messages: [
      { role: "system", content: opts.system + "\nReply with one JSON object only. No prose." },
      { role: "user", content: opts.user },
    ],
  });
  track(opts.model, res.usage);
  const text = res.choices[0]?.message?.content ?? "";
  try {
    return extractJson<T>(text);
  } catch {
    // One repair pass: ask the model to fix its own output.
    spendCall();
    const fix = await nebius().chat.completions.create({
      model: models.writer,
      temperature: 0,
      max_tokens: 800,
      messages: [
        { role: "system", content: "Convert the text into one valid JSON object. Output JSON only." },
        { role: "user", content: text },
      ],
    });
    track(models.writer, fix.usage);
    return extractJson<T>(fix.choices[0]?.message?.content ?? "");
  }
}
