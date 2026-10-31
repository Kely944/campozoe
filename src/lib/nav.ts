import type { IconName } from "@/components/Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  admin?: boolean;
  hint?: string; // descripción en la pantalla "Más"
}

/** Pantallas de la app. Las cuatro primeras van en la barra inferior del celular. */
export const NAV: NavItem[] = [
  { href: "/", label: "Hoy", icon: "hoy" },
  { href: "/pedidos", label: "Pedidos", icon: "pedidos", hint: "Champiñón, etiquetas, harinas" },
  { href: "/cobros", label: "Cobros", icon: "cobros", hint: "Ventas fiadas y saldos" },
  { href: "/obligaciones", label: "Tareas", icon: "tareas", hint: "Qué hay que hacer y cuándo avisar" },
  { href: "/produccion", label: "Producción", icon: "produccion", hint: "Grano a remojar y bandejas" },
  { href: "/favorita", label: "Favorita", icon: "favorita", admin: true, hint: "Oferta semanal y órdenes de compra" },
  { href: "/pagos", label: "Pagos", icon: "pagos", admin: true, hint: "Préstamos, calendario y cheques" },
  { href: "/reportes", label: "Reportes", icon: "reportes", admin: true, hint: "Ventas e importar del facturador" },
  { href: "/equipo", label: "Equipo", icon: "equipo", hint: "WhatsApp y correo de cada persona" },
  { href: "/admin", label: "Panel", icon: "panel", admin: true, hint: "Cumplimiento y avisos enviados" },
];

export const BOTTOM_COUNT = 4;

/** ¿La ruta actual pertenece a esta pantalla? */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
