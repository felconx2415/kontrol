"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import {
  editarSolicitud,
  type EstadoFormulario,
  type ItemAgregado,
} from "@/actions/solicitudes";
import { ETIQUETA_MOTIVO, motivosDe } from "@/lib/solicitud-estado";
import { cantidadConUnidad } from "@/lib/unidades";
import { normalizar } from "@/lib/busqueda";
import Boton from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import BuscadorArticulo, { type OpcionBuscador } from "@/components/buscador-articulo";
import type { Motivo } from "@/generated/prisma/enums";

export type ItemEditable = {
  id: string;
  articuloNombre: string;
  articuloCodigo: string;
  categoria: string;
  unidad: string;
  cantidad: number;
  cantidadRecibida: number | null;
  /** Reserva del almacén con que se pide esta línea, cuando ya se registró. */
  numeroReserva: string | null;
  posicionReserva: string | null;
  motivo: string | null;
  detalleReemplazo: string | null;
  fotoEvidenciaUrl: string | null;
  entregaAnteriorFecha: string | null;
  /** Lo que salió de verdad por esta línea, una vez entregada. */
  entregado: {
    cantidad: number;
    numeroSerie: string | null;
    venceEnTexto: string | null;
  } | null;
};

type Borrador = { cantidad: number; quitar: boolean };

/** Artículo del catálogo que se puede sumar a un pedido NUEVO. */
export type ArticuloAgregable = { id: string; nombre: string; codigo: string };

/** Ítem entregado a la persona que se puede sumar a un REEMPLAZO. */
export type ReemplazableAgregable = {
  /** Id del EntregaItem que se viene a reemplazar. */
  id: string;
  nombre: string;
  codigo: string;
  entregadoEnTexto: string;
};

/** Línea agregada en el borrador, antes de guardar. */
type Nuevo = {
  /** Id del artículo (NUEVO) o del ítem entregado (REEMPLAZO). */
  origenId: string;
  nombre: string;
  codigo: string;
  cantidad: number;
  motivo: Motivo | "";
  detalle: string;
};

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
  tipo,
  esDueno,
  catalogo,
  reemplazables,
}: {
  solicitudId: string;
  items: ItemEditable[];
  puedeEditar: boolean;
  tipo: "NUEVO" | "REEMPLAZO";
  /** Quien edita es el propio solicitante: cambia el texto, no las reglas. */
  esDueno: boolean;
  catalogo: ArticuloAgregable[];
  reemplazables: ReemplazableAgregable[];
}) {
  const [editando, setEditando] = useState(false);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [nuevos, setNuevos] = useState<Nuevo[]>([]);
  const motivos = motivosDe(tipo);

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
        items.map((i) => [i.id, { cantidad: i.cantidad, quitar: false }]),
      ),
    );
    setNuevos([]);
    setEditando(true);
  }

  function actualizar(id: string, cambio: Partial<Borrador>) {
    setBorradores((prev) => ({ ...prev, [id]: { ...prev[id], ...cambio } }));
  }

  function actualizarNuevo(origenId: string, cambio: Partial<Nuevo>) {
    setNuevos((prev) =>
      prev.map((n) => (n.origenId === origenId ? { ...n, ...cambio } : n)),
    );
  }

  // Lo que ya está en el pedido no se ofrece: en un pedido nuevo se ajusta su
  // cantidad, y en un reemplazo cada ítem entregado se reemplaza una sola vez.
  const opciones: OpcionBuscador[] = useMemo(() => {
    const elegidos = new Set(nuevos.map((n) => n.origenId));
    if (tipo === "NUEVO") {
      const enPedido = new Set(items.map((i) => i.articuloCodigo));
      return catalogo
        .filter((a) => !elegidos.has(a.id) && !enPedido.has(a.codigo))
        .map((a) => ({
          id: a.id,
          principal: a.nombre,
          secundario: a.codigo,
          buscable: normalizar(`${a.nombre} ${a.codigo}`),
        }));
    }
    return reemplazables
      .filter((r) => !elegidos.has(r.id))
      .map((r) => ({
        id: r.id,
        principal: r.nombre,
        secundario: `entregado el ${r.entregadoEnTexto}`,
        buscable: normalizar(`${r.nombre} ${r.codigo}`),
      }));
  }, [tipo, catalogo, reemplazables, items, nuevos]);

  function agregar(origenId: string) {
    const fuente =
      tipo === "NUEVO"
        ? catalogo.find((a) => a.id === origenId)
        : reemplazables.find((r) => r.id === origenId);
    if (!fuente) return;
    setNuevos((prev) => [
      ...prev,
      {
        origenId,
        nombre: fuente.nombre,
        codigo: fuente.codigo,
        cantidad: 1,
        // Con un solo motivo posible no hay nada que elegir.
        motivo: motivos.length === 1 ? motivos[0] : "",
        detalle: "",
      },
    ]);
  }

  const quedan =
    items.filter((i) => !borradores[i.id]?.quitar).length + nuevos.length;
  const faltaMotivo = nuevos.some((n) => n.motivo === "");

  const payload = JSON.stringify(
    items.map((i) => ({
      itemId: i.id,
      cantidad: borradores[i.id]?.cantidad ?? i.cantidad,
      quitar: borradores[i.id]?.quitar ?? false,
    })),
  );

  const payloadNuevos = JSON.stringify(
    nuevos.map(
      (n): ItemAgregado => ({
        articuloId: tipo === "NUEVO" ? n.origenId : null,
        entregaAnteriorItemId: tipo === "REEMPLAZO" ? n.origenId : null,
        cantidad: n.cantidad,
        motivo: n.motivo,
        detalleReemplazo: tipo === "REEMPLAZO" ? n.detalle : null,
      }),
    ),
  );

  return (
    <section className="rounded-2xl border border-borde bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-borde px-4 py-3">
        <h2 className="titulo-seccion">Ítems solicitados</h2>
        {puedeEditar && !editando && (
          <Boton type="button" variante="secundario" tamano="sm" onClick={abrirEdicion}>
            {esDueno ? "Editar o agregar ítems" : "Ajustar pedido"}
          </Boton>
        )}
      </header>

      {!editando ? (
        <ul className="divide-y divide-borde">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              {/* Sin `flex-wrap`: un nombre largo empujaba la cantidad a su
                  propia línea en unos ítems y no en otros, y la columna de
                  cifras quedaba en zigzag. Ahora el nombre se ajusta dentro de
                  su propio ancho y la cantidad no se mueve. */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.articuloNombre}</p>
                  <p className="text-xs text-tinta-tenue">
                    {item.articuloCodigo} ·{" "}
                    {item.categoria === "EPP" ? "EPP" : "Equipamiento"}
                  </p>
                  {item.numeroReserva && (
                    <p className="text-xs tabular-nums text-tinta-suave">
                      Reserva {item.numeroReserva}
                      {item.posicionReserva
                        ? ` · pos. ${item.posicionReserva}`
                        : ""}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm tabular-nums text-tinta-suave">
                    {cantidadConUnidad(item.cantidad, item.unidad)}
                  </p>
                  {/* Que del almacén llegara menos de lo pedido hay que verlo
                      **antes** de firmar, no descubrirlo entregando. Si llegó
                      todo no se dice nada: repetir la misma cifra solo estorba. */}
                  {item.cantidadRecibida !== null &&
                    item.cantidadRecibida !== item.cantidad && (
                      <p className="text-xs font-medium tabular-nums text-espera">
                        llegaron {item.cantidadRecibida} de {item.cantidad}
                      </p>
                    )}
                </div>
              </div>

              {/* Lo entregado, con su serie y vencimiento. Antes había que abrir
                  el PDF del acta para saber qué se le dio exactamente a alguien
                  y hasta cuándo le sirve. */}
              {item.entregado && (
                <p className="mt-1.5 text-xs text-exito">
                  Entregado:{" "}
                  {cantidadConUnidad(item.entregado.cantidad, item.unidad)}
                  {item.entregado.numeroSerie
                    ? ` · serie ${item.entregado.numeroSerie}`
                    : ""}
                  {item.entregado.venceEnTexto
                    ? ` · vence ${item.entregado.venceEnTexto}`
                    : ""}
                </p>
              )}

              {/* La cadena de reemplazo sale de la caja del motivo: dice qué
                  ítem viene a sustituir esta línea, y eso es del pedido, no de
                  la justificación. */}
              {item.entregaAnteriorFecha && (
                <p className="mt-1 text-xs text-tinta-suave">
                  Reemplaza lo entregado el {item.entregaAnteriorFecha}
                </p>
              )}

              {item.motivo && (
                <div className="mt-1">
                  <p className="text-xs text-tinta-suave">
                    Motivo:{" "}
                    <span className="text-tinta">
                      {ETIQUETA_MOTIVO[item.motivo as keyof typeof ETIQUETA_MOTIVO]}
                    </span>
                  </p>
                  {item.detalleReemplazo && (
                    <p className="mt-0.5 text-xs text-tinta-suave">
                      {item.detalleReemplazo}
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
          <input type="hidden" name="nuevos" value={payloadNuevos} />

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
                        {item.articuloCodigo} · pedido original:{" "}
                        {cantidadConUnidad(item.cantidad, item.unidad)}
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
                    </div>
                  )}
                </li>
              );
            })}
            {nuevos.map((n) => (
              <li key={n.origenId} className="bg-marca-50/40 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {n.nombre}{" "}
                      <span className="rounded bg-marca-100 px-1.5 py-0.5 text-xs font-medium text-marca-700">
                        Nuevo
                      </span>
                    </p>
                    <p className="text-xs text-tinta-tenue">{n.codigo}</p>
                  </div>
                  <Boton
                    type="button"
                    variante="peligro"
                    tamano="sm"
                    onClick={() =>
                      setNuevos((prev) => prev.filter((x) => x.origenId !== n.origenId))
                    }
                  >
                    Quitar
                  </Boton>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Campo etiqueta="Cantidad" htmlFor={`cant-nuevo-${n.origenId}`}>
                    <Entrada
                      id={`cant-nuevo-${n.origenId}`}
                      type="number"
                      min={1}
                      value={n.cantidad}
                      onChange={(e) =>
                        actualizarNuevo(n.origenId, {
                          cantidad: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </Campo>
                  <Campo
                    etiqueta="Motivo"
                    htmlFor={`motivo-nuevo-${n.origenId}`}
                    requerido
                  >
                    <Seleccion
                      id={`motivo-nuevo-${n.origenId}`}
                      value={n.motivo}
                      onChange={(e) =>
                        actualizarNuevo(n.origenId, {
                          motivo: e.target.value as Motivo | "",
                        })
                      }
                    >
                      <option value="">Elige un motivo…</option>
                      {motivos.map((m) => (
                        <option key={m} value={m}>
                          {ETIQUETA_MOTIVO[m]}
                        </option>
                      ))}
                    </Seleccion>
                  </Campo>
                  {tipo === "REEMPLAZO" && (
                    <Campo
                      etiqueta="Detalle (opcional)"
                      htmlFor={`detalle-nuevo-${n.origenId}`}
                      className="sm:col-span-2"
                    >
                      <AreaTexto
                        id={`detalle-nuevo-${n.origenId}`}
                        rows={2}
                        maxLength={500}
                        value={n.detalle}
                        onChange={(e) =>
                          actualizarNuevo(n.origenId, { detalle: e.target.value })
                        }
                      />
                    </Campo>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Agregar va debajo de lo que ya hay: primero se revisa el pedido y
              después se completa. */}
          <div className="border-t border-borde p-4">
            {opciones.length > 0 ? (
              <BuscadorArticulo
                opciones={opciones}
                etiqueta={
                  tipo === "NUEVO"
                    ? "Agregar un artículo del catálogo"
                    : "Agregar otro ítem a reemplazar"
                }
                placeholder={
                  tipo === "NUEVO"
                    ? "Busca por nombre o código y toca para agregar…"
                    : "Busca entre el equipamiento entregado…"
                }
                onElegir={agregar}
              />
            ) : (
              <p className="text-sm text-tinta-tenue">
                {tipo === "NUEVO"
                  ? "No quedan artículos del catálogo por agregar."
                  : "No hay más equipamiento entregado que se pueda reemplazar."}
              </p>
            )}
          </div>

          <div className="space-y-3 border-t border-borde p-4">
            {faltaMotivo && (
              <Aviso tono="espera">
                Elige el motivo de cada ítem agregado antes de guardar.
              </Aviso>
            )}
            {quedan === 0 && (
              <Aviso tono="espera">
                {esDueno
                  ? "Debe quedar al menos un ítem. Si ya no necesitas nada, cancela la solicitud en vez de vaciarla."
                  : "Debe quedar al menos un ítem. Si no corresponde nada del pedido, usa Rechazar en vez de vaciarlo."}
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
                disabled={quedan === 0 || faltaMotivo}
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
