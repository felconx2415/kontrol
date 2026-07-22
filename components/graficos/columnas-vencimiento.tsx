import type { BarraMes } from "@/lib/metricas";

/**
 * Cuántos EPP hay que cambiar por mes.
 *
 * Una sola serie sobre un eje temporal, así que no lleva leyenda: el título
 * la nombra. La urgencia la da la posición en el tiempo, no el color; el
 * tramo "Vencido" se distingue además con trama y etiqueta, nunca solo color.
 */
export default function ColumnasVencimiento({ datos }: { datos: BarraMes[] }) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const total = datos.reduce((n, d) => n + d.valor, 0);

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-tinta-tenue">
        Ningún EPP vence en los próximos 6 meses.
      </p>
    );
  }

  return (
    <figure>
      {/* h-full en cada columna: sin eso el contenedor de la barra no tiene
          espacio donde crecer y las barras salen con altura cero. */}
      <div className="flex h-44 gap-2" role="img" aria-label="Cambios de EPP previstos por mes">
        {datos.map((d) => {
          const alto = d.valor === 0 ? 0 : Math.max((d.valor / maximo) * 100, 6);
          return (
            <div key={d.clave} className="flex h-full flex-1 flex-col items-center gap-1">
              {/* Etiqueta directa: evita tener que leer el valor contra una grilla. */}
              <span
                className={`text-xs tabular-nums ${
                  d.valor === 0 ? "text-tinta-tenue" : "font-semibold text-tinta"
                }`}
              >
                {d.valor}
              </span>
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  title={`${d.etiqueta}: ${d.valor} ítem${d.valor === 1 ? "" : "s"}`}
                  style={{ height: `${alto}%` }}
                  className={`w-full max-w-14 rounded-t ${
                    d.vencido
                      ? "bg-marca-800 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,0.28)_3px,rgba(255,255,255,0.28)_5px)]"
                      : "bg-marca-500"
                  }`}
                />
              </div>
              <span
                className={`w-full truncate text-center text-xs ${
                  d.vencido ? "font-medium text-tinta" : "text-tinta-tenue"
                }`}
              >
                {d.etiqueta}
              </span>
            </div>
          );
        })}
      </div>

      <figcaption className="mt-3 flex items-center gap-4 border-t border-borde pt-2 text-xs text-tinta-tenue">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-marca-800 [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.35)_2px,rgba(255,255,255,0.35)_4px)]" />
          Ya vencido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-marca-500" />
          Vence en el mes
        </span>
      </figcaption>
    </figure>
  );
}
