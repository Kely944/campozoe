import type { Metadata, Viewport } from "next";
import { Fraunces, Lexend } from "next/font/google";
import "./globals.css";

// Cuerpo: Lexend, diseñada para leerse con poco esfuerzo (RNF-02). Títulos: Fraunces, cálida.
const body = Lexend({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const heading = Fraunces({ subsets: ["latin"], variable: "--font-heading", display: "swap", axes: ["SOFT", "opsz"] });

export const metadata: Metadata = {
  title: "Pendientes Majo",
  description: "Recordatorios de pedidos, ofertas y pagos con avisos por WhatsApp.",
  appleWebApp: { capable: true, title: "Pendientes", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#151210" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Aplica el tema antes de pintar para que no parpadee: elección guardada o la del sistema
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${body.variable} ${heading.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
