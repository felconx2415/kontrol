"use client";

import { useActionState, useMemo, useState } from "react";
import {
  crearItemBodegaDesdeCatalogo,
  type EstadoBodega,
} from "@/actions/bodega";
import BuscadorArticulo, {
  normalizar,
  type OpcionBuscador,
} from "@/components/buscador-articulo";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export type ArticuloCatalogo = {
  id: string;
  codigo: string;
  nombre: string;
  categoria: "EPP" | "EQUIPAMIENTO";
};

export default function FormularioItemCatalogo({
  articulos,
}: {
  articulos: ArticuloCatalogo[];
}) {
  const [seleccionado, setSeleccionado] = useState<ArticuloCatalogo | null>(null);

  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    async (previo, formData) => {
      const resultado = await crearItemBodegaDesdeCatalogo(previo, formData);
      if (resultado.ok) setSeleccionado(null); // listo para el siguiente
      return resultado;
    },
    {},
  );

  const porId = useMemo(
    () => new Map(articulos.map((a) => [a.id, a])),
    [articulos],
  );

  const opciones: OpcionBuscador[] = useMemo(
    () =>
      articulos.map((a) => ({
        id: a.id,
        principal: a.nombre,
        secundario: a.codigo,
        buscable: normalizar(`${a.nombre} ${a.codigo}`),
      })),
    [articulos],
  );

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Agregar desde el catálogo
      </p>

      <input type="hidden" name="articuloId" value={seleccionado?.id ?? ""} />

      <div className="sm:col-span-2 lg:col-span-3">
        {seleccionado ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-marca-200 bg-marca-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-marca-800">
                {seleccionado.nombre}
              </p>
              <p className="font-mono text-xs text-tinta-tenue">
                {seleccionado.codigo} ·{" "}
                {seleccionado.categoria === "EPP" ? "EPP" : "Equipamiento"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSeleccionado(null)}
              className="foco-anillo inline-flex min-h-9 cursor-pointer items-center rounded px-2 text-xs font-medium text-marca-700 underline underline-offset-2 hover:text-marca-800"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <Campo etiqueta="Artículo del catálogo" htmlFor="buscador-catalogo">
            <BuscadorArticulo
              opciones={opciones}
              etiqueta="Artículo del catálogo"
              placeholder="Busca por nombre o código…"
              onElegir={(id) => setSeleccionado(porId.get(id) ?? null)}
            />
          </Campo>
        )}
      </div>

      <Campo etiqueta="Ubicación (opcional)" htmlFor="ubicacionCat" pista="Estante, repisa o pasillo.">
        <Entrada id="ubicacionCat" name="ubicacion" placeholder="Estante A-3" />
      </Campo>

      <Campo etiqueta="Stock inicial" htmlFor="stockCat">
        <Entrada id="stockCat" name="stock" type="number" min={0} defaultValue={0} />
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

      <div className="sm:col-span-2 lg:col-span-3">
        <Boton type="submit" textoPendiente="Agregando…" disabled={!seleccionado}>
          Agregar a la bodega
        </Boton>
      </div>
    </form>
  );
}
