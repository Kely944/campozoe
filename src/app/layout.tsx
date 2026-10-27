import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pendientes Majo",
  description: "Recordatorios de pedidos, ofertas y pagos con avisos por WhatsApp.",
  appleWebApp: { capable: true, title: "Pendientes", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#15803d" },
    { media: "(prefers-color-scheme: dark)", color: "#131512" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Aplica el tema antes de pintar para que no parpadee: elección guardada o la del sistema
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
