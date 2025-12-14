import { z } from "zod";

/**
 * Server-side environment variables schema.
 * These variables are only available on the server.
 */
const serverEnvSchema = z.object({
  // Banco
  POSTGRES_URL: z.string().url("URL de banco inválida"),
  POSTGRES_CA_CERT_PATH: z.string().optional(),
  POSTGRES_CA_CERT: z.string().optional(),

  // Autenticação
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres"),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // AI (opcional)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openai/gpt-5-mini"),

  // Storage (opcional)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // App
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

/**
 * Client-side environment variables schema.
 * These variables are exposed to the browser via NEXT_PUBLIC_ prefix.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates and returns server-side environment variables.
 * Throws an error if validation fails.
 */
export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Variáveis de ambiente do servidor inválidas:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Variáveis de ambiente do servidor inválidas");
  }

  return parsed.data;
}

/**
 * Validates and returns client-side environment variables.
 * Throws an error if validation fails.
 */
export function getClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!parsed.success) {
    console.error(
      "Variáveis de ambiente do cliente inválidas:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Variáveis de ambiente do cliente inválidas");
  }

  return parsed.data;
}

/**
 * Checks if required environment variables are set.
 * Logs warnings for missing optional variables.
 */
export function checkEnv(): void {
  const warnings: string[] = [];

  // Check required variables
  if (!process.env.POSTGRES_URL) {
    throw new Error("POSTGRES_URL é obrigatória");
  }

  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET é obrigatória");
  }

  // Check optional variables and warn
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push("Google OAuth não configurado. Login social ficará desativado.");
  }

  if (!process.env.OPENROUTER_API_KEY) {
    warnings.push("OPENROUTER_API_KEY não definida. Funções de AI ficarão desabilitadas.");
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    warnings.push("BLOB_READ_WRITE_TOKEN não definida. Usando storage local.");
  }

  // Log warnings in development
  if (process.env.NODE_ENV === "development" && warnings.length > 0) {
    console.warn("\n⚠️  Avisos de ambiente:");
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn("");
  }
}
