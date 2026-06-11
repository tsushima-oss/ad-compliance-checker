import Anthropic from "@anthropic-ai/sdk";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text" || part.type === "image_url" || part.type === "file_url") {
    return part;
  }
  throw new Error("Unsupported message content part");
};

// ─── Retry helpers ────────────────────────────────────────────────────────────

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

const computeBackoffDelay = (attempt: number, retryAfterMs?: number): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

const fetchWithBackoff = async (url: string, init: RequestInit): Promise<Response> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok || attempt === RETRY_MAX_RETRIES) return response;
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      try { await response.body?.cancel(); } catch { /* ignore */ }
      await sleep(computeBackoffDelay(attempt, retryAfterMs));
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_MAX_RETRIES) throw error;
      await sleep(computeBackoffDelay(attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("LLM request failed after retries");
};

// ─── Gemini (Google OpenAI-compatible endpoint) ───────────────────────────────

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

async function invokeGeminiModel(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = ENV.googleAiApiKey;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
    model,
    maxTokens,
    max_tokens,
  } = params;

  const normalizeMessage = (message: Message) => {
    const { role, name, tool_call_id } = message;
    if (role === "tool" || role === "function") {
      const content = ensureArray(message.content)
        .map(p => (typeof p === "string" ? p : JSON.stringify(p)))
        .join("\n");
      return { role, name, tool_call_id, content };
    }
    const contentParts = ensureArray(message.content).map(normalizeContentPart);
    if (contentParts.length === 1 && contentParts[0].type === "text") {
      return { role, name, content: contentParts[0].text };
    }
    return { role, name, content: contentParts };
  };

  const payload: Record<string, unknown> = {
    model: model || "gemini-2.5-flash",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) payload.tools = tools;

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") payload.max_tokens = resolvedMaxTokens;

  const explicitFormat = responseFormat || response_format;
  const schema = outputSchema || output_schema;
  if (explicitFormat) {
    payload.response_format = explicitFormat;
  } else if (schema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: { name: schema.name, schema: schema.schema, strict: schema.strict },
    };
  }

  const response = await fetchWithBackoff(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini invoke failed: ${response.status} ${response.statusText} – ${errorText}`);
  }

  return (await response.json()) as InvokeResult;
}

// ─── Anthropic/Claude ─────────────────────────────────────────────────────────

async function invokeAnthropicModel(params: InvokeParams): Promise<InvokeResult> {
  const apiKey = ENV.anthropicApiKey;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const anthropic = new Anthropic({ apiKey });
  const { messages, model, maxTokens, max_tokens } = params;
  const resolvedMaxTokens = max_tokens ?? maxTokens ?? 4096;

  // Separate system messages from conversation messages
  const systemParts: string[] = [];
  const conversationMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      const parts = ensureArray(msg.content).map(p =>
        typeof p === "string" ? p : p.type === "text" ? p.text : ""
      );
      systemParts.push(parts.join("\n"));
      continue;
    }

    // For user/assistant messages, extract text content
    const contentParts = ensureArray(msg.content);
    const textContent = contentParts
      .map(p => {
        if (typeof p === "string") return p;
        if (p.type === "text") return p.text;
        return "";
      })
      .join("\n");

    conversationMessages.push({
      role: msg.role as "user" | "assistant",
      content: textContent,
    });
  }

  const response = await anthropic.messages.create({
    model: model || "claude-sonnet-4-6",
    max_tokens: resolvedMaxTokens,
    ...(systemParts.length > 0 ? { system: systemParts.join("\n") } : {}),
    messages: conversationMessages,
  });

  const textBlock = response.content.find(c => c.type === "text");
  const text = textBlock?.type === "text" ? textBlock.text : "";

  return {
    id: response.id,
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: response.stop_reason,
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const model = params.model ?? "";
  if (model.startsWith("claude")) {
    return invokeAnthropicModel(params);
  }
  return invokeGeminiModel(params);
}
