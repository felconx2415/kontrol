"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/actions/sesion";
import { Icono, type IconoNav } from "./nav-principal";

export type DestinoPersona = { id: string; href: string; texto: string; icono: IconoNav };

/** Primera letra del nombre y del apellido: «Juan Pérez» → «JP». */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? (partes[1][0] ?? "") : "";
  return (primera + segunda).toUpperCase();
}

/**
 * La cuenta, arriba a la derecha: quién soy, mis cosas y los ajustes.
 *
 * Desde que la navegación vive en la barra lateral, esto ya no reparte
 * destinos de trabajo: es «mi cuenta», el sitio donde cualquiera busca su
 * perfil, su firma o cómo salir. La cabecera dice con qué cuenta se está
 * trabajando —rol, cargo o brigada, empresa—, que en un equipo compartido de
 * bodega no es obvio.
 *
 * «Salir» va al final y separado: es la acción menos frecuente de todas.
 */
export default function MenuPersona({
  nombre,
  detalle,
  empresa,
  destinos,
}: {
  nombre: string;
  /** Rol y brigada o cargo, en una línea. */
  detalle: string;
  /** Empresa de la cuenta, o cuántas atiende un gestor. */
  empresa?: string | null;
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
        className="foco-anillo flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 text-left transition-colors duration-150 hover:bg-panel-suave"
      >
        {/* En pantallas angostas el nombre no cabe junto a los destinos, y un
            botón que fuera solo una flecha no se entendería: quedan las
            iniciales, que además dan el objetivo táctil de 44px. */}
        {/* Las iniciales van siempre, como el avatar de cualquier panel: son
            el ancla visual de «mi cuenta». En pantallas angostas el nombre no
            cabe y quedan solas, con el objetivo táctil de 44px. */}
        <span
          aria-hidden="true"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-800"
        >
          {iniciales(nombre)}
        </span>

        {/* `min-w-0` + `truncate`: un nombre largo se recorta en vez de empujar
            los destinos y solaparse con ellos. */}
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-sm font-medium leading-tight">
            {nombre}
          </span>
          <span className="block truncate text-xs leading-tight text-tinta-tenue">
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
          className={`size-4 shrink-0 text-tinta-tenue transition-transform duration-200 ${
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
          className="absolute right-0 top-full z-[var(--z-pegajoso)] mt-2 w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-borde bg-panel text-tinta shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-borde px-4 py-3.5">
            <span
              aria-hidden="true"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-marca-100 text-sm font-semibold text-marca-800"
            >
              {iniciales(nombre)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{nombre}</p>
              <p className="truncate text-xs text-tinta-suave">{detalle}</p>
              {empresa && <p className="truncate text-xs text-tinta-tenue">{empresa}</p>}
            </div>
          </div>

          {destinos.length > 0 && (
            <ul className="p-1.5">
              {destinos.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href}
                    className="foco-anillo flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-tinta-suave transition-colors duration-150 hover:bg-panel-suave hover:text-tinta"
                  >
                    <Icono nombre={d.icono} />
                    {d.texto}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <form action={cerrarSesion} className="border-t border-borde p-1.5">
            <button
              type="submit"
              className="foco-anillo flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-tinta-suave transition-colors duration-150 hover:bg-fallo-fondo hover:text-fallo"
            >
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              Salir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
