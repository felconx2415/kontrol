"use client";

import { useEffect, useState } from "react";

/**
 * Confirmación efímera tras una acción. Antes el único indicio de que algo
 * había pasado era que una píldora de estado cambiaba de color.
 */
/** Debe coincidir con la duración de `.aviso-flotante--saliendo` en globals.css. */
const MS_SALIDA = 150;

export default function AvisoFlotante({ mensaje }: { mensaje: string }) {
  const [visible, setVisible] = useState(true);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    // La cookie se consume al mostrarse: si no, reaparecería en cada navegación.
    document.cookie = "kontrol_aviso=; Max-Age=0; path=/";
    const t = setTimeout(() => setSaliendo(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // El desmontaje espera a que termine la salida. Antes el aviso entraba con
  // una animación cuidada y luego desaparecía de golpe; la asimetría se notaba.
  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => setVisible(false), MS_SALIDA);
    return () => clearTimeout(t);
  }, [saliendo]);

  const cerrar = () => setSaliendo(true);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`aviso-flotante ${saliendo ? "aviso-flotante--saliendo" : ""} fixed inset-x-4 bottom-4 z-[var(--z-aviso)] mx-auto flex max-w-md items-center gap-3 rounded-xl border border-exito-borde bg-exito-fondo px-4 py-3 shadow-lg sm:inset-x-auto sm:right-6`}
    >
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-exito">
        <svg viewBox="0 0 12 12" className="size-3 fill-white" aria-hidden="true">
          <path d="M10.28 2.28 4.5 8.06 1.72 5.28.28 6.72l4.22 4.22 7.22-7.22z" />
        </svg>
      </span>
      <p className="text-sm font-medium text-exito">{mensaje}</p>
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar aviso"
        className="foco-anillo ml-auto rounded p-1 text-exito/70 transition-colors hover:text-exito"
      >
        <svg viewBox="0 0 12 12" className="size-3 fill-current" aria-hidden="true">
          <path d="M9.53 1.06 6 4.59 2.47 1.06 1.06 2.47 4.59 6 1.06 9.53l1.41 1.41L6 7.41l3.53 3.53 1.41-1.41L7.41 6l3.53-3.53z" />
        </svg>
      </button>
    </div>
  );
}
