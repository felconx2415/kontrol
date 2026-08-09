"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type PestanaConfig = { id: string; href: string; texto: string };

/**
 * Salto entre las áreas de configuración.
 *
 * Fila horizontal desplazable y no una barra lateral: la misma pieza sirve en
 * escritorio y en teléfono, sin colapsar nada. El área activa se marca con
 * fondo **y** con `aria-current`, nunca solo con color.
 */
export default function PestanasConfiguracion({
  pestanas,
}: {
  pestanas: PestanaConfig[];
}) {
  const ruta = usePathname();

  return (
    <nav aria-label="Áreas de configuración" className="no-print -mx-4 px-4">
      <ul className="flex gap-1 overflow-x-auto pb-1">
        {pestanas.map((p) => {
          const activa = ruta === p.href || ruta.startsWith(`${p.href}/`);
          return (
            <li key={p.id}>
              <Link
                href={p.href}
                aria-current={activa ? "page" : undefined}
                className={`foco-anillo inline-flex min-h-11 items-center whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                  activa
                    ? "bg-marca-600 text-white"
                    : "text-tinta-suave hover:bg-panel-suave hover:text-tinta"
                }`}
              >
                {p.texto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
