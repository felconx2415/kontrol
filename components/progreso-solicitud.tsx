import type { EstadoSolicitud } from "@/generated/prisma/enums";
import {
  ESPERA_DEL_SOLICITANTE,
  ETIQUETA_ESTADO,
  pasoDeSolicitud,
} from "@/lib/solicitud-estado";

/**
 * En qué paso va la solicitud, para quien la espera.
 *
 * La insignia de estado dice cómo se llama la etapa; esto dice cuánto falta.
 * Son cosas distintas: «En gestión con el almacén» no le indica a un brigadista
 * si va por la mitad o casi termina, y esa es justamente su pregunta.
 *
 * Un flujo cortado (rechazo, cancelación) no dibuja barra: mostrar «paso 2 de
 * 5» cuando ya no habrá paso 3 sugeriría un avance que no va a ocurrir.
 */
export default function ProgresoSolicitud({
  estado,
  compacto = false,
}: {
  estado: EstadoSolicitud;
  /** Solo la línea de texto, para filas de listado donde no cabe la barra. */
  compacto?: boolean;
}) {
  const { paso, total, completado, interrumpido } = pasoDeSolicitud(estado);
  const explicacion = ESPERA_DEL_SOLICITANTE[estado];

  if (interrumpido || paso === 0) {
    return (
      <p className="text-xs text-tinta-tenue">
        {ETIQUETA_ESTADO[estado]} · {explicacion}
      </p>
    );
  }

  const resumen = completado
    ? "Completada"
    : `Paso ${paso} de ${total} · ${ETIQUETA_ESTADO[estado]}`;

  return (
    <div className={compacto ? "" : "space-y-2"}>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`${resumen}. ${explicacion}`}
      >
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < paso
                ? completado
                  ? "bg-exito"
                  : "bg-marca-600"
                : "bg-borde"
            }`}
          />
        ))}
      </div>

      {/* El texto repite lo que la barra ya dice para quien no distingue el
          relleno; por eso la barra es aria-hidden de facto (role img con label
          propio) y esta línea queda como refuerzo visual, no como lectura
          duplicada. */}
      <p aria-hidden="true" className="text-xs text-tinta-tenue">
        <span className="font-medium text-tinta-suave">{resumen}</span>
        {compacto ? "" : ` · ${explicacion}`}
      </p>
    </div>
  );
}
