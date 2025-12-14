import { Space_Grotesk, Fira_Code } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Roteiro Builder",
    template: "%s | Roteiro Builder",
  },
  description:
    "Construa formulários multi-tenant com RBAC e exporte PDFs idênticos ao template Roteiro de visita.",
  keywords: [
    "PDF overlay",
    "RBAC",
    "multi-tenant",
    "form builder",
    "Roteiro de visita",
  ],
  authors: [{ name: "Roteiro Builder" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Roteiro Builder",
    title: "Roteiro Builder",
    description:
      "Multi-tenant RBAC Form Builder com overlay em PDF para o roteiro de visita.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Roteiro Builder",
    description:
      "Multi-tenant RBAC Form Builder com overlay em PDF para o roteiro de visita.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Roteiro Builder",
  description:
    "Form builder multi-tenant com RBAC e exportação PDF pixel-perfect.",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${display.variable} ${mono.variable} antialiased min-h-screen bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.07),transparent_20%)]`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
