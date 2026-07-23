"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  alternarItemBodega,
  editarItemBodega,
  type EstadoBodega,
} from "@/actions/bodega";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, AreaTexto } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import Insignia from "@/components/ui/insignia";

export type ItemFila = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  unidad: string;
  ubicacion: string | null;
  notas: string | null;
  stock: number;
  prestado: number;
  activo: boolean;
};

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

export default function FilaItemBodega({ item }: { item: ItemFila }) {
  const [editando, setEditando] = useState(false);

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          item.activo ? "" : "text-tinta-tenue"
        }`}
      >
        <td data-label="Código" className="px-4 py-2.5 font-mono tabular-nums text-tinta-suave">
          {item.codigo}
        </td>
        <td data-label="Nombre" className="px-4 py-2.5">
          <Link
            href={`/bodega/${item.id}`}
            className="foco-anillo rounded font-medium text-tinta underline-offset-2 hover:underline"
          >
            {item.nombre}
          </Link>
        </td>
        <td data-label="Categoría" className="px-4 py-2.5 text-tinta-suave">
          {item.categoria}
        </td>
        <td data-label="Ubicación" className="px-4 py-2.5 text-tinta-suave">
          {item.ubicacion ?? "—"}
        </td>
        <td data-label="Stock" className="px-4 py-2.5 text-right font-mono tabular-nums">
          <span className={item.stock === 0 ? "text-fallo" : "text-tinta"}>
            {item.stock} {item.unidad}
          </span>
        </td>
        <td data-label="Prestado" className="px-4 py-2.5 text-right font-mono tabular-nums text-tinta-suave">
          {item.prestado > 0 ? item.prestado : "—"}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              item.activo
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {item.activo ? "Activo" : "Inactivo"}
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
            <form action={alternarItemBodega}>
              <input type="hidden" name="itemId" value={item.id} />
              <button type="submit" className={CLASES_ACCION}>
                {item.activo ? "Desactivar" : "Activar"}
              </button>
            </form>
          </div>
        </td>
      </tr>

      {editando && (
        <tr className="bg-panel-suave">
          <td colSpan={8} className="celda-completa panel-expandible px-4 py-4">
            <PanelEditar item={item} onCerrar={() => setEditando(false)} />
          </td>
        </tr>
      )}
    </>
  );
}

function PanelEditar({
  item,
  onCerrar,
}: {
  item: ItemFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    editarItemBodega,
    {},
  );

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="itemId" value={item.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Editar {item.codigo}
      </p>

      <Campo etiqueta="Código" htmlFor={`codigo-${item.id}`}>
        <Entrada id={`codigo-${item.id}`} name="codigo" required defaultValue={item.codigo} />
      </Campo>

      <Campo etiqueta="Nombre" htmlFor={`nombre-${item.id}`}>
        <Entrada id={`nombre-${item.id}`} name="nombre" required defaultValue={item.nombre} />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor={`categoria-${item.id}`}>
        <Entrada id={`categoria-${item.id}`} name="categoria" defaultValue={item.categoria} />
      </Campo>

      <Campo etiqueta="Unidad" htmlFor={`unidad-${item.id}`}>
        <Entrada id={`unidad-${item.id}`} name="unidad" defaultValue={item.unidad} />
      </Campo>

      <Campo etiqueta="Ubicación (opcional)" htmlFor={`ubicacion-${item.id}`}>
        <Entrada
          id={`ubicacion-${item.id}`}
          name="ubicacion"
          defaultValue={item.ubicacion ?? ""}
          placeholder="Estante A-3"
        />
      </Campo>

      <Campo
        etiqueta="Notas (opcional)"
        htmlFor={`notas-${item.id}`}
        className="sm:col-span-2 lg:col-span-3"
      >
        <AreaTexto
          id={`notas-${item.id}`}
          name="notas"
          rows={2}
          defaultValue={item.notas ?? ""}
        />
      </Campo>

      <p className="text-xs text-tinta-tenue sm:col-span-2 lg:col-span-3">
        El stock no se edita aquí: cambia con los movimientos (ingreso, salida,
        ajuste).
      </p>

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
