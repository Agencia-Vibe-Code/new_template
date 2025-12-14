export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-6 flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-foreground">Roteiro Builder</p>
          <p>Multi-tenant RBAC • PDF overlay • Auditoria de exportações</p>
        </div>
        <div className="flex gap-4">
          <a
            className="hover:text-primary"
            href="mailto:dev@roteiro.local"
          >
            Suporte
          </a>
          <a
            className="hover:text-primary"
            href="/docs/features/README"
          >
            Docs de features
          </a>
        </div>
      </div>
    </footer>
  );
}
