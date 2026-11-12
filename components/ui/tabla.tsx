import type { ReactNode } from "react";

/**
 * Tabla de datos. El contenedor hace el scroll horizontal, no el body de la
 * página: sin esto una tabla ancha rompe el layout completo en móvil.
 */
export function Tabla({
  encabezados,
  children,
  anchoMinimo = "40rem",
}: {
  encabezados: (string | { texto: string; alineado?: "izq" | "der" })[];
  children: ReactNode;
  anchoMinimo?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-panel">
      <table
        className="tabla-apilable w-full text-sm"
        style={{ minWidth: anchoMinimo }}
      >
        <thead className="border-b border-borde text-left text-xs text-tinta-tenue">
          <tr>
            {encabezados.map((h, i) => {
              const texto = typeof h === "string" ? h : h.texto;
              const derecha = typeof h !== "string" && h.alineado === "der";
              return (
                <th
                  key={i}
                  scope="col"
                  className={`px-4 py-2.5 font-medium ${derecha ? "text-right" : ""}`}
                >
                  {texto}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde">{children}</tbody>
      </table>
    </div>
  );
}

export function Fila({
  children,
  atenuada = false,
}: {
  children: ReactNode;
  atenuada?: boolean;
}) {
  return (
    <tr
      className={`transition-colors duration-150 hover:bg-panel-suave ${
        atenuada ? "text-tinta-tenue" : ""
      }`}
    >
      {children}
    </tr>
  );
}

export function Celda({
  children,
  etiqueta,
  tenue = false,
  derecha = false,
  mono = false,
  completa = false,
  principal = false,
}: {
  children: ReactNode;
  /** Nombre del campo, mostrado como etiqueta cuando la tabla se apila en móvil. */
  etiqueta?: string;
  tenue?: boolean;
  derecha?: boolean;
  mono?: boolean;
  /** Ocupa todo el ancho sin etiqueta al apilarse (p. ej. una fila de acciones). */
  completa?: boolean;
  /** Título de la tarjeta al apilarse en móvil: a todo el ancho, sin etiqueta. */
  principal?: boolean;
}) {
  return (
    <td
      data-label={etiqueta}
      className={`px-4 py-2.5 ${completa ? "celda-completa" : ""} ${
        principal ? "celda-principal" : ""
      } ${
        tenue ? "text-tinta-suave" : ""
      } ${derecha ? "text-right" : ""} ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {children}
    </td>
  );
}

/**
 * Lista de filas para pantallas donde una tabla sería excesiva.
 *
 * `columnas` la reparte en dos desde xl: filas de un nombre y una fecha a
 * 1700px de ancho dejaban todo el centro vacío y obligaban a bajar el doble.
 * Las líneas entre filas salen del fondo de la lista asomando por un hueco de
 * 1px (divide-y no sirve en rejilla); la última fila impar ocupa las dos
 * columnas para no dejar una celda gris.
 */
export function ListaPanel({
  children,
  columnas = false,
}: {
  children: ReactNode;
  columnas?: boolean;
}) {
  return (
    <ul
      className={`divide-y divide-borde overflow-hidden rounded-2xl border border-borde bg-panel ${
        columnas
          ? "xl:grid xl:grid-cols-2 xl:gap-px xl:divide-y-0 xl:bg-borde xl:[&>li]:bg-panel xl:[&>li:last-child:nth-child(odd)]:col-span-2"
          : ""
      }`}
    >
      {children}
    </ul>
  );
}
