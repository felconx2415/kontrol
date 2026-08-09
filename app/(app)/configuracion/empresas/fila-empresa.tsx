"use client";

import { useActionState, useState } from "react";
import { alternarEmpresa, editarEmpresa, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import Insignia from "@/components/ui/insignia";
import { Aviso } from "@/components/ui/superficie";

export type EmpresaFila = {
  id: string;
  nombre: string;
  rut: string | null;
  activa: boolean;
  personas: number;
  brigadas: number;
  solicitudes: number;
};

/**
 * Fila de la tabla de empresas. Mismo patrón que FilaUsuario y FilaBrigada: el
 * panel de edición se abre en una segunda <tr> en vez de en un modal.
 */
export default function FilaEmpresa({ empresa }: { empresa: EmpresaFila }) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          empresa.activa ? "" : "text-tinta-tenue"
        }`}
      >
        <td data-label="Empresa" className="px-4 py-2.5 font-medium">
          {empresa.nombre}
        </td>
        <td data-label="RUT" className="px-4 py-2.5 tabular-nums text-tinta-suave">
          {empresa.rut ?? "—"}
        </td>
        <td data-label="Personas" className="px-4 py-2.5 tabular-nums text-tinta-suave">
          {empresa.personas}
        </td>
        <td data-label="Brigadas" className="px-4 py-2.5 tabular-nums text-tinta-suave">
          {empresa.brigadas}
        </td>
        <td
          data-label="Solicitudes"
          className="px-4 py-2.5 tabular-nums text-tinta-suave"
        >
          {empresa.solicitudes}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              empresa.activa
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {empresa.activa ? "Activa" : "Inactiva"}
          </Insignia>
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              aria-expanded={editando}
              className={CLASES_ACCION}
            >
              Editar
            </button>
            {/* No se elimina: sus solicitudes, actas y bodega apuntan a ella.
                Desactivarla la saca de los selectores sin tocar el historial. */}
            <form action={alternarEmpresa} className="contents">
              <input type="hidden" name="empresaId" value={empresa.id} />
              <button type="submit" className={CLASES_ACCION}>
                {empresa.activa ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        </td>
      </tr>

      {editando && (
        <tr className="bg-panel-suave">
          <td colSpan={7} className="celda-completa panel-expandible px-4 py-4">
            <PanelEditar empresa={empresa} onCerrar={() => setEditando(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

function PanelEditar({
  empresa,
  onCerrar,
}: {
  empresa: EmpresaFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(editarEmpresa, {});

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="empresaId" value={empresa.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2">
        Editar {empresa.nombre}
      </p>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${empresa.id}`}>
        <Entrada
          id={`nombre-${empresa.id}`}
          name="nombre"
          required
          defaultValue={empresa.nombre}
        />
      </Campo>

      <Campo etiqueta="RUT (opcional)" htmlFor={`rut-${empresa.id}`}>
        <Entrada
          id={`rut-${empresa.id}`}
          name="rut"
          defaultValue={empresa.rut ?? ""}
        />
      </Campo>

      {estado.error && (
        <Aviso tono="error" className="sm:col-span-2">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="sm:col-span-2">
          {estado.ok}
        </Aviso>
      )}

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
