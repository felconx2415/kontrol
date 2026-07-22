import type { ReactNode } from "react";

/**
 * Panel base de la app. Reemplaza las 24 copias a mano del mismo string.
 *
 * `plano` quita el padding para los casos donde el contenido es una lista o
 * tabla que llega hasta el borde.
 */
export function Tarjeta({
  children,
  plano = false,
  className = "",
}: {
  children: ReactNode;
  plano?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-borde bg-panel ${plano ? "" : "p-4"} ${className}`}
    >
      {children}
    </div>
  );
}

/** Tarjeta con encabezado. El título va en el borde superior, no dentro. */
export function Seccion({
  titulo,
  acciones,
  children,
  plano = false,
  className = "",
}: {
  titulo: string;
  acciones?: ReactNode;
  children: ReactNode;
  plano?: boolean;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-borde bg-panel ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-borde px-4 py-3">
        <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
        {acciones}
      </header>
      <div className={plano ? "" : "p-4"}>{children}</div>
    </section>
  );
}

/**
 * Aviso en línea. Sustituye a los bloques de error/éxito escritos a mano y
 * evita el patrón prohibido de borde lateral de color.
 */
export function Aviso({
  tono,
  children,
  className = "",
}: {
  tono: "error" | "exito" | "espera";
  children: ReactNode;
  className?: string;
}) {
  const tonos = {
    error: "border-fallo-borde bg-fallo-fondo text-fallo",
    exito: "border-exito-borde bg-exito-fondo text-exito",
    espera: "border-espera-borde bg-espera-fondo text-espera",
  }[tono];

  return (
    <p
      role={tono === "error" ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${tonos} ${className}`}
    >
      {children}
    </p>
  );
}

/** Estado vacío consistente en listados y tablas. */
export function Vacio({
  mensaje,
  accion,
}: {
  mensaje: string;
  accion?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-borde-fuerte bg-panel p-10 text-center">
      <p className="text-sm text-tinta-suave">{mensaje}</p>
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  );
}
