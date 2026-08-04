"use client";

import { useState } from "react";
import { accionCambiarEstado, accionMarcarRecibida } from "@/actions/solicitudes";
import Boton, { BotonEnlace } from "@/components/ui/boton";
import { AreaTexto, Campo, Entrada } from "@/components/ui/campo";
import {
  CECO_ALMACEN,
  llevaPosicion,
  posicionesSecuenciales,
} from "@/lib/solicitud-estado";
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
      {/* «Volver» y no «Cancelar»: justo debajo está el botón que cancela la
          solicitud entera, y dos rótulos iguales con consecuencias opuestas
          son una trampa. */}
      <Boton
        type="button"
        variante="fantasma"
        tamano="sm"
        bloque
        onClick={() => setAbierto(false)}
      >
        Volver
      </Boton>
    </form>
  );
}

export type LineaReservaUI = {
  id: string;
  nombre: string;
  codigo: string;
  ceco: string;
  cantidad: number;
  numeroReserva: string | null;
  posicionReserva: string | null;
};

type DatosReserva = { numeroReserva: string; posicionReserva: string };

/**
 * Registro de la reserva, línea por línea.
 *
 * Va por línea y no por solicitud porque una solicitud puede mezclar los dos
 * orígenes de reserva, y cada uno tiene su número. Por eso el número se pide
 * una vez por CECO y baja a todas sus líneas: es lo que se teclea de verdad, y
 * corregir una línea suelta sigue siendo posible. La posición solo aparece en
 * el CECO que la usa.
 */
function FormularioReserva({
  solicitudId,
  lineas,
  texto,
  variante = "primario",
}: {
  solicitudId: string;
  lineas: LineaReservaUI[];
  texto: string;
  variante?: "primario" | "secundario";
}) {
  const [abierto, setAbierto] = useState(false);

  // Un grupo por CECO, en el orden en que aparecen las líneas: cada CECO es una
  // reserva distinta.
  const grupos = [...new Set(lineas.map((l) => l.ceco))].map((ceco) => ({
    ceco,
    conPosicion: llevaPosicion(ceco),
    lineas: lineas.filter((l) => l.ceco === ceco),
  }));

  const [datos, setDatos] = useState<Record<string, DatosReserva>>(() => {
    const inicial: Record<string, DatosReserva> = {};
    for (const grupo of grupos) {
      // Las posiciones se numeran dentro de cada reserva, así que el correlativo
      // vuelve a empezar en cada CECO.
      const posiciones = posicionesSecuenciales(grupo.lineas.length);
      grupo.lineas.forEach((linea, i) => {
        inicial[linea.id] = {
          numeroReserva: linea.numeroReserva ?? "",
          posicionReserva: grupo.conPosicion
            ? (linea.posicionReserva ?? posiciones[i])
            : "",
        };
      });
    }
    return inicial;
  });

  function fijar(id: string, campo: keyof DatosReserva, valor: string) {
    setDatos((prev) => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  }

  /** El número de reserva es uno por CECO: se teclea arriba y baja a todas. */
  function fijarGrupo(grupo: (typeof grupos)[number], valor: string) {
    setDatos((prev) => {
      const siguiente = { ...prev };
      for (const linea of grupo.lineas) {
        siguiente[linea.id] = { ...prev[linea.id], numeroReserva: valor };
      }
      return siguiente;
    });
  }

  if (!abierto) {
    return (
      <Boton
        type="button"
        variante={variante}
        bloque
        onClick={() => setAbierto(true)}
      >
        {texto}
      </Boton>
    );
  }

  const payload = JSON.stringify(
    lineas.map((l) => ({
      itemId: l.id,
      numeroReserva: datos[l.id]?.numeroReserva ?? "",
      posicionReserva: datos[l.id]?.posicionReserva ?? "",
    })),
  );

  return (
    <form action={accionCambiarEstado} className="space-y-3">
      <input type="hidden" name="solicitudId" value={solicitudId} />
      <input type="hidden" name="nuevoEstado" value="EN_GESTION" />
      <input type="hidden" name="reservas" value={payload} />

      <p className="text-sm text-tinta-suave">
        Registra la reserva con que se pide cada línea.
      </p>

      {grupos.map((grupo) => {
        // Todas las líneas del grupo comparten número, salvo que se edite una.
        const numeros = new Set(
          grupo.lineas.map((l) => datos[l.id]?.numeroReserva ?? ""),
        );
        const comun = numeros.size === 1 ? [...numeros][0] : "";

        return (
          <div
            key={grupo.ceco}
            className="space-y-3 rounded-lg border border-borde p-3"
          >
            <Campo
              etiqueta={`N.º de reserva · CECO ${grupo.ceco}`}
              htmlFor={`reserva-${grupo.ceco}`}
              requerido
            >
              <Entrada
                id={`reserva-${grupo.ceco}`}
                type="text"
                value={comun}
                onChange={(e) => fijarGrupo(grupo, e.target.value)}
                placeholder="Ej: 4500912345"
                required
              />
            </Campo>

            <ul className="divide-y divide-borde">
              {grupo.lineas.map((linea) => (
                <li key={linea.id} className="space-y-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{linea.nombre}</p>
                    <p className="text-xs text-tinta-tenue">
                      {linea.codigo} · {linea.cantidad}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2">
                      <span className="text-xs text-tinta-suave">Reserva</span>
                      <Entrada
                        type="text"
                        value={datos[linea.id]?.numeroReserva ?? ""}
                        onChange={(e) =>
                          fijar(linea.id, "numeroReserva", e.target.value)
                        }
                        aria-label={`N.º de reserva de ${linea.nombre}`}
                        required
                        className="w-36 tabular-nums"
                      />
                    </label>
                    {/* La reserva del almacén llega sin posición: el campo solo
                        aparece donde la reserva la crea el gestor. */}
                    {grupo.conPosicion && (
                      <label className="flex items-center gap-2">
                        <span className="text-xs text-tinta-suave">Posición</span>
                        <Entrada
                          type="text"
                          value={datos[linea.id]?.posicionReserva ?? ""}
                          onChange={(e) =>
                            fijar(linea.id, "posicionReserva", e.target.value)
                          }
                          aria-label={`Posición de ${linea.nombre} en la reserva`}
                          required
                          className="w-24 tabular-nums"
                        />
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <Boton type="submit" bloque textoPendiente="Guardando…">
        {texto}
      </Boton>
      <Boton
        type="button"
        variante="fantasma"
        tamano="sm"
        bloque
        onClick={() => setAbierto(false)}
      >
        Volver
      </Boton>
    </form>
  );
}

export default function AccionesSolicitud({
  solicitudId,
  acciones,
  puedeEntregar,
  retiroPropio,
  items,
  lineasReserva,
}: {
  solicitudId: string;
  acciones: Accion[];
  puedeEntregar: boolean;
  /** Quien mira es el beneficiario retirando lo suyo, no gestión entregándolo. */
  retiroPropio: boolean;
  items: ItemRecepcion[];
  /** Líneas que salen del almacén interno; son las que llevan reserva. */
  lineasReserva: LineaReservaUI[];
}) {
  const [rechazando, setRechazando] = useState(false);

  // Solo la reserva del almacén se pide y se espera; la que crea el gestor no.
  const hayQuePedirReserva = lineasReserva.some((l) => l.ceco === CECO_ALMACEN);
  // Cuando hay que pedirla, ese es el paso natural y registrarla al tiro es la
  // excepción (ya la tenía a mano), así que baja a acción secundaria.
  const gestionarEsSecundario =
    hayQuePedirReserva &&
    acciones.some((a) => a.hacia === "RESERVA_SOLICITADA");

  return (
    <section className="no-print space-y-3 rounded-xl border border-borde bg-panel p-4">
      <h2 className="titulo-seccion">Acciones</h2>

      {puedeEntregar && (
        <BotonEnlace href={`/solicitudes/${solicitudId}/entrega`} bloque>
          {retiroPropio ? "Recibir y firmar" : "Entregar y firmar"}
        </BotonEnlace>
      )}

      {acciones.map((accion) => {
        if (accion.hacia === "ENTREGADA") return null;

        // Pedir el número de reserva y esperar es el trámite del almacén. Si la
        // reserva la crea el propio gestor ese paso no existe, y ofrecerlo solo
        // confundiría.
        if (accion.hacia === "RESERVA_SOLICITADA" && !hayQuePedirReserva)
          return null;

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
          // Sin líneas del almacén interno no hay reserva que registrar: el
          // material va por otro canal y el paso es un botón y nada más.
          if (lineasReserva.length === 0) {
            return (
              <form key={accion.hacia} action={accionCambiarEstado}>
                <input type="hidden" name="solicitudId" value={solicitudId} />
                <input type="hidden" name="nuevoEstado" value="EN_GESTION" />
                <Boton type="submit" bloque textoPendiente="Guardando…">
                  {accion.texto}
                </Boton>
              </form>
            );
          }

          return (
            <FormularioReserva
              key={accion.hacia}
              solicitudId={solicitudId}
              lineas={lineasReserva}
              texto={accion.texto}
              variante={gestionarEsSecundario ? "secundario" : "primario"}
            />
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
