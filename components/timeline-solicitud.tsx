import { formatearFechaHora } from "@/lib/vencimientos";

export type HitoTimeline = {
  clave: string;
  titulo: string;
  fecha: Date | null;
  responsable: string | null;
  /** Texto de contexto bajo el hito (referencia de pedido, motivo de rechazo). */
  nota?: string | null;
  /** Lista de cambios concretos, para los ajustes del pedido. */
  detalles?: string[] | null;
  /**
   * Evento puntual en vez de etapa del flujo: no ocupa lugar como "pendiente",
   * solo aparece si realmente ocurrió.
   */
  evento?: boolean;
  /** Desenlace negativo: rechazo o cancelación. */
  alerta?: boolean;
};

export default function TimelineSolicitud({
  hitos,
  interrumpido = false,
}: {
  hitos: HitoTimeline[];
  /** Si el flujo se cortó, los pasos que ya nunca ocurrirán no se listan. */
  interrumpido?: boolean;
}) {
  const visibles = hitos.filter((h) => {
    if (h.evento) return h.fecha !== null;
    if (interrumpido) return h.fecha !== null;
    return true;
  });

  return (
    <ol className="space-y-0">
      {visibles.map((paso, indice) => {
        const cumplido = paso.fecha !== null;
        const esUltimo = indice === visibles.length - 1;

        return (
          <li key={paso.clave} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-2 ${
                  paso.alerta
                    ? "bg-fallo ring-fallo-fondo"
                    : paso.evento
                      ? "bg-espera ring-espera-fondo"
                      : cumplido
                        ? "bg-exito ring-exito-fondo"
                        : "bg-borde-fuerte ring-lienzo"
                }`}
              >
                {paso.alerta ? (
                  <svg viewBox="0 0 12 12" className="size-3 fill-white" aria-hidden="true">
                    <path d="M9.53 1.06 6 4.59 2.47 1.06 1.06 2.47 4.59 6 1.06 9.53l1.41 1.41L6 7.41l3.53 3.53 1.41-1.41L7.41 6l3.53-3.53z" />
                  </svg>
                ) : paso.evento ? (
                  <svg viewBox="0 0 12 12" className="size-3 fill-white" aria-hidden="true">
                    <path d="M1 7.5 7.6 1l3.4 3.4L4.4 11H1V7.5Z" />
                  </svg>
                ) : cumplido ? (
                  <svg viewBox="0 0 12 12" className="size-3 fill-white" aria-hidden="true">
                    <path d="M10.28 2.28 4.5 8.06 1.72 5.28.28 6.72l4.22 4.22 7.22-7.22z" />
                  </svg>
                ) : null}
              </span>
              {!esUltimo && (
                <span
                  className={`w-0.5 flex-1 ${cumplido ? "bg-exito-borde" : "bg-borde"}`}
                />
              )}
            </div>

            <div className={esUltimo ? "pb-0" : "pb-5"}>
              <p
                className={`text-sm ${cumplido ? "font-medium text-tinta" : "text-tinta-suave"}`}
              >
                {paso.titulo}
              </p>
              {cumplido ? (
                <p className="text-xs text-tinta-tenue">
                  {formatearFechaHora(paso.fecha)}
                  {paso.responsable ? ` · ${paso.responsable}` : ""}
                </p>
              ) : (
                <p className="text-xs text-tinta-tenue">Pendiente</p>
              )}

              {paso.nota && (
                <p className="mt-1 rounded-lg bg-panel-suave px-2.5 py-1.5 text-xs text-tinta-suave">
                  {paso.nota}
                </p>
              )}

              {paso.detalles && paso.detalles.length > 0 && (
                <ul className="mt-1 space-y-0.5 rounded-lg bg-espera-fondo px-2.5 py-1.5">
                  {paso.detalles.map((d, i) => (
                    <li key={i} className="text-xs text-espera">
                      {d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
