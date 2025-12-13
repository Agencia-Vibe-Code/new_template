import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv } from "./env";
import * as schema from "./schema";

// Use centralized environment validation
const env = getServerEnv();
const connectionString = env.POSTGRES_URL;

// Configure connection with timeouts and pooling for production readiness
const client = postgres(connectionString, {
  max: 10, // maximum number of connections in the pool
  idle_timeout: 20, // seconds before closing idle connections
  connect_timeout: 10, // seconds for connection timeout
});

export const db = drizzle(client, { schema });
