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
    <div className="overflow-x-auto rounded-xl border border-borde bg-panel">
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
}: {
  children: ReactNode;
  /** Nombre del campo, mostrado como etiqueta cuando la tabla se apila en móvil. */
  etiqueta?: string;
  tenue?: boolean;
  derecha?: boolean;
  mono?: boolean;
  /** Ocupa todo el ancho sin etiqueta al apilarse (p. ej. una fila de acciones). */
  completa?: boolean;
}) {
  return (
    <td
      data-label={etiqueta}
      className={`px-4 py-2.5 ${completa ? "celda-completa" : ""} ${
        tenue ? "text-tinta-suave" : ""
      } ${derecha ? "text-right" : ""} ${mono ? "font-mono tabular-nums" : ""}`}
    >
      {children}
    </td>
  );
}

/** Lista de filas para pantallas donde una tabla sería excesiva. */
export function ListaPanel({ children }: { children: ReactNode }) {
  return (
    <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-panel">
      {children}
    </ul>
  );
}
