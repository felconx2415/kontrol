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

/** Una reserva ya usada, ofrecida como atajo. Ver lib/reservas.ts. */
export type ReservaRecienteUI = {
  numero: string;
  ceco: string | null;
  ultimaPosicion: string | null;
};

type DatosReserva = {
  numeroReserva: string;
  posicionReserva: string;
  /**
   * La línea se editó a mano y deja de seguir al campo del grupo.
   *
   * Es lo que permite que una solicitud lleve números distintos: antes, teclear
   * arriba pisaba **todas** las líneas en cada pulsación, así que corregir una
   * suelta y luego tocar el campo común borraba la corrección sin avisar.
   */
  propio: boolean;
};

/**
 * Registro de la reserva, línea por línea.
 *
 * Va por línea y no por solicitud porque una solicitud puede mezclar los dos
 * orígenes de reserva, y cada uno tiene su número. El campo de arriba es el
 * atajo del caso habitual —todas las líneas del CECO con la misma reserva— y
 * baja a las líneas que no se hayan tocado a mano; la que se toca queda fija y
 * se marca como tal. La posición solo aparece en el CECO que la usa.
 */
function FormularioReserva({
  solicitudId,
  lineas,
  texto,
  recientes,
  variante = "primario",
}: {
  solicitudId: string;
  lineas: LineaReservaUI[];
  texto: string;
  /** Últimas reservas usadas, como atajo para no volver a teclearlas. */
  recientes: ReservaRecienteUI[];
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
          // Lo ya guardado nació de una edición anterior: se respeta.
          propio: Boolean(linea.numeroReserva),
        };
      });
    }
    return inicial;
  });

  function fijar(id: string, campo: "numeroReserva" | "posicionReserva", valor: string) {
    setDatos((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [campo]: valor,
        // Tocar el número de una línea la independiza del campo del grupo. La
        // posición no: siempre fue de cada línea.
        propio: campo === "numeroReserva" ? true : prev[id].propio,
      },
    }));
  }

  /** El campo de arriba baja solo a las líneas que nadie ha tocado. */
  function fijarGrupo(grupo: (typeof grupos)[number], valor: string) {
    setDatos((prev) => {
      const siguiente = { ...prev };
      for (const linea of grupo.lineas) {
        if (prev[linea.id].propio) continue;
        siguiente[linea.id] = { ...prev[linea.id], numeroReserva: valor };
      }
      return siguiente;
    });
  }

  /** Iguala el grupo entero, incluidas las líneas ya editadas a mano. */
  function igualarGrupo(grupo: (typeof grupos)[number], valor: string) {
    setDatos((prev) => {
      const siguiente = { ...prev };
      for (const linea of grupo.lineas) {
        siguiente[linea.id] = {
          ...prev[linea.id],
          numeroReserva: valor,
          propio: false,
        };
      }
      return siguiente;
    });
  }

  /**
   * Reutiliza una reserva ya usada: baja su número a todo el grupo y continúa
   * el correlativo de posiciones desde la última ocupada. Si volviera a empezar
   * en 0010 chocaría con las líneas que ya se pidieron con esa misma reserva.
   */
  function aplicarReciente(
    grupo: (typeof grupos)[number],
    reserva: ReservaRecienteUI,
  ) {
    const desde = reserva.ultimaPosicion
      ? Number(reserva.ultimaPosicion) + 10
      : 10;
    const posiciones = posicionesSecuenciales(grupo.lineas.length, desde);

    setDatos((prev) => {
      const siguiente = { ...prev };
      grupo.lineas.forEach((linea, i) => {
        siguiente[linea.id] = {
          numeroReserva: reserva.numero,
          posicionReserva: grupo.conPosicion
            ? posiciones[i]
            : prev[linea.id].posicionReserva,
          propio: false,
        };
      });
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
        // Las líneas del grupo comparten número mientras nadie edite una. Si
        // hay más de uno, el campo común queda vacío y se avisa: es un caso
        // legítimo, no un error, pero conviene que se vea.
        const numeros = new Set(
          grupo.lineas.map((l) => datos[l.id]?.numeroReserva ?? ""),
        );
        const comun = numeros.size === 1 ? [...numeros][0] : "";
        const mezcladas = numeros.size > 1;

        // Solo las del mismo origen: la reserva del almacén y la propia no se
        // intercambian, y ofrecerlas juntas invitaría a cruzarlas.
        const sugeridas = recientes.filter(
          (r) => r.ceco === null || r.ceco === grupo.ceco,
        );

        return (
          <div
            key={grupo.ceco}
            className="space-y-3 rounded-lg border border-borde p-3"
          >
            <Campo
              etiqueta={`N.º de reserva · CECO ${grupo.ceco}`}
              htmlFor={`reserva-${grupo.ceco}`}
              requerido={!mezcladas}
              pista={
                mezcladas
                  ? "Las líneas llevan reservas distintas. Escribe aquí para cambiar solo las que no tocaste, o usa «Igualar todas»."
                  : "Se aplica a todas las líneas que no hayas cambiado a mano."
              }
            >
              <Entrada
                id={`reserva-${grupo.ceco}`}
                type="text"
                value={comun}
                onChange={(e) => fijarGrupo(grupo, e.target.value)}
                placeholder={mezcladas ? "Reservas distintas" : "Ej: 4500912345"}
                required={!mezcladas}
              />
            </Campo>

            {mezcladas && comun === "" && (
              <Boton
                type="button"
                variante="secundario"
                tamano="sm"
                onClick={() => {
                  // Iguala a la primera línea, que es la de referencia visible.
                  const primera = datos[grupo.lineas[0].id]?.numeroReserva ?? "";
                  igualarGrupo(grupo, primera);
                }}
              >
                Igualar todas a {datos[grupo.lineas[0].id]?.numeroReserva || "—"}
              </Boton>
            )}

            {/* Las últimas usadas: una misma reserva cubre varias solicitudes
                seguidas, y volver a teclear diez dígitos es donde se cuelan los
                errores que dejan la línea imposible de retirar. */}
            {sugeridas.length > 0 && (
              <div>
                <p className="text-xs text-tinta-suave">Últimas reservas usadas</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {sugeridas.map((r) => (
                    <button
                      key={r.numero}
                      type="button"
                      onClick={() => aplicarReciente(grupo, r)}
                      className="foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-borde-fuerte bg-panel px-3 text-sm tabular-nums text-tinta transition-colors duration-150 hover:bg-panel-suave"
                    >
                      {r.numero}
                      {grupo.conPosicion && r.ultimaPosicion && (
                        <span className="ml-1.5 text-xs text-tinta-tenue">
                          desde {String(Number(r.ultimaPosicion) + 10).padStart(4, "0")}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ul className="divide-y divide-borde">
              {grupo.lineas.map((linea) => (
                <li key={linea.id} className="space-y-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{linea.nombre}</p>
                    <p className="text-xs text-tinta-tenue">
                      {linea.codigo} · {linea.cantidad}
                      {/* Que esta línea ya no siga al campo de arriba tiene que
                          verse, o el siguiente que lo teclee creerá que no
                          funciona. */}
                      {datos[linea.id]?.propio && (
                        <span className="text-espera"> · reserva propia de la línea</span>
                      )}
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
  reservasRecientes = [],
}: {
  solicitudId: string;
  acciones: Accion[];
  puedeEntregar: boolean;
  /** Quien mira es el beneficiario retirando lo suyo, no gestión entregándolo. */
  retiroPropio: boolean;
  items: ItemRecepcion[];
  /** Líneas que salen del almacén interno; son las que llevan reserva. */
  lineasReserva: LineaReservaUI[];
  /** Últimas reservas usadas, como atajo al registrarlas. */
  reservasRecientes?: ReservaRecienteUI[];
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
              recientes={reservasRecientes}
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
