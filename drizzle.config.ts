import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load environment variables from .env.local (or .env)
config({ path: ".env.local" });
config(); // Also try .env as fallback

// Parse URL to handle SSL configuration
const postgresUrl = process.env.POSTGRES_URL!;
const url = new URL(postgresUrl);

// Configure SSL for self-signed certificates in development
// Remove sslmode from URL if present and handle via ssl option instead
const sslMode = url.searchParams.get("sslmode");
url.searchParams.delete("sslmode");

const dbCredentials: { url: string; ssl?: boolean | { rejectUnauthorized: boolean } } = {
  url: url.toString(),
};

// Configure SSL based on environment and URL parameters
if (sslMode === "require" || sslMode === "prefer" || process.env.NODE_ENV === "production") {
  // In production or when SSL is required, use proper SSL
  // In development with self-signed certs, allow them
  dbCredentials.ssl = process.env.NODE_ENV === "production" 
    ? true 
    : { rejectUnauthorized: false };
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/schema.ts",
  out: "./drizzle",
  dbCredentials,
});
