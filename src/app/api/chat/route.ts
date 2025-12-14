import { headers } from "next/headers";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";

// Schema de validação das mensagens
const messagePartSchema = z.object({
  type: z.string(),
  text: z.string().max(10000, "Mensagem muito longa").optional(),
});

const messageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema).optional(),
  content: z.union([z.string(), z.array(messagePartSchema)]).optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).max(100, "Mensagens demais"),
});

export async function POST(req: Request) {
  // Verifica autenticação
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return new Response(JSON.stringify({ error: "Não autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse e valida corpo
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Requisição inválida",
        details: parsed.error.flatten().fieldErrors,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const { messages }: { messages: UIMessage[] } = parsed.data as { messages: UIMessage[] };

  // Inicializa OpenRouter com API key do ambiente
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY não configurada" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const openrouter = createOpenRouter({ apiKey });

  const result = streamText({
    model: openrouter(process.env.OPENROUTER_MODEL || "openai/gpt-5-mini"),
    messages: convertToModelMessages(messages),
  });

  return (
    result as unknown as { toUIMessageStreamResponse: () => Response }
  ).toUIMessageStreamResponse();
}
