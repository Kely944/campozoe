// Íconos de trazo, de un color (currentColor). Sin librerías.
const PATHS = {
  hoy: "M8 2v3M16 2v3M3.5 9h17M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5zM8.5 14.5l2.2 2.2 4.8-4.8",
  pedidos: "M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5zM3.5 7.5 12 12l8.5-4.5M12 12v9",
  cobros: "M3 7.5h18v11H3zM3 11h18M7 15.5h3",
  tareas: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  mas: "M4 6h16M4 12h16M4 18h16",
  produccion: "M4 20h16M6 20V10l6-5 6 5v10M10 20v-5h4v5",
  favorita: "M3 9.5 12 4l9 5.5M5 10v9h14v-9M9 19v-5h6v5",
  pagos: "M4 5h16v14H4zM4 10h16M8 15h2M14 15h2",
  reportes: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  equipo: "M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5zM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.15a3.25 3.25 0 0 1 0 6.2",
  panel: "M3 13h4v7H3zM10 9h4v11h-4zM17 4h4v16h-4z",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alerta: "M12 9v4M12 17h.01M10.3 3.9 2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  vacio: "M4 13.5 6.5 6h11l2.5 7.5M4 13.5V19h16v-5.5M4 13.5h4.5l1 2h5l1-2H20",
  salir: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  flecha: "M9 6l6 6-6 6",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, className = "size-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
