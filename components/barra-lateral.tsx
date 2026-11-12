"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Icono, type EnlaceNav } from "./nav-principal";
import { COOKIE_LATERAL } from "@/lib/preferencias";

/** Un grupo de destinos con su rótulo. Ver `lateralDe` en lib/navegacion.ts. */
export type GrupoLateralUI = {
  grupo: string;
  titulo: string;
  hrefTitulo: string | null;
  destinos: EnlaceNav[];
};

function esActivo(ruta: string, href: string) {
  return ruta === href || ruta.startsWith(`${href}/`);
}

/**
 * La lista de destinos agrupada, tal como se ve en la barra lateral y en el
 * cajón del teléfono: una sola pieza para que las dos no se desincronicen.
 *
 * El activo va en el tono suave de la marca con el icono en el tono de acción
 * —el mismo naranja de los botones—, nunca en verde: el verde es de los
 * estados (entregado, vigente), no de «dónde estoy».
 */
export function ListaNavegacion({
  grupos,
  compacta = false,
  alElegir,
}: {
  grupos: GrupoLateralUI[];
  compacta?: boolean;
  alElegir?: () => void;
}) {
  const ruta = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-5">
      {grupos.map((g) => (
        <section key={g.grupo}>
          {compacta ? (
            // Colapsada no hay sitio para el rótulo: una línea separa los
            // grupos y el nombre queda para el lector de pantalla.
            <h2 className="sr-only">{g.titulo}</h2>
          ) : g.hrefTitulo ? (
            <h2 className="px-3 pb-1.5">
              <Link
                href={g.hrefTitulo}
                onClick={alElegir}
                className="foco-anillo rounded text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue transition-colors duration-150 hover:text-tinta"
              >
                {g.titulo}
              </Link>
            </h2>
          ) : (
            <h2 className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-tinta-tenue">
              {g.titulo}
            </h2>
          )}

          <ul className={`flex flex-col gap-0.5 ${compacta ? "border-t border-borde pt-3" : ""}`}>
            {g.destinos.map((e) => {
              const activo = esActivo(ruta, e.href);
              return (
                <li key={e.href}>
                  <Link
                    href={e.href}
                    onClick={alElegir}
                    aria-current={activo ? "page" : undefined}
                    // Colapsada, el nombre aparece al pasar el cursor.
                    title={compacta ? e.texto : undefined}
                    className={`foco-anillo flex min-h-11 items-center gap-3 rounded-xl text-sm font-medium transition-colors duration-150 ${
                      compacta ? "justify-center px-0" : "px-3"
                    } ${
                      activo
                        ? "bg-marca-50 text-marca-800 [&_svg]:text-marca-600"
                        : "text-tinta-suave hover:bg-panel-suave hover:text-tinta"
                    }`}
                  >
                    <Icono nombre={e.icono} />
                    <span className={compacta ? "sr-only" : "truncate"}>{e.texto}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

/**
 * Barra lateral izquierda del panel, desde lg.
 *
 * Reemplaza a la píldora oscura de arriba: con una sola línea no cabían más de
 * cinco destinos y la navegación se repartía entre la barra, el menú del nombre
 * y un índice de configuración. A la izquierda caben todos, agrupados, y la
 * parte de arriba queda para lo que es de la cuenta: buscar, avisos y perfil.
 *
 * Se colapsa a solo iconos para ganar ancho en las tablas. Lo recuerda una
 * cookie y no localStorage, porque el layout la lee en el servidor: así la
 * barra llega ya con su ancho y no salta al hidratar.
 */
export default function BarraLateral({
  grupos,
  compactaInicial,
}: {
  grupos: GrupoLateralUI[];
  compactaInicial: boolean;
}) {
  const [compacta, setCompacta] = useState(compactaInicial);

  function alternar() {
    const nueva = !compacta;
    setCompacta(nueva);
    document.cookie = `${COOKIE_LATERAL}=${nueva ? "compacta" : "amplia"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <aside
      className={`no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-borde bg-panel transition-[width] duration-200 ease-out lg:flex ${
        compacta ? "w-[4.75rem]" : "w-64"
      }`}
    >
      <div
        className={`flex h-16 shrink-0 items-center ${
          compacta ? "justify-center px-2" : "justify-between px-5"
        }`}
      >
        <Link
          href="/escritorio"
          aria-label="Kontrol · ir al escritorio"
          className="foco-anillo flex items-center rounded-lg"
        >
          {compacta ? (
            <Image
              src="/iconos/kontrol-192.png"
              alt=""
              width={192}
              height={192}
              priority
              className="size-8"
            />
          ) : (
            <Image
              src="/logo-kontrol-oscuro.png"
              alt="Kontrol"
              width={600}
              height={148}
              priority
              className="h-6 w-auto"
            />
          )}
        </Link>

        {!compacta && (
          <BotonColapsar compacta={compacta} alPulsar={alternar} />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <ListaNavegacion grupos={grupos} compacta={compacta} />
      </div>

      {/* Colapsada, el botón para volver a abrirla baja al pie: arriba no cabe
          junto al logo. */}
      {compacta && (
        <div className="flex justify-center border-t border-borde py-3">
          <BotonColapsar compacta={compacta} alPulsar={alternar} />
        </div>
      )}
    </aside>
  );
}

function BotonColapsar({
  compacta,
  alPulsar,
}: {
  compacta: boolean;
  alPulsar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-label={compacta ? "Expandir el menú lateral" : "Colapsar el menú lateral"}
      aria-expanded={!compacta}
      title={compacta ? "Expandir menú" : "Colapsar menú"}
      className="foco-anillo inline-flex size-9 cursor-pointer items-center justify-center rounded-lg text-tinta-tenue transition-colors duration-150 hover:bg-panel-suave hover:text-tinta"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-[18px] transition-transform duration-200 ${compacta ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        <path d="m11 17-5-5 5-5" />
        <path d="m18 17-5-5 5-5" />
      </svg>
    </button>
  );
}
