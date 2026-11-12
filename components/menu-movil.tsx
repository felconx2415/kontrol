"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ListaNavegacion, type GrupoLateralUI } from "./barra-lateral";

/**
 * Menú de navegación para móvil: un botón hamburguesa que abre un cajón lateral
 * con todos los destinos. Toma el relevo bajo lg, donde los destinos ya no caben
 * en la píldora de la barra.
 *
 * Aquí no se esconde nada: en vertical caben todos, incluidos los que en
 * escritorio viven en el menú del nombre. Lo que hacía falta era el rótulo que
 * separa las tres naturalezas —mi trabajo, lo mío, configuración—, porque una
 * lista plana de diez destinos obliga a leerlos todos para encontrar uno.
 *
 * Implementado con un overlay controlado por estado (no <dialog>) y animaciones
 * de `transform`/`opacity`: funciona en cualquier navegador de teléfono. Antes
 * usaba <dialog> + showModal() + @starting-style/allow-discrete, que en varios
 * navegadores móviles no abrían el cajón o lo dejaban fuera de pantalla.
 *
 * Patrón de dos estados: `montado` lo mete/saca del DOM (para no dejar los
 * enlaces en el orden de tabulación cuando está cerrado) y `visible` dispara la
 * transición de entrada/salida.
 */
export default function MenuMovil({
  grupos,
  usuarioNombre,
  usuarioRol,
}: {
  grupos: GrupoLateralUI[];
  usuarioNombre: string;
  usuarioRol: string;
}) {
  const [montado, setMontado] = useState(false);
  const [visible, setVisible] = useState(false);
  const abrir = () => setMontado(true);
  const cerrar = () => setVisible(false); // el timeout de abajo lo desmonta

  // Recién montado: tras dos frames se activa la animación de entrada. El doble
  // rAF asegura que Safari pinte el estado inicial (-translate-x-full) antes de
  // cambiar a translate-x-0, para que la transición corra.
  useEffect(() => {
    if (!montado) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, [montado]);

  // Al ocultarse, se desmonta cuando termina la transición.
  useEffect(() => {
    if (montado && !visible) {
      const t = setTimeout(() => setMontado(false), 300);
      return () => clearTimeout(t);
    }
  }, [visible, montado]);

  // Escape para cerrar y scroll del fondo bloqueado mientras está montado.
  useEffect(() => {
    if (!montado) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVisible(false);
    };
    document.addEventListener("keydown", onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [montado]);

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={montado}
        className="foco-anillo -ml-1 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-tinta transition-colors duration-150 hover:bg-panel-suave lg:hidden"
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

      {montado &&
        createPortal(
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Fondo: un toque fuera del cajón lo cierra. */}
            <div
              onClick={cerrar}
              aria-hidden="true"
              className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-out ${
                visible ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Cajón: alto completo pinado con inset-y-0 (no depende de dvh). */}
            <div
              className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-panel text-tinta shadow-2xl transition-transform duration-300 ease-out ${
                visible ? "translate-x-0" : "-translate-x-full"
              }`}
            >
              <div className="border-b border-borde px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  {/* Cajón claro, como la barra lateral: logotipo de palabra
                      oscura. */}
                  <Image
                    src="/logo-kontrol-oscuro.png"
                    alt="Kontrol"
                    width={600}
                    height={148}
                    className="h-6 w-auto"
                  />
                  <button
                    type="button"
                    onClick={cerrar}
                    aria-label="Cerrar menú"
                    className="foco-anillo -mr-2 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-tinta-tenue transition-colors duration-150 hover:text-tinta"
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
                <div className="mt-3 min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {usuarioNombre}
                  </p>
                  <p className="truncate text-xs text-tinta-tenue">
                    {usuarioRol}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 py-4">
                <ListaNavegacion grupos={grupos} alElegir={cerrar} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
