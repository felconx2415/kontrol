"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono, type EnlaceNav } from "./nav-principal";

/**
 * Menú de navegación para móvil: un botón hamburguesa que abre un cajón lateral
 * con todos los destinos. Reemplaza al scroll horizontal de la barra en
 * pantallas < md, donde los enlaces de la derecha quedaban sin descubrir.
 *
 * Se apoya en <dialog> nativo con showModal(): eso da trampa de foco, cierre
 * con Escape y fondo inerte sin reimplementarlos. La animación de entrada y
 * salida vive en `.menu-movil` (globals.css) con @starting-style.
 */
export default function MenuMovil({
  enlaces,
  usuarioNombre,
  usuarioRol,
}: {
  enlaces: EnlaceNav[];
  usuarioNombre: string;
  usuarioRol: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [abierto, setAbierto] = useState(false);
  const ruta = usePathname();

  const abrir = () => {
    dialogo.current?.showModal();
    setAbierto(true);
  };
  const cerrar = () => dialogo.current?.close();

  // Al navegar a otra ruta, el cajón se cierra solo.
  useEffect(() => {
    dialogo.current?.close();
  }, [ruta]);

  // Bloquea el scroll del fondo mientras el cajón está abierto.
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="foco-anillo-claro -ml-1 inline-flex size-11 items-center justify-center rounded-lg text-white md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="size-6"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <dialog
        ref={dialogo}
        className="menu-movil"
        onClose={() => setAbierto(false)}
        // Un clic sobre el ::backdrop llega al propio <dialog>; ahí se cierra.
        onClick={(e) => {
          if (e.target === dialogo.current) cerrar();
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{usuarioNombre}</p>
              <p className="truncate text-xs text-marca-200">{usuarioRol}</p>
            </div>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar menú"
              className="foco-anillo-claro inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-marca-200 transition-colors duration-150 hover:text-white"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col gap-1">
              {enlaces.map((e) => {
                const activo =
                  ruta === e.href || ruta.startsWith(`${e.href}/`);
                return (
                  <li key={e.href}>
                    <Link
                      href={e.href}
                      onClick={cerrar}
                      aria-current={activo ? "page" : undefined}
                      className={`foco-anillo-claro flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                        activo
                          ? "bg-white/10 text-white"
                          : "text-marca-200 hover:bg-white/5 hover:text-white"
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
        </div>
      </dialog>
    </>
  );
}
