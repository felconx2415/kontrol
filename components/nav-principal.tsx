"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type IconoNav =
  | "escritorio"
  | "solicitudes"
  | "equipamiento"
  | "reportes"
  | "catalogo"
  | "usuarios"
  | "brigadas";

export type EnlaceNav = { href: string; texto: string; icono: IconoNav };

/**
 * Trazos de cada icono (set Lucide, viewBox 24×24). Solo el interior: el <svg>
 * envolvente unifica tamaño, grosor y color. `currentColor` hace que el icono
 * herede el color del enlace, así sigue al estado activo/inactivo sin código
 * extra. Distinción deliberada: Usuarios es una persona (cuenta) y Brigadas un
 * grupo (cuadrilla); el casco marca "Mi equipamiento" en una app de EPP.
 */
const TRAZOS: Record<IconoNav, ReactNode> = {
  escritorio: (
    <>
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </>
  ),
  solicitudes: (
    <>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
  equipamiento: (
    <>
      <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z" />
      <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
      <path d="M4 15v-3a6 6 0 0 1 6-6" />
      <path d="M14 6a6 6 0 0 1 6 6v3" />
    </>
  ),
  reportes: (
    <>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  catalogo: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </>
  ),
  brigadas: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
};

export function Icono({ nombre }: { nombre: IconoNav }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-[18px] shrink-0"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  );
}

export default function NavPrincipal({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="mx-auto hidden max-w-6xl overflow-x-auto px-4 md:block">
      <ul className="flex gap-1">
        {enlaces.map((e) => {
          const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={activo ? "page" : undefined}
                className={`foco-anillo-claro inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-t border-b-2 px-3 text-sm font-medium transition-colors duration-150 ${
                  activo
                    ? "border-white text-white"
                    : "border-transparent text-marca-200 hover:border-white/40 hover:text-white"
                }`}
              >
                <Icono nombre={e.icono} />
                {e.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
