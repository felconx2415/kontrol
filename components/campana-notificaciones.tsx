"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { abrirNotificacion } from "@/actions/notificaciones";

export type NotificacionUI = {
  id: string;
  titulo: string;
  cuerpo: string;
  url: string | null;
  leida: boolean;
  cuando: string;
};

/**
 * Campana de la barra: cuántos avisos esperan y cuáles son.
 *
 * El contenido lo trae ya resuelto el layout, así que abrirla no dispara
 * ninguna consulta: en terreno, con señal intermitente, un menú que se queda
 * cargando es un menú que no sirve. El precio es que la lista es la de la
 * última carga de página, que para avisos de trámite es más que suficiente.
 *
 * El detalle completo vive en /notificaciones; esto es el vistazo rápido.
 */
export default function CampanaNotificaciones({
  notificaciones,
  sinLeer,
}: {
  notificaciones: NotificacionUI[];
  sinLeer: number;
}) {
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const ruta = usePathname();

  // Navegar cierra el menú: si no, quedaría flotando sobre la página nueva.
  // Se resuelve durante el render y no en un efecto, que es el patrón de React
  // para reiniciar estado cuando cambia una entrada: con un efecto, el menú
  // alcanzaría a pintarse una vez sobre la página nueva antes de cerrarse.
  const [rutaPintada, setRutaPintada] = useState(ruta);
  if (ruta !== rutaPintada) {
    setRutaPintada(ruta);
    setAbierta(false);
  }

  useEffect(() => {
    if (!abierta) return;

    const alTocarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierta(false);
    };
    const alEscapar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierta(false);
    };

    document.addEventListener("mousedown", alTocarFuera);
    document.addEventListener("keydown", alEscapar);
    return () => {
      document.removeEventListener("mousedown", alTocarFuera);
      document.removeEventListener("keydown", alEscapar);
    };
  }, [abierta]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierta((v) => !v)}
        aria-expanded={abierta}
        aria-haspopup="menu"
        aria-label={
          sinLeer === 0
            ? "Notificaciones"
            : `Notificaciones: ${sinLeer} sin leer`
        }
        className="foco-anillo-claro relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-white transition-colors duration-150 hover:bg-white/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[18px]"
          aria-hidden="true"
        >
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </svg>

        {/* El número, no solo un punto: «3 esperando» y «12 esperando» piden
            reacciones distintas. Sobre 9 se corta para que quepa en el globo. */}
        {sinLeer > 0 && (
          <span className="absolute right-1 top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-fallo px-1 text-[11px] font-semibold leading-[18px] text-white tabular-nums">
            {sinLeer > 9 ? "9+" : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[var(--z-pegajoso)] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-borde bg-panel text-tinta shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-borde px-4 py-2.5">
            <p className="text-sm font-semibold">Notificaciones</p>
            {sinLeer > 0 && (
              <span className="text-xs text-tinta-tenue">
                {sinLeer} sin leer
              </span>
            )}
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-tinta-tenue">
              No tienes avisos por ahora.
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-borde overflow-y-auto">
              {notificaciones.map((n) => (
                <li key={n.id}>
                  {/* Un <form> y no un <Link>: abrir el aviso tiene que
                      marcarlo leído, o el número de la campana no baja nunca
                      y la gente deja de mirarlo. */}
                  <form action={abrirNotificacion}>
                    <input type="hidden" name="notificacionId" value={n.id} />
                    <input
                      type="hidden"
                      name="url"
                      value={n.url ?? "/notificaciones"}
                    />
                    <button
                      type="submit"
                      className={`foco-anillo block w-full cursor-pointer px-4 py-3 text-left transition-colors duration-150 hover:bg-marca-50 ${
                        n.leida ? "" : "bg-marca-50/60"
                      }`}
                    >
                      <div className="flex items-baseline gap-2">
                        {/* Sin leer se marca con punto Y con negrita: el estado
                            nunca depende solo del color. */}
                        {!n.leida && (
                          <span
                            className="mt-1.5 size-2 shrink-0 rounded-full bg-marca-600"
                            aria-hidden="true"
                          />
                        )}
                        <p
                          className={`min-w-0 flex-1 text-sm ${
                            n.leida ? "text-tinta-suave" : "font-semibold"
                          }`}
                        >
                          {n.titulo}
                        </p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-tinta-suave">
                        {n.cuerpo}
                      </p>
                      <p className="mt-1 text-xs text-tinta-tenue">{n.cuando}</p>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notificaciones"
            className="foco-anillo block border-t border-borde px-4 py-3 text-center text-sm font-medium text-marca-700 transition-colors duration-150 hover:bg-panel-suave"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  );
}
