import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "./env";
import * as schema from "./schema";
import { readFileSync } from "fs";

// Use centralized environment validation
const env = getServerEnv();
const connectionString = env.POSTGRES_URL;

function loadCaCertificate(): string | null {
  try {
    if (env.POSTGRES_CA_CERT_PATH) {
      return readFileSync(env.POSTGRES_CA_CERT_PATH, "utf8");
    }
    if (env.POSTGRES_CA_CERT) {
      return env.POSTGRES_CA_CERT;
    }
  } catch (error) {
    console.warn("[db] Não foi possível ler o certificado CA:", error);
  }
  return null;
}

const ca = loadCaCertificate();

// Configure connection with timeouts and pooling for production readiness
const client = postgres(connectionString, {
  max: 10, // maximum number of connections in the pool
  idle_timeout: 20, // seconds before closing idle connections
  connect_timeout: 10, // seconds for connection timeout
  ssl: ca
    ? { ca, rejectUnauthorized: true }
    : { rejectUnauthorized: false },
});

if (!ca) {
  console.warn(
    "[db] POSTGRES_CA_CERT_PATH/POSTGRES_CA_CERT não definido; usando SSL sem validação de CA."
  );
}

export const db = drizzle(client, { schema });
