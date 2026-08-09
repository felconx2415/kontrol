"use client";

import { useMemo, useState, useTransition } from "react";
import {
  alternarVariosUsuarios,
  asignarBrigadaAVarios,
  asignarEmpresaAVarios,
} from "@/actions/admin";
import { clasesBoton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import FilaUsuario, { type UsuarioFila } from "./fila-usuario";
import type { BrigadaOpcion } from "./campos-cuenta";
import type { EmpresaOpcion } from "../empresas/formulario-empresa";

/** La brigada, con cuántos miembros tiene en total. Ver `avisoBrigadas`. */
export type BrigadaConMiembros = BrigadaOpcion & { miembros: number };

/**
 * Tabla de cuentas con selección múltiple.
 *
 * Nace de separar la operación por empresas: repartir a la gente entre dos
 * organizaciones son tantos paneles de edición como personas, y es trabajo
 * mecánico que la pantalla puede absorber. Sigue el patrón de
 * `solicitudes/lista-seleccionable.tsx`: casillas, barra de acciones que solo
 * aparece con algo marcado, y validación real en el servidor.
 */
export default function ListaUsuarios({
  usuarios,
  brigadas,
  empresas,
  idActual,
}: {
  usuarios: UsuarioFila[];
  brigadas: BrigadaConMiembros[];
  empresas: EmpresaOpcion[];
  /** Quién está mirando: su cuenta no puede desactivarse a sí misma. */
  idActual: string;
}) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [empresaDestino, setEmpresaDestino] = useState("");
  const [brigadaDestino, setBrigadaDestino] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enVuelo, iniciar] = useTransition();

  // Una fila puede desaparecer tras actuar sobre ella (o al cambiar de página),
  // así que la selección se depura contra lo que hay en pantalla.
  const elegidas = useMemo(
    () => marcadas.filter((id) => usuarios.some((u) => u.id === id)),
    [marcadas, usuarios],
  );

  const todasMarcadas = elegidas.length === usuarios.length && usuarios.length > 0;

  function alternarTodas() {
    setMarcadas(todasMarcadas ? [] : usuarios.map((u) => u.id));
  }

  function alternarUna(id: string) {
    setMarcadas((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function ejecutar(accion: () => Promise<{ error?: string }>) {
    setError(null);
    iniciar(async () => {
      const resultado = await accion();
      if (resultado?.error) {
        setError(resultado.error);
        return;
      }
      setMarcadas([]);
      setEmpresaDestino("");
      setBrigadaDestino("");
    });
  }

  /**
   * Qué le va a pasar a las brigadas de lo seleccionado, dicho antes de
   * confirmar. Es lo único de esta acción que no se deduce de las casillas:
   * mover media cuadrilla deja a esa media sin brigada, y enterarse después es
   * enterarse tarde.
   */
  const avisoBrigadas = useMemo(() => {
    if (!empresaDestino) return null;

    const seleccionadas = usuarios.filter((u) => elegidas.includes(u.id));
    const aMover = seleccionadas.filter((u) => u.empresaId !== empresaDestino);
    if (aMover.length === 0) return null;

    let completas = 0;
    let sueltas = 0;

    for (const brigadaId of new Set(
      aMover.map((u) => u.brigadaId).filter((b): b is string => Boolean(b)),
    )) {
      const brigada = brigadas.find((b) => b.id === brigadaId);
      if (!brigada) continue;

      const cuantos = aMover.filter((u) => u.brigadaId === brigadaId).length;
      if (cuantos === brigada.miembros) completas++;
      else sueltas += cuantos;
    }

    const partes: string[] = [];
    if (completas > 0) {
      partes.push(
        `${completas} brigada${completas === 1 ? "" : "s"} se mudará${
          completas === 1 ? "" : "n"
        } con su gente`,
      );
    }
    if (sueltas > 0) {
      partes.push(
        `${sueltas} cuenta${sueltas === 1 ? "" : "s"} quedará${
          sueltas === 1 ? "" : "n"
        } sin brigada por moverse solo parte de su cuadrilla`,
      );
    }

    return partes.length > 0 ? `${partes.join(" y ")}.` : null;
  }, [empresaDestino, elegidas, usuarios, brigadas]);

  // Al asignar brigada solo tienen sentido las de la empresa que comparten las
  // cuentas marcadas: una de otra empresa el servidor la rechazaría.
  const empresasMarcadas = new Set(
    usuarios.filter((u) => elegidas.includes(u.id)).map((u) => u.empresaId),
  );
  const brigadasOfrecibles =
    empresasMarcadas.size === 1
      ? brigadas.filter((b) => b.empresaId === [...empresasMarcadas][0])
      : [];

  return (
    <div className="space-y-3">
      {/* Pegajosa bajo la píldora de la barra: con diez filas, marcar la última
          y tener que subir a buscar el botón es media pantalla de viaje. */}
      {elegidas.length > 0 && (
        <div
          role="group"
          aria-label="Acciones sobre las cuentas seleccionadas"
          className="sticky top-[4.5rem] z-[var(--z-pegajoso)] space-y-3 rounded-xl border border-marca-200 bg-marca-50 p-3 shadow-sm"
        >
          <p className="text-sm font-medium">
            {elegidas.length} cuenta{elegidas.length === 1 ? "" : "s"} seleccionada
            {elegidas.length === 1 ? "" : "s"}
          </p>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1" htmlFor="empresa-lote">
              <span className="text-xs text-tinta-suave">Mover a la empresa</span>
              <Seleccion
                id="empresa-lote"
                value={empresaDestino}
                onChange={(e) => setEmpresaDestino(e.target.value)}
                className="min-w-48"
              >
                <option value="">Elige una empresa</option>
                {empresas
                  .filter((e) => e.activa)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nombre}
                    </option>
                  ))}
              </Seleccion>
            </label>
            <button
              type="button"
              disabled={!empresaDestino || enVuelo}
              onClick={() =>
                ejecutar(() => asignarEmpresaAVarios(elegidas, empresaDestino))
              }
              className={clasesBoton("primario", "sm")}
            >
              {enVuelo ? "Moviendo…" : "Mover"}
            </button>
          </div>

          {avisoBrigadas && (
            <p className="text-sm text-espera">{avisoBrigadas}</p>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-marca-200 pt-3">
            <label className="flex flex-col gap-1" htmlFor="brigada-lote">
              <span className="text-xs text-tinta-suave">Poner en la brigada</span>
              <Seleccion
                id="brigada-lote"
                value={brigadaDestino}
                onChange={(e) => setBrigadaDestino(e.target.value)}
                disabled={empresasMarcadas.size !== 1}
                className="min-w-48"
              >
                <option value="">Sin brigada</option>
                {brigadasOfrecibles.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </Seleccion>
            </label>
            <button
              type="button"
              disabled={empresasMarcadas.size !== 1 || enVuelo}
              onClick={() =>
                ejecutar(() => asignarBrigadaAVarios(elegidas, brigadaDestino))
              }
              className={clasesBoton("secundario", "sm")}
            >
              Aplicar
            </button>

            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={enVuelo}
                onClick={() => ejecutar(() => alternarVariosUsuarios(elegidas, true))}
                className={clasesBoton("secundario", "sm")}
              >
                Activar
              </button>
              <button
                type="button"
                disabled={enVuelo}
                onClick={() => ejecutar(() => alternarVariosUsuarios(elegidas, false))}
                className={clasesBoton("secundario", "sm")}
              >
                Desactivar
              </button>
            </div>
          </div>

          {empresasMarcadas.size !== 1 && (
            <p className="text-xs text-tinta-tenue">
              Para asignar brigada, marca cuentas de una sola empresa: las
              cuadrillas no se comparten entre empresas.
            </p>
          )}
        </div>
      )}

      {error && <Aviso tono="error">{error}</Aviso>}

      <div className="overflow-x-auto rounded-xl border border-borde bg-panel">
        <table
          className="tabla-apilable w-full text-sm"
          style={{ minWidth: "64rem" }}
        >
          <thead className="border-b border-borde text-left text-xs text-tinta-tenue">
            <tr>
              <th scope="col" className="w-10 py-2.5 pl-4">
                <input
                  type="checkbox"
                  checked={todasMarcadas}
                  onChange={alternarTodas}
                  aria-label="Seleccionar todas las cuentas de esta página"
                  className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
                />
              </th>
              {["Nombre", "Usuario", "Rol", "Empresa", "Brigada", "Estado"].map(
                (h) => (
                  <th key={h} scope="col" className="px-4 py-2.5 font-medium">
                    {h}
                  </th>
                ),
              )}
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {usuarios.map((u) => (
              <FilaUsuario
                key={u.id}
                usuario={u}
                brigadas={brigadas}
                empresas={empresas}
                esUsuarioActual={u.id === idActual}
                marcada={elegidas.includes(u.id)}
                onMarcar={() => alternarUna(u.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
