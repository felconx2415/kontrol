"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/actions/sesion";

export type DestinoPersona = { id: string; href: string; texto: string };

/** Primera letra del nombre y del apellido: «Juan Pérez» → «JP». */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? (partes[1][0] ?? "") : "";
  return (primera + segunda).toUpperCase();
}

/**
 * Lo de cada uno, colgando del nombre en la barra.
 *
 * Existe porque la barra creció a diez destinos mezclando tres cosas distintas:
 * el trabajo del día, lo que es mío y lo que se configura una vez al mes. Lo
 * personal se recoge aquí para quien no lo usa a diario —gestión, que casi no
 * tiene EPP a su nombre—; para el personal de terreno sigue arriba, donde
 * corresponde.
 *
 * «Salir» vive dentro y ya no como botón suelto: es la acción menos frecuente
 * de todas y estaba ocupando el sitio más caro de la pantalla.
 */
export default function MenuPersona({
  nombre,
  detalle,
  destinos,
}: {
  nombre: string;
  /** Rol y empresa, en una línea. */
  detalle: string;
  destinos: DestinoPersona[];
}) {
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  // Navegar cierra el menú. Se resuelve durante el render y no en un efecto,
  // que es el patrón de React para reiniciar estado cuando cambia una entrada:
  // con un efecto alcanzaría a pintarse una vez sobre la página nueva.
  const [rutaPintada, setRutaPintada] = useState(ruta);
  if (ruta !== rutaPintada) {
    setRutaPintada(ruta);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;

    const alTocarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alEscapar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alTocarFuera);
    document.addEventListener("keydown", alEscapar);
    return () => {
      document.removeEventListener("mousedown", alTocarFuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        className="foco-anillo-claro flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full px-2 text-left transition-colors duration-150 hover:bg-white/10"
      >
        {/* En pantallas angostas el nombre no cabe junto a los destinos, y un
            botón que fuera solo una flecha no se entendería: quedan las
            iniciales, que además dan el objetivo táctil de 44px. */}
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold sm:hidden"
        >
          {iniciales(nombre)}
        </span>

        {/* `min-w-0` + `truncate`: un nombre largo se recorta en vez de empujar
            los destinos y solaparse con ellos. */}
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium leading-tight">
            {nombre}
          </span>
          <span className="block truncate text-xs leading-tight text-marca-200">
            {detalle}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-4 shrink-0 transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--z-pegajoso)] mt-2 w-64 overflow-hidden rounded-xl border border-borde bg-panel text-tinta shadow-xl"
        >
          {/* En pantallas angostas el botón no muestra el nombre (no cabe junto
              a los destinos), así que la cabecera del menú lo repone. */}
          <div className="border-b border-borde px-4 py-2.5 sm:hidden">
            <p className="truncate text-sm font-semibold">{nombre}</p>
            <p className="truncate text-xs text-tinta-tenue">{detalle}</p>
          </div>

          {destinos.length > 0 && (
            <ul className="divide-y divide-borde">
              {destinos.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="foco-anillo block px-4 py-3 text-sm transition-colors duration-150 hover:bg-marca-50"
                  >
                    {d.texto}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <form action={cerrarSesion} className="border-t border-borde">
            <button
              type="submit"
              className="foco-anillo block w-full cursor-pointer px-4 py-3 text-left text-sm font-medium transition-colors duration-150 hover:bg-panel-suave"
            >
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
