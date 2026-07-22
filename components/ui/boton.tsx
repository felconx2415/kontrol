"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

export type VarianteBoton = "primario" | "secundario" | "peligro" | "fantasma";
export type TamanoBoton = "sm" | "md";

const VARIANTES: Record<VarianteBoton, string> = {
  primario:
    "bg-marca-600 text-white hover:bg-marca-700 active:bg-marca-800 disabled:hover:bg-marca-600",
  secundario:
    "border border-borde-fuerte bg-panel text-tinta hover:bg-panel-suave active:bg-lienzo",
  peligro:
    "border border-fallo-borde bg-panel text-fallo hover:bg-fallo-fondo active:bg-fallo-fondo",
  fantasma: "text-tinta-suave hover:bg-panel-suave hover:text-tinta",
};

// min-h-11 = 44px, el mínimo táctil recomendado. La app se usa en terreno,
// a veces con guantes, así que los objetivos pequeños no son opción.
const TAMANOS: Record<TamanoBoton, string> = {
  sm: "min-h-9 px-3 py-1.5 text-sm sm:min-h-9",
  md: "min-h-11 px-4 py-2 text-sm",
};

// `cursor-pointer` es explícito porque Tailwind 4 dejó los <button> con
// `cursor: default` en su preflight.
//
// `active:scale-[0.97]` da acuse de recibo instantáneo al pulsar. La app se usa
// en terreno, a veces con guantes, donde confirmar que el toque se registró
// importa más que en escritorio. La escala se excluye cuando el botón está
// deshabilitado: un botón en vuelo no debe responder al toque.
//
// La transición nombra `scale` y no `transform`: la utilidad `scale-*` de
// Tailwind 4 compila a la propiedad individual `scale`, que `transition-transform`
// no cubre.
const BASE =
  "foco-anillo inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-[color,background-color,border-color,scale] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100";

export function clasesBoton(
  variante: VarianteBoton = "primario",
  tamano: TamanoBoton = "md",
  extra = "",
) {
  return `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;
}

type PropsBoton = React.ComponentProps<"button"> & {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Texto mostrado mientras la Server Action asociada está en vuelo. */
  textoPendiente?: string;
  /** Ocupa todo el ancho del contenedor. */
  bloque?: boolean;
};

/**
 * Botón de envío consciente del estado del formulario.
 *
 * Antes cada pantalla reimplementaba `useFormStatus` con su propio botón
 * interno; esto centraliza el patrón: si el botón está dentro de un <form>
 * con Server Action, se deshabilita y cambia el texto automáticamente.
 */
export default function Boton({
  variante = "primario",
  tamano = "md",
  textoPendiente,
  bloque = false,
  className = "",
  children,
  disabled,
  ...resto
}: PropsBoton) {
  const { pending } = useFormStatus();
  const esEnvio = resto.type !== "button" && resto.type !== "reset";
  const enVuelo = esEnvio && pending;

  return (
    <button
      {...resto}
      disabled={disabled || enVuelo}
      aria-busy={enVuelo || undefined}
      className={clasesBoton(variante, tamano, `${bloque ? "w-full" : ""} ${className}`)}
    >
      {enVuelo && textoPendiente ? textoPendiente : children}
    </button>
  );
}

/** Enlace con la apariencia de un botón, para navegaciones que son acciones. */
export function BotonEnlace({
  variante = "primario",
  tamano = "md",
  bloque = false,
  className = "",
  ...resto
}: React.ComponentProps<typeof Link> & {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  bloque?: boolean;
}) {
  return (
    <Link
      {...resto}
      className={clasesBoton(variante, tamano, `${bloque ? "w-full" : ""} ${className}`)}
    />
  );
}
