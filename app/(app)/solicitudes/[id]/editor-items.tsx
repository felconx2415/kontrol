"use client";

import Image from "next/image";
import { useActionState, useState } from "react";
import { editarSolicitud, type EstadoFormulario } from "@/actions/solicitudes";
import { ETIQUETA_MOTIVO } from "@/lib/solicitud-estado";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export type ItemEditable = {
  id: string;
  articuloNombre: string;
  articuloCodigo: string;
  categoria: string;
  unidad: string;
  requiereTalla: boolean;
  cantidad: number;
  talla: string | null;
  motivoReemplazo: string | null;
  detalleReemplazo: string | null;
  fotoEvidenciaUrl: string | null;
  entregaAnteriorFecha: string | null;
};

type Borrador = { cantidad: number; talla: string; quitar: boolean };

/**
 * Lista de ítems que el aprobador puede ajustar antes de aprobar.
 *
 * Fuera del modo edición se comporta igual que la vista de solo lectura, para
 * que el resto de los roles vean exactamente lo mismo de siempre.
 */
export default function EditorItems({
  solicitudId,
  items,
  puedeEditar,
}: {
  solicitudId: string;
  items: ItemEditable[];
  puedeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});

  // Al guardar hay que volver a la vista de lectura: el componente cliente
  // conserva su estado tras revalidar, así que no se cierra solo. Se cierra
  // aquí, al resolverse la acción, y no en un efecto sobre `estado`: cerrar el
  // editor es consecuencia del guardado, no de que el estado haya cambiado.
  const [estado, accion] = useActionState<EstadoFormulario, FormData>(
    async (previo, formData) => {
      const resultado = await editarSolicitud(previo, formData);
      if (resultado.ok) setEditando(false);
      return resultado;
    },
    {},
  );

  function abrirEdicion() {
    setBorradores(
      Object.fromEntries(
        items.map((i) => [
          i.id,
          { cantidad: i.cantidad, talla: i.talla ?? "", quitar: false },
        ]),
      ),
    );
    setEditando(true);
  }

  function actualizar(id: string, cambio: Partial<Borrador>) {
    setBorradores((prev) => ({ ...prev, [id]: { ...prev[id], ...cambio } }));
  }

  const quedan = items.filter((i) => !borradores[i.id]?.quitar).length;

  const incompleto = items.some((i) => {
    const b = borradores[i.id];
    if (!b || b.quitar) return false;
    return i.requiereTalla && !b.talla.trim();
  });

  const payload = JSON.stringify(
    items.map((i) => ({
      itemId: i.id,
      cantidad: borradores[i.id]?.cantidad ?? i.cantidad,
      talla: borradores[i.id]?.talla ?? i.talla ?? "",
      quitar: borradores[i.id]?.quitar ?? false,
    })),
  );

  return (
    <section className="rounded-xl border border-borde bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
        <h2 className="titulo-seccion">Ítems solicitados</h2>
        {puedeEditar && !editando && (
          <Boton type="button" variante="secundario" tamano="sm" onClick={abrirEdicion}>
            Ajustar pedido
          </Boton>
        )}
      </header>

      {!editando ? (
        <ul className="divide-y divide-borde">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{item.articuloNombre}</p>
                  <p className="text-xs text-tinta-tenue">
                    {item.articuloCodigo} ·{" "}
                    {item.categoria === "EPP" ? "EPP" : "Equipamiento"}
                    {item.talla ? ` · talla ${item.talla}` : ""}
                  </p>
                </div>
                <p className="text-sm tabular-nums text-tinta-suave">
                  {item.cantidad} {item.unidad}
                  {item.cantidad === 1 ? "" : "s"}
                </p>
              </div>

              {item.motivoReemplazo && (
                <div className="mt-2 rounded-lg bg-panel-suave p-2.5">
                  <p className="text-xs font-medium text-tinta">
                    Motivo: {ETIQUETA_MOTIVO[item.motivoReemplazo]}
                  </p>
                  {item.detalleReemplazo && (
                    <p className="mt-0.5 text-xs text-tinta-suave">
                      {item.detalleReemplazo}
                    </p>
                  )}
                  {item.entregaAnteriorFecha && (
                    <p className="mt-0.5 text-xs text-tinta-tenue">
                      Reemplaza el entregado el {item.entregaAnteriorFecha}
                    </p>
                  )}
                  {item.fotoEvidenciaUrl && (
                    <a
                      href={item.fotoEvidenciaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="foco-anillo mt-2 inline-block rounded-lg"
                    >
                      <Image
                        src={item.fotoEvidenciaUrl}
                        alt={`Evidencia de ${item.articuloNombre}`}
                        width={80}
                        height={80}
                        className="size-20 rounded-lg border border-borde object-cover"
                      />
                    </a>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <form action={accion}>
          <input type="hidden" name="solicitudId" value={solicitudId} />
          <input type="hidden" name="cambios" value={payload} />

          <ul className="divide-y divide-borde">
            {items.map((item) => {
              const b = borradores[item.id];
              const quitado = b?.quitar ?? false;
              return (
                <li
                  key={item.id}
                  className={`px-4 py-3 ${quitado ? "bg-panel-suave" : ""}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p
                        className={`text-sm font-medium ${quitado ? "text-tinta-tenue line-through" : ""}`}
                      >
                        {item.articuloNombre}
                      </p>
                      <p className="text-xs text-tinta-tenue">
                        {item.articuloCodigo} · pedido original: {item.cantidad}{" "}
                        {item.unidad}
                        {item.cantidad === 1 ? "" : "s"}
                        {item.talla ? ` · talla ${item.talla}` : ""}
                      </p>
                    </div>
                    <Boton
                      type="button"
                      variante={quitado ? "secundario" : "peligro"}
                      tamano="sm"
                      onClick={() => actualizar(item.id, { quitar: !quitado })}
                    >
                      {quitado ? "Reponer" : "Quitar"}
                    </Boton>
                  </div>

                  {!quitado && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Campo etiqueta="Cantidad" htmlFor={`cant-${item.id}`}>
                        <Entrada
                          id={`cant-${item.id}`}
                          type="number"
                          min={1}
                          value={b?.cantidad ?? item.cantidad}
                          onChange={(e) =>
                            actualizar(item.id, {
                              cantidad: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                      </Campo>

                      {item.requiereTalla && (
                        <Campo etiqueta="Talla" htmlFor={`talla-${item.id}`} requerido>
                          <Entrada
                            id={`talla-${item.id}`}
                            type="text"
                            value={b?.talla ?? ""}
                            onChange={(e) =>
                              actualizar(item.id, { talla: e.target.value })
                            }
                            placeholder="Ej: 42, M, L"
                          />
                        </Campo>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 border-t border-borde p-4">
            {quedan === 0 && (
              <Aviso tono="espera">
                Debe quedar al menos un ítem. Si no corresponde nada del pedido,
                usa Rechazar en vez de vaciarlo.
              </Aviso>
            )}
            {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

            <div className="flex flex-wrap justify-end gap-2">
              <Boton
                type="button"
                variante="secundario"
                onClick={() => setEditando(false)}
              >
                Cancelar
              </Boton>
              <Boton
                type="submit"
                disabled={quedan === 0 || incompleto}
                textoPendiente="Guardando…"
              >
                Guardar cambios
              </Boton>
            </div>
          </div>
        </form>
      )}
    </section>
  );
}
