import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Executes a function within an organization context using PostgreSQL SET LOCAL.
 * This ensures that Row-Level Security (RLS) policies can access the current
 * organization ID and user ID for the duration of the transaction.
 *
 * ⚠️ IMPORTANT: SET LOCAL only works within transactions and is automatically
 * cleared when the transaction ends. This prevents context leakage between requests
 * when using connection pooling.
 *
 * @param orgId - The organization ID to set in the context
 * @param userId - The user ID to set in the context
 * @param fn - The function to execute within the context
 * @returns The result of the function
 */
export async function withOrgContext<T>(
  orgId: string,
  userId: string,
  fn: () => Promise<T>
): Promise<T> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL app.current_org_id = ${orgId}`);
    await tx.execute(sql`SET LOCAL app.user_id = ${userId}`);
    return await fn();
  });
}

/**
 * @deprecated Use withOrgContext for operations within transactions.
 * This function is deprecated because SET LOCAL only works within transactions.
 * Calling this function will throw an error to prevent misuse.
 */
export async function setOrgContext(_orgId: string, _userId: string) {
  throw new Error(
    "setOrgContext is deprecated. Use withOrgContext for operations within transactions. " +
    "Example: await withOrgContext(orgId, userId, async () => { /* your code */ })"
  );
}

