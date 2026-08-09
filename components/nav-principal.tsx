"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type IconoNav =
  | "escritorio"
  | "solicitudes"
  | "equipamiento"
  | "documentos"
  | "bodega"
  | "reportes"
  | "catalogo"
  | "usuarios"
  | "brigadas"
  | "empresas"
  | "notificaciones"
  | "perfil"
  | "configuracion"
  | "api";

export type EnlaceNav = { href: string; texto: string; icono: IconoNav };

/**
 * Trazos de cada icono (set Lucide, viewBox 24×24). Solo el interior: el <svg>
 * envolvente unifica tamaño, grosor y color. `currentColor` hace que el icono
 * herede el color del enlace, así sigue al estado activo/inactivo sin código
 * extra. Distinción deliberada: Usuarios es una persona (cuenta), Brigadas un
 * grupo (cuadrilla) y Empresas un edificio (la organización que las contiene);
 * el casco marca "Mi equipamiento" en una app de EPP. La persona dentro de un
 * círculo es el perfil propio, para no confundirla con Usuarios.
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
  documentos: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  bodega: (
    <>
      <path d="M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" />
      <path d="M22 20V8a2 2 0 0 0-1.15-1.81l-7-3.5a2 2 0 0 0-1.7 0l-7 3.5A2 2 0 0 0 2 8v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z" />
      <path d="M6 13h12" />
      <path d="M6 17h12" />
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
  empresas: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </>
  ),
  notificaciones: (
    <>
      <path d="M10.268 21a2 2 0 0 0 3.464 0" />
      <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
    </>
  ),
  perfil: (
    <>
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      <circle cx="12" cy="10" r="3" />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </>
  ),
  api: (
    <>
      <path d="m18 16 4-4-4-4" />
      <path d="m6 8-4 4 4 4" />
      <path d="m14.5 4-5 16" />
    </>
  ),
  configuracion: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
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

/**
 * Enlaces del interior de la píldora. En vez de iconos + subrayado, cada
 * destino usa un rótulo que rueda hacia arriba al pasar el cursor: el texto
 * sale por el techo mientras su copia entra desde abajo. Los iconos siguen
 * existiendo, pero solo en el cajón móvil, donde ayudan a barrer una lista
 * vertical; aquí estorbarían al ancho de ocho destinos en una sola línea.
 *
 * El desplazamiento es exactamente 24px (`h-6`) en ambas copias, así que las
 * dos capas comparten rejilla y el relevo no se nota. La copia de abajo va
 * `aria-hidden`: es decorativa y un lector de pantalla no debe leer dos veces
 * el mismo destino.
 */
export default function NavPrincipal({ enlaces }: { enlaces: EnlaceNav[] }) {
  const ruta = usePathname();

  return (
    <nav className="hidden shrink-0 lg:block">
      <ul className="flex items-center gap-5">
        {enlaces.map((e) => {
          const activo = ruta === e.href || ruta.startsWith(`${e.href}/`);
          return (
            <li key={e.href}>
              <Link
                href={e.href}
                aria-current={activo ? "page" : undefined}
                className={`foco-anillo-claro group relative block whitespace-nowrap rounded text-sm font-medium transition-colors duration-150 ${
                  activo ? "text-white" : "text-marca-200 hover:text-white"
                }`}
              >
                {/* El recorte vive aquí dentro para no cortar el anillo de
                    foco ni el subrayado de activo, que están en el enlace. */}
                <span className="relative block h-6 overflow-hidden">
                  <span className="flex h-6 items-center transition-transform duration-300 group-hover:-translate-y-full">
                    {e.texto}
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-full flex h-6 items-center transition-transform duration-300 group-hover:-translate-y-full"
                  >
                    {e.texto}
                  </span>
                </span>
                {activo && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-1 h-px rounded-full bg-white"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
