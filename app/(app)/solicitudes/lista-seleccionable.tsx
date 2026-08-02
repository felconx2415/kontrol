"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { aprobarVarias, enviarVariasAlAlmacen } from "@/actions/solicitudes";
import EstadoBadge from "@/components/estado-badge";
import { clasesBoton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import type { EstadoSolicitud } from "@/generated/prisma/enums";

export type FilaSolicitud = {
  id: string;
  /** Ya formateado en el servidor: lib/folio es server-only. */
  folioTexto: string;
  estado: EstadoSolicitud;
  tipo: "NUEVO" | "REEMPLAZO";
  solicitanteNombre: string;
  brigadaNombre: string | null;
  creadaEnTexto: string;
  totalItems: number;
};

/**
 * Listado de solicitudes con selección múltiple.
 *
 * Nace de un cambio de escala: desde que un gestor puede cargar el equipamiento
 * de una brigada entera de una vez, la cola deja de tener tres pedidos y pasa a
 * tener quince casi iguales. Aprobarlos de a uno —y sobre todo, mandar quince
 * planillas al almacén— es trabajo mecánico que la pantalla puede absorber.
 *
 * Quien no puede aprobar ni gestionar ve la lista de siempre, sin casillas: la
 * selección solo existe si hay algo que hacer con ella.
 */
export default function ListaSeleccionable({
  solicitudes,
  puedeAprobar,
  puedeGestionar,
}: {
  solicitudes: FilaSolicitud[];
  puedeAprobar: boolean;
  puedeGestionar: boolean;
}) {
  const seleccionable = puedeAprobar || puedeGestionar;

  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, iniciar] = useTransition();

  // Una fila puede desaparecer del listado tras actuar sobre ella (por el
  // filtro de estado), así que la selección se depura contra lo que hay.
  const presentes = useMemo(
    () => marcadas.filter((id) => solicitudes.some((s) => s.id === id)),
    [marcadas, solicitudes],
  );

  const elegidas = solicitudes.filter((s) => presentes.includes(s.id));
  const pendientes = elegidas.filter((s) => s.estado === "PENDIENTE");
  const aprobadas = elegidas.filter((s) => s.estado === "APROBADA");

  const todasMarcadas =
    solicitudes.length > 0 && presentes.length === solicitudes.length;

  function alternar(id: string) {
    setError(null);
    setMarcadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function alternarTodas() {
    setError(null);
    setMarcadas(todasMarcadas ? [] : solicitudes.map((s) => s.id));
  }

  function ejecutar(accion: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      // El aviso de éxito lo muestra el layout; aquí solo queda soltar la
      // selección para no repetir la acción sobre lo mismo.
      setMarcadas([]);
      setReferencia("");
    });
  }

  return (
    <div className="space-y-3">
      {seleccionable && solicitudes.length > 0 && (
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-tinta-suave">
          <input
            type="checkbox"
            checked={todasMarcadas}
            onChange={alternarTodas}
            className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
          />
          Seleccionar las {solicitudes.length} de esta página
        </label>
      )}

      <ul className="divide-y divide-borde overflow-hidden rounded-xl border border-borde bg-panel">
        {solicitudes.map((s) => {
          const marcada = presentes.includes(s.id);
          return (
            <li
              key={s.id}
              className={`flex items-center transition-colors duration-150 ${
                marcada ? "bg-marca-50" : ""
              }`}
            >
              {seleccionable && (
                <label className="flex min-h-11 shrink-0 cursor-pointer items-center pl-4 pr-1">
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => alternar(s.id)}
                    aria-label={`Seleccionar ${s.folioTexto} de ${s.solicitanteNombre}`}
                    className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
                  />
                </label>
              )}

              <Link
                href={`/solicitudes/${s.id}`}
                className={`foco-anillo flex min-h-11 min-w-0 flex-1 items-center justify-between gap-4 py-3 pr-4 transition-colors duration-150 hover:bg-marca-50 ${
                  seleccionable ? "pl-2" : "pl-4"
                }`}
              >
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="font-mono text-xs tabular-nums text-tinta-tenue">
                    {s.folioTexto}
                  </span>
                  <span className="truncate text-sm font-medium">
                    {s.solicitanteNombre}
                  </span>
                  <span className="hidden truncate text-xs text-tinta-tenue sm:inline">
                    {s.tipo === "REEMPLAZO" ? "Reemplazo" : "Nuevo"} · {s.totalItems}{" "}
                    ítem{s.totalItems === 1 ? "" : "s"}
                    {s.brigadaNombre ? ` · ${s.brigadaNombre}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="hidden text-xs text-tinta-tenue md:inline">
                    {s.creadaEnTexto}
                  </span>
                  <EstadoBadge estado={s.estado} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {error && <Aviso tono="error">{error}</Aviso>}

      {/* La barra se pega al borde inferior: con una lista larga, las acciones
          deben seguir a mano sin volver arriba. */}
      {elegidas.length > 0 && (
        <div className="no-print sticky bottom-4 z-[var(--z-pegajoso)] rounded-xl border border-borde-fuerte bg-panel p-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">
              {elegidas.length} seleccionada{elegidas.length === 1 ? "" : "s"}
            </p>

            <button
              type="button"
              onClick={() => setMarcadas([])}
              className={clasesBoton("fantasma", "sm")}
            >
              Limpiar
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {puedeAprobar && pendientes.length > 0 && (
                <button
                  type="button"
                  disabled={enVuelo}
                  onClick={() => ejecutar(() => aprobarVarias(pendientes.map((s) => s.id)))}
                  className={clasesBoton("primario", "sm")}
                >
                  {enVuelo
                    ? "Aprobando…"
                    : `Aprobar ${pendientes.length === 1 ? "" : `${pendientes.length} `}pendiente${
                        pendientes.length === 1 ? "" : "s"
                      }`}
                </button>
              )}

              {puedeGestionar && (
                <a
                  href={`/api/solicitudes/almacen?ids=${elegidas.map((s) => s.id).join(",")}`}
                  className={clasesBoton("secundario", "sm")}
                >
                  Descargar formato almacén
                </a>
              )}
            </div>
          </div>

          {puedeGestionar && aprobadas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-borde pt-3">
              <label htmlFor="ref-pedido" className="text-sm text-tinta-suave">
                N.º de pedido al almacén (opcional)
              </label>
              <Entrada
                id="ref-pedido"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Ej: 4500123456"
                className="w-44"
              />
              <button
                type="button"
                disabled={enVuelo}
                onClick={() =>
                  ejecutar(() =>
                    enviarVariasAlAlmacen(
                      aprobadas.map((s) => s.id),
                      referencia,
                    ),
                  )
                }
                className={clasesBoton("secundario", "sm")}
              >
                {enVuelo
                  ? "Registrando…"
                  : `Marcar ${aprobadas.length === 1 ? "la aprobada" : `las ${aprobadas.length} aprobadas`} como pedida${
                      aprobadas.length === 1 ? "" : "s"
                    }`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
