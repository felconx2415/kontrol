"use client";

import { useState } from "react";
import { accionCambiarEstado, accionMarcarRecibida } from "@/actions/solicitudes";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import type { EstadoSolicitud } from "@/generated/prisma/enums";

type Accion = { hacia: EstadoSolicitud; texto: string };

type ItemRecepcion = {
  id: string;
  nombre: string;
  codigo: string;
  unidad: string;
  cantidad: number;
};

/** Formulario que se despliega al marcar recibida: cuánto llegó de cada ítem. */
function FormularioRecepcion({
  solicitudId,
  items,
  texto,
}: {
  solicitudId: string;
  items: ItemRecepcion[];
  texto: string;
}) {
  const [abierto, setAbierto] = useState(false);
  // Cantidad recibida por ítem; por defecto se recibió todo lo pedido.
  const [recibido, setRecibido] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.cantidad])),
  );

  if (!abierto) {
    return (
      <Boton type="button" bloque onClick={() => setAbierto(true)}>
        {texto}
      </Boton>
    );
  }

  const payload = JSON.stringify(
    items.map((i) => ({ itemId: i.id, cantidadRecibida: recibido[i.id] ?? 0 })),
  );

  return (
    <form action={accionMarcarRecibida} className="space-y-3">
      <input type="hidden" name="solicitudId" value={solicitudId} />
      <input type="hidden" name="recepcion" value={payload} />

      <p className="text-sm text-tinta-suave">
        Confirma cuánto llegó de cada ítem. Si no llegó todo, ajusta la cantidad.
      </p>

      <ul className="divide-y divide-borde rounded-lg border border-borde">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.nombre}</p>
              <p className="text-xs text-tinta-tenue">
                {item.codigo} · pedido: {item.cantidad}
              </p>
            </div>
            <label className="flex items-center gap-2">
              <span className="text-xs text-tinta-suave">Recibido</span>
              <Entrada
                type="number"
                min={0}
                max={item.cantidad}
                value={recibido[item.id] ?? 0}
                onChange={(e) => {
                  const n = Math.max(
                    0,
                    Math.min(item.cantidad, Math.trunc(Number(e.target.value) || 0)),
                  );
                  setRecibido((prev) => ({ ...prev, [item.id]: n }));
                }}
                className="w-20 tabular-nums"
              />
            </label>
          </li>
        ))}
      </ul>

      <Boton type="submit" bloque textoPendiente="Guardando…">
        Confirmar recepción
      </Boton>
      <Boton
        type="button"
        variante="fantasma"
        tamano="sm"
        bloque
        onClick={() => setAbierto(false)}
      >
        Cancelar
      </Boton>
    </form>
  );
}

export default function AccionesSolicitud({
  solicitudId,
  acciones,
  puedeEntregar,
  items,
}: {
  solicitudId: string;
  acciones: Accion[];
  puedeEntregar: boolean;
  items: ItemRecepcion[];
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

        if (accion.hacia === "RECIBIDA") {
          return (
            <FormularioRecepcion
              key={accion.hacia}
              solicitudId={solicitudId}
              items={items}
              texto={accion.texto}
            />
          );
        }

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
