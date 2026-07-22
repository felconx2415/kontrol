"use client";

import { useActionState, useState } from "react";
import {
  editarBrigada,
  eliminarBrigada,
  type EstadoAdmin,
} from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import { ETIQUETA_TIPO_BRIGADA } from "@/lib/solicitud-estado";
import { etiquetaSupervisor, type SupervisorOpcion } from "./formulario-brigada";

export type BrigadaFila = {
  id: string;
  nombre: string;
  tipo: "EMPRESA" | "CONTRATISTA";
  supervisorId: string | null;
  supervisorNombre: string | null;
  miembros: number;
  solicitudes: number;
};

type Panel = "editar" | "eliminar" | null;

/**
 * Fila de la tabla de brigadas. Sigue el mismo patrón que FilaUsuario: los
 * paneles se abren en una segunda <tr> en vez de en un modal, porque el
 * proyecto no tiene sistema de diálogos.
 */
export default function FilaBrigada({
  brigada,
  supervisores,
}: {
  brigada: BrigadaFila;
  supervisores: SupervisorOpcion[];
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const cerrar = () => setPanel(null);

  const alternarPanel = (cual: Exclude<Panel, null>) =>
    setPanel((actual) => (actual === cual ? null : cual));

  return (
    <>
      <tr className="transition-colors duration-150 hover:bg-panel-suave">
        <td data-label="Brigada" className="px-4 py-2.5 font-medium">
          {brigada.nombre}
        </td>
        <td data-label="Tipo" className="px-4 py-2.5 text-tinta-suave">
          {ETIQUETA_TIPO_BRIGADA[brigada.tipo]}
        </td>
        <td data-label="Supervisor" className="px-4 py-2.5 text-tinta-suave">
          {brigada.supervisorNombre ?? "—"}
        </td>
        <td
          data-label="Miembros"
          className="px-4 py-2.5 tabular-nums text-tinta-suave"
        >
          {brigada.miembros}
        </td>
        <td
          data-label="Solicitudes"
          className="px-4 py-2.5 tabular-nums text-tinta-suave"
        >
          {brigada.solicitudes}
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex flex-wrap justify-end gap-1">
            <BotonAccion
              onClick={() => alternarPanel("editar")}
              activo={panel === "editar"}
            >
              Editar
            </BotonAccion>
            <BotonAccion
              onClick={() => alternarPanel("eliminar")}
              activo={panel === "eliminar"}
              peligro
            >
              Eliminar
            </BotonAccion>
          </div>
        </td>
      </tr>

      {panel && (
        <tr className="bg-panel-suave">
          <td colSpan={6} className="celda-completa panel-expandible px-4 py-4">
            {panel === "editar" && (
              <PanelEditar
                brigada={brigada}
                supervisores={supervisores}
                onCerrar={cerrar}
              />
            )}
            {panel === "eliminar" && (
              <PanelEliminar brigada={brigada} onCerrar={cerrar} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

function BotonAccion({
  onClick,
  activo,
  peligro = false,
  children,
}: {
  onClick: () => void;
  activo: boolean;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={activo}
      className={`${CLASES_ACCION} ${peligro ? "text-fallo hover:text-fallo" : ""} ${
        activo ? "text-tinta" : ""
      }`}
    >
      {children}
    </button>
  );
}

function PanelEditar({
  brigada,
  supervisores,
  onCerrar,
}: {
  brigada: BrigadaFila;
  supervisores: SupervisorOpcion[];
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(editarBrigada, {});

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="brigadaId" value={brigada.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2">
        Editar {brigada.nombre}
      </p>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${brigada.id}`}>
        <Entrada
          id={`nombre-${brigada.id}`}
          name="nombre"
          required
          defaultValue={brigada.nombre}
        />
      </Campo>

      <Campo etiqueta="Tipo" htmlFor={`tipo-${brigada.id}`}>
        <Seleccion id={`tipo-${brigada.id}`} name="tipo" defaultValue={brigada.tipo}>
          <option value="EMPRESA">Empresa</option>
          <option value="CONTRATISTA">Contratista</option>
        </Seleccion>
      </Campo>

      <Campo etiqueta="Supervisor" htmlFor={`supervisor-${brigada.id}`}>
        <Seleccion
          id={`supervisor-${brigada.id}`}
          name="supervisorId"
          defaultValue={brigada.supervisorId ?? ""}
        >
          <option value="">Sin supervisor</option>
          {/* Se listan las cuentas inactivas solo si ya son el supervisor de
              esta brigada, para no perder la asignación al guardar. */}
          {supervisores
            .filter((s) => s.activo || s.id === brigada.supervisorId)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {etiquetaSupervisor(s)}
              </option>
            ))}
        </Seleccion>
      </Campo>

      <Mensajes estado={estado} />

      <div className="flex gap-2 sm:col-span-2">
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
  brigada,
  onCerrar,
}: {
  brigada: BrigadaFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(eliminarBrigada, {});

  return (
    <form action={accion} className="grid gap-3 sm:max-w-xl">
      <input type="hidden" name="brigadaId" value={brigada.id} />
      <p className="text-sm font-semibold text-tinta">
        ¿Eliminar la brigada {brigada.nombre}?
      </p>
      <p className="text-sm text-tinta-suave">
        Solo pueden eliminarse brigadas sin miembros ni solicitudes asociadas.
        Reasigna a sus integrantes desde Usuarios antes de continuar.
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
      {estado.error && (
        <Aviso tono="error" className="col-span-full">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="col-span-full">
          {estado.ok}
        </Aviso>
      )}
    </>
  );
}
