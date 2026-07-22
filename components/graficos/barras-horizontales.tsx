import Link from "next/link";

export type DatoBarra = {
  clave: string;
  etiqueta: string;
  valor: number;
  /** Texto secundario a la derecha del valor (contexto, no otra medida). */
  nota?: string | null;
  href?: string;
  destacar?: boolean;
};

/**
 * Barras horizontales para comparar magnitud entre etapas.
 *
 * Rampa secuencial de un solo tono (más es más oscuro), no colores por
 * categoría: las etapas son una escala ordenada, no identidades distintas.
 */
export default function BarrasHorizontales({
  datos,
  totalEtiqueta,
}: {
  datos: DatoBarra[];
  totalEtiqueta?: string;
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const total = datos.reduce((n, d) => n + d.valor, 0);

  // Pasos de la rampa de marca: el extremo alto es más oscuro.
  const PASOS = ["bg-marca-300", "bg-marca-400", "bg-marca-500", "bg-marca-600"];

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-tinta-tenue">
        No hay solicitudes en curso.
      </p>
    );
  }

  return (
    <div>
      <ul className="space-y-2.5">
        {datos.map((d, i) => {
          const ancho = (d.valor / maximo) * 100;
          const contenido = (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-tinta">{d.etiqueta}</span>
                <span className="flex items-baseline gap-2">
                  {d.nota && (
                    <span className="text-xs text-tinta-tenue">{d.nota}</span>
                  )}
                  <span className="text-sm font-semibold tabular-nums text-tinta">
                    {d.valor}
                  </span>
                </span>
              </div>
              {/* Riel recesivo + marca fina anclada a la línea base. */}
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-lienzo">
                <div
                  className={`h-full rounded-full ${PASOS[i % PASOS.length]} ${
                    d.destacar ? "ring-2 ring-inset ring-marca-700" : ""
                  }`}
                  style={{ width: `${Math.max(ancho, d.valor > 0 ? 4 : 0)}%` }}
                />
              </div>
            </>
          );

          return (
            <li key={d.clave}>
              {d.href ? (
                <Link
                  href={d.href}
                  title={`${d.etiqueta}: ${d.valor}`}
                  className="foco-anillo block rounded-lg px-1 py-1 transition-colors duration-150 hover:bg-panel-suave"
                >
                  {contenido}
                </Link>
              ) : (
                <div className="px-1 py-1">{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>

      {totalEtiqueta && (
        <p className="mt-3 border-t border-borde pt-2 text-xs text-tinta-tenue">
          {totalEtiqueta}: <span className="tabular-nums text-tinta">{total}</span>
        </p>
      )}
    </div>
  );
}
