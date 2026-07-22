"use client";

import { useActionState } from "react";
import { crearItemBodega, type EstadoBodega } from "@/actions/bodega";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export default function FormularioItem() {
  const [estado, accion] = useActionState<EstadoBodega, FormData>(
    crearItemBodega,
    {},
  );

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Nuevo ítem de bodega
      </p>

      <Campo etiqueta="Código" htmlFor="codigoItem">
        <Entrada id="codigoItem" name="codigo" required placeholder="HER-001" />
      </Campo>

      <Campo etiqueta="Nombre" htmlFor="nombreItem">
        <Entrada id="nombreItem" name="nombre" required placeholder="Taladro percutor" />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor="categoriaItem">
        <Entrada id="categoriaItem" name="categoria" placeholder="Herramientas" defaultValue="General" />
      </Campo>

      <Campo etiqueta="Unidad" htmlFor="unidadItem">
        <Entrada id="unidadItem" name="unidad" defaultValue="unidad" />
      </Campo>

      <Campo etiqueta="Ubicación (opcional)" htmlFor="ubicacionItem" pista="Estante, repisa o pasillo.">
        <Entrada id="ubicacionItem" name="ubicacion" placeholder="Estante A-3" />
      </Campo>

      <Campo etiqueta="Stock inicial" htmlFor="stockItem">
        <Entrada id="stockItem" name="stock" type="number" min={0} defaultValue={0} />
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
        <Boton type="submit" textoPendiente="Agregando…">
          Agregar ítem
        </Boton>
      </div>
    </form>
  );
}
