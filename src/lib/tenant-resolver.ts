import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClientEnv } from "@/lib/env";
import { organization, user } from "@/lib/schema";

/**
 * Cache de domínios permitidos para validação de hostname.
 * Cache é invalidado apenas quando a aplicação reinicia ou variáveis de ambiente mudam.
 * 
 * Nota: Em produção, considere usar um cache distribuído (Redis) se necessário.
 */
let cachedAllowedDomains: string[] | null = null;

/**
 * Obtém lista de domínios permitidos com cache.
 * Valida apenas na primeira chamada ou quando cache está vazio.
 * 
 * @returns Array de domínios permitidos (normalizados: lowercase, trim)
 */
function getAllowedDomains(): string[] {
  if (cachedAllowedDomains !== null) {
    return cachedAllowedDomains;
  }

  try {
    const clientEnv = getClientEnv();
    const domains = [
      clientEnv.NEXT_PUBLIC_APP_URL.replace(/^https?:\/\//, ""),
      // Adicionar outros domínios permitidos se necessário
      // Ex: process.env.ALLOWED_DOMAINS?.split(",").map(d => d.trim())
    ]
      .filter(Boolean)
      .map((domain) => domain.toLowerCase().trim());

    // Validar que lista não está vazia
    if (domains.length === 0) {
      console.error(
        "[tenant-resolver] No allowed domains configured for tenant resolution"
      );
      cachedAllowedDomains = [];
      return [];
    }

    cachedAllowedDomains = domains;
    return domains;
  } catch (error) {
    console.error(
      "[tenant-resolver] Failed to get client environment variables:",
      error
    );
    cachedAllowedDomains = [];
    return [];
  }
}

/**
 * Resolves the tenant (organization) from the request using multiple strategies:
 * 1. Header (x-org-id) - most secure, used by middleware
 * 2. Path segment (/o/:orgId or /o/:slug)
 * 3. Subdomain (with hostname validation)
 * 4. Fallback - lastActiveOrgId from user record
 *
 * @param req - The Next.js request object
 * @param requestHeaders - Optional headers object (for use in middleware)
 * @returns The organization ID or null if not found
 */
export async function resolveTenant(
  req: NextRequest,
  requestHeaders?: Headers
): Promise<string | null> {
  const headerSource = requestHeaders ?? req.headers;

  // Estratégia 1: Header (mais seguro, usado por middleware)
  // Segurança: apenas aceitar x-org-id quando marcado como vindo do proxy/middleware.
  const orgIdFromHeader = headerSource.get("x-org-id");
  const orgIdFromProxy = headerSource.get("x-org-id-proxy") === "1";
  if (orgIdFromProxy && orgIdFromHeader) {
    return orgIdFromHeader;
  }

  // Estratégia 2: Path segment (/o/:orgId ou /o/:slug)
  const pathname = req.nextUrl.pathname;
  const orgIdentifierFromPath = pathname.match(/^\/o\/([^\/]+)/)?.[1];

  if (orgIdentifierFromPath) {
    // Pode ser orgId (UUID) ou slug - verificar no banco
    const org = await db
      .select()
      .from(organization)
      .where(
        or(
          eq(organization.id, orgIdentifierFromPath),
          eq(organization.slug, orgIdentifierFromPath)
        )
      )
      .limit(1);

    if (org[0]) {
      return org[0].id;
    }
  }

  // Estratégia 3: Subdomain (com validação de segurança)
  const hostname = req.headers.get("host") || "";

  // Obter lista de domínios permitidos (com cache)
  const allowedDomains = getAllowedDomains();

  // Validar que lista de domínios não está vazia (segurança crítica)
  if (allowedDomains.length === 0) {
    return null; // Rejeitar se não houver domínios configurados
  }

  // Normalizar hostname para comparação
  const normalizedHostname = hostname.toLowerCase().trim();

  // Validar hostname contra lista de domínios permitidos
  const isValidHost = allowedDomains.some((domain) => {
    return (
      normalizedHostname === domain ||
      normalizedHostname.endsWith(`.${domain}`)
    );
  });

  if (!isValidHost) {
    // Log tentativa de hostname inválido (para auditoria e segurança)
    console.warn(
      `[tenant-resolver] Invalid hostname attempted: ${hostname} (allowed: ${allowedDomains.join(", ")})`
    );
    return null;
  }

  // Se hostname é válido, tentar resolver por subdomain
  const subdomain = normalizedHostname.split(".")[0];
  if (subdomain && subdomain !== "www" && subdomain !== "app") {
    // Verificar se subdomain corresponde a um slug válido
    const org = await db
      .select()
      .from(organization)
      .where(eq(organization.slug, subdomain))
      .limit(1);

    if (org[0]) {
      return org[0].id;
    }
  }

  // Estratégia 4: Fallback - lastActiveOrgId do usuário
  // Usar headers passados como parâmetro (middleware) ou obter do contexto (route handlers)
  const sessionHeaders = requestHeaders || (await headers());
  const session = await auth.api.getSession({ headers: sessionHeaders });
  if (session?.user) {
    // Buscar lastActiveOrgId do user record
    const userRecord = await db
      .select({ lastActiveOrgId: user.lastActiveOrgId })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (userRecord[0]?.lastActiveOrgId) {
      return userRecord[0].lastActiveOrgId;
    }
  }

  return null;
}
