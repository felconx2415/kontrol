"use client";

import { useActionState, useState } from "react";
import {
  alternarArticulo,
  editarArticulo,
  type EstadoAdmin,
} from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";

export type ArticuloFila = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: "EPP" | "EQUIPAMIENTO";
  unidad: string;
  ceco: string | null;
  vidaUtilDias: number | null;
  activo: boolean;
};

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

/**
 * Fila de la tabla del catálogo. El panel de edición se abre en una segunda
 * <tr> (mismo patrón que FilaBrigada / FilaUsuario), porque el proyecto no
 * tiene sistema de diálogos.
 */
export default function FilaArticulo({ articulo }: { articulo: ArticuloFila }) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          articulo.activo ? "" : "text-tinta-tenue"
        }`}
      >
        <td data-label="Código" className="px-4 py-2.5 font-mono tabular-nums text-tinta-suave">
          {articulo.codigo}
        </td>
        <td data-label="Nombre" className="px-4 py-2.5">
          {articulo.nombre}
        </td>
        <td data-label="Categoría" className="px-4 py-2.5 text-tinta-suave">
          {articulo.categoria === "EPP" ? "EPP" : "Equipamiento"}
        </td>
        <td data-label="CECO" className="px-4 py-2.5 font-mono text-tinta-suave">
          {articulo.ceco ?? "—"}
        </td>
        <td data-label="Vida útil" className="px-4 py-2.5 font-mono tabular-nums text-tinta-suave">
          {articulo.vidaUtilDias ? `${articulo.vidaUtilDias} días` : "—"}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              articulo.activo
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {articulo.activo ? "Activo" : "Inactivo"}
          </Insignia>
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex flex-wrap justify-end gap-1">
            <button
              type="button"
              onClick={() => setEditando((v) => !v)}
              aria-expanded={editando}
              className={`${CLASES_ACCION} ${editando ? "text-tinta" : ""}`}
            >
              Editar
            </button>
            <form action={alternarArticulo}>
              <input type="hidden" name="articuloId" value={articulo.id} />
              <button type="submit" className={CLASES_ACCION}>
                {articulo.activo ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        </td>
      </tr>

      {editando && (
        <tr className="bg-panel-suave">
          <td colSpan={7} className="celda-completa panel-expandible px-4 py-4">
            <PanelEditar articulo={articulo} onCerrar={() => setEditando(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function PanelEditar({
  articulo,
  onCerrar,
}: {
  articulo: ArticuloFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(editarArticulo, {});

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="articuloId" value={articulo.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Editar {articulo.codigo}
      </p>

      <Campo etiqueta="Código" htmlFor={`codigo-${articulo.id}`}>
        <Entrada
          id={`codigo-${articulo.id}`}
          name="codigo"
          required
          defaultValue={articulo.codigo}
        />
      </Campo>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${articulo.id}`}>
        <Entrada
          id={`nombre-${articulo.id}`}
          name="nombre"
          required
          defaultValue={articulo.nombre}
        />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor={`categoria-${articulo.id}`}>
        <Seleccion
          id={`categoria-${articulo.id}`}
          name="categoria"
          defaultValue={articulo.categoria}
        >
          <option value="EPP">EPP</option>
          <option value="EQUIPAMIENTO">Equipamiento</option>
        </Seleccion>
      </Campo>

      <Campo etiqueta="Unidad" htmlFor={`unidad-${articulo.id}`}>
        <Entrada
          id={`unidad-${articulo.id}`}
          name="unidad"
          defaultValue={articulo.unidad}
        />
      </Campo>

      <Campo etiqueta="CECO (opcional)" htmlFor={`ceco-${articulo.id}`}>
        <Entrada
          id={`ceco-${articulo.id}`}
          name="ceco"
          defaultValue={articulo.ceco ?? ""}
          placeholder="FD1400D082"
        />
      </Campo>

      <Campo
        etiqueta="Vida útil en días (opcional)"
        htmlFor={`vida-${articulo.id}`}
        pista="Déjalo vacío si el artículo no vence."
      >
        <Entrada
          id={`vida-${articulo.id}`}
          name="vidaUtilDias"
          type="number"
          min={1}
          defaultValue={articulo.vidaUtilDias ?? ""}
          placeholder="365"
        />
      </Campo>

      {estado.error && (
        <Aviso tono="error" className="sm:col-span-2 lg:col-span-3">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="sm:col-span-2 lg:col-span-3">
          {estado.ok}
        </Aviso>
      )}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
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
