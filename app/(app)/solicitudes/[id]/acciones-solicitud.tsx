"use client";

import { useState } from "react";
import { accionCambiarEstado } from "@/actions/solicitudes";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import type { EstadoSolicitud } from "@/generated/prisma/enums";

type Accion = { hacia: EstadoSolicitud; texto: string };

export default function AccionesSolicitud({
  solicitudId,
  acciones,
  puedeEntregar,
}: {
  solicitudId: string;
  acciones: Accion[];
  puedeEntregar: boolean;
}) {
  const [rechazando, setRechazando] = useState(false);

  return (
    <section className="no-print space-y-3 rounded-xl border border-borde bg-panel p-4">
      <h2 className="titulo-seccion">Acciones</h2>

      {puedeEntregar && (
        <BotonEnlace href={`/solicitudes/${solicitudId}/entrega`} bloque>
          Entregar y firmar
        </BotonEnlace>
      )}

      {acciones.map((accion) => {
        if (accion.hacia === "ENTREGADA") return null;

        if (accion.hacia === "RECHAZADA") {
          return (
            <div key={accion.hacia}>
              {rechazando ? (
                <form action={accionCambiarEstado} className="space-y-2">
                  <input type="hidden" name="solicitudId" value={solicitudId} />
                  <input type="hidden" name="nuevoEstado" value="RECHAZADA" />
                  <Campo
                    etiqueta="Motivo del rechazo"
                    htmlFor="motivoRechazo"
                    requerido
                  >
                    <AreaTexto
                      id="motivoRechazo"
                      name="motivoRechazo"
                      rows={3}
                      required
                      autoFocus
                    />
                  </Campo>
                  <Boton
                    type="submit"
                    variante="peligro"
                    bloque
                    textoPendiente="Guardando…"
                  >
                    Confirmar rechazo
                  </Boton>
                  <Boton
                    type="button"
                    variante="fantasma"
                    tamano="sm"
                    bloque
                    onClick={() => setRechazando(false)}
                  >
                    Cancelar
                  </Boton>
                </form>
              ) : (
                <Boton
                  type="button"
                  variante="peligro"
                  bloque
                  onClick={() => setRechazando(true)}
                >
                  Rechazar
                </Boton>
              )}
            </div>
          );
        }

        if (accion.hacia === "EN_GESTION") {
          return (
            <form key={accion.hacia} action={accionCambiarEstado} className="space-y-2">
              <input type="hidden" name="solicitudId" value={solicitudId} />
              <input type="hidden" name="nuevoEstado" value="EN_GESTION" />
              <Campo
                etiqueta="N.º de pedido al almacén (opcional)"
                htmlFor="pedidoExternoRef"
              >
                <Entrada
                  id="pedidoExternoRef"
                  type="text"
                  name="pedidoExternoRef"
                  placeholder="Ej: OC-2026-0431"
                />
              </Campo>
              <Boton type="submit" bloque textoPendiente="Guardando…">
                {accion.texto}
              </Boton>
            </form>
          );
        }

        return (
          <form key={accion.hacia} action={accionCambiarEstado}>
            <input type="hidden" name="solicitudId" value={solicitudId} />
            <input type="hidden" name="nuevoEstado" value={accion.hacia} />
            <Boton
              type="submit"
              variante={accion.hacia === "CANCELADA" ? "secundario" : "primario"}
              bloque
              textoPendiente="Guardando…"
            >
              {accion.texto}
            </Boton>
          </form>
        );
      })}
    </section>
  );
}
