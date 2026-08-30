"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  alternarCargo,
  editarCargo,
  eliminarCargo,
  type EstadoAdmin,
} from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import Insignia from "@/components/ui/insignia";
import { Aviso } from "@/components/ui/superficie";

export type CargoFila = {
  id: string;
  nombre: string;
  activo: boolean;
  personas: number;
};

type Panel = "editar" | "eliminar" | null;

/**
 * Fila de la tabla de cargos. Mismo patrón que FilaEmpresa y FilaBrigada: el
 * panel se abre en una segunda <tr> en vez de en un modal.
 */
export default function FilaCargo({ cargo }: { cargo: CargoFila }) {
  const [panel, setPanel] = useState<Panel>(null);
  const alternarPanel = (cual: Exclude<Panel, null>) =>
    setPanel((actual) => (actual === cual ? null : cual));

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          cargo.activo ? "" : "text-tinta-tenue"
        }`}
      >
        <td data-label="Cargo" className="px-4 py-2.5 font-medium">
          {cargo.nombre}
        </td>
        <td data-label="Personas" className="px-4 py-2.5 tabular-nums text-tinta-suave">
          {cargo.personas > 0 ? (
            // Lleva al listado de cuentas filtrado por el cargo: la pregunta
            // que sigue a «hay cuatro linieros» es siempre «¿quiénes?».
            <Link
              href={`/configuracion/usuarios?q=${encodeURIComponent(cargo.nombre)}`}
              className="foco-anillo inline-flex min-h-6 items-center rounded underline underline-offset-2"
            >
              {cargo.personas}
            </Link>
          ) : (
            0
          )}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              cargo.activo
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {cargo.activo ? "Activo" : "Inactivo"}
          </Insignia>
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => alternarPanel("editar")}
              aria-expanded={panel === "editar"}
              className={CLASES_ACCION}
            >
              Editar
            </button>
            <form action={alternarCargo} className="contents">
              <input type="hidden" name="cargoId" value={cargo.id} />
              <button type="submit" className={CLASES_ACCION}>
                {cargo.activo ? "Desactivar" : "Activar"}
              </button>
            </form>
            {/* Solo se ofrece borrar lo que nadie llegó a usar; con gente
                asignada la acción se rechaza y lo que corresponde es
                desactivarlo, así que ni siquiera se muestra. */}
            {cargo.personas === 0 && (
              <button
                type="button"
                onClick={() => alternarPanel("eliminar")}
                aria-expanded={panel === "eliminar"}
                className={`${CLASES_ACCION} text-fallo hover:text-fallo`}
              >
                Eliminar
              </button>
            )}
          </div>
        </td>
      </tr>

      {panel && (
        <tr className="bg-panel-suave">
          <td colSpan={4} className="celda-completa panel-expandible px-4 py-4">
            {panel === "editar" && (
              <PanelEditar cargo={cargo} onCerrar={() => setPanel(null)} />
            )}
            {panel === "eliminar" && (
              <PanelEliminar cargo={cargo} onCerrar={() => setPanel(null)} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

function PanelEditar({
  cargo,
  onCerrar,
}: {
  cargo: CargoFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(editarCargo, {});

  return (
    <form action={accion} className="grid gap-3 sm:max-w-md">
      <input type="hidden" name="cargoId" value={cargo.id} />
      <p className="text-sm font-semibold text-tinta">Editar {cargo.nombre}</p>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${cargo.id}`}>
        <Entrada
          id={`nombre-${cargo.id}`}
          name="nombre"
          required
          minLength={3}
          defaultValue={cargo.nombre}
        />
      </Campo>

      <Mensajes estado={estado} />

      <div className="flex gap-2">
        <Boton type="submit" tamano="sm" textoPendiente="Guardando…">
          Guardar cambios
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </form>
  );
}

function PanelEliminar({
  cargo,
  onCerrar,
}: {
  cargo: CargoFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(eliminarCargo, {});

  return (
    <form action={accion} className="grid gap-3 sm:max-w-xl">
      <input type="hidden" name="cargoId" value={cargo.id} />
      <p className="text-sm font-semibold text-tinta">
        ¿Eliminar el cargo «{cargo.nombre}»?
      </p>
      <p className="text-sm text-tinta-suave">
        Nadie lo tiene asignado, así que eliminarlo no afecta a ninguna ficha ni
        a ningún acta ya emitida.
      </p>

      <Mensajes estado={estado} />

      <div className="flex gap-2">
        <Boton
          type="submit"
          tamano="sm"
          variante="peligro"
          textoPendiente="Eliminando…"
        >
          Sí, eliminar
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

function Mensajes({ estado }: { estado: EstadoAdmin }) {
  return (
    <>
      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}
      {estado.ok && <Aviso tono="exito">{estado.ok}</Aviso>}
    </>
  );
}
