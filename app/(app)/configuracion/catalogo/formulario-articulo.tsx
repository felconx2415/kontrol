"use client";

import { useActionState } from "react";
import { crearArticulo, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export default function FormularioArticulo() {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(crearArticulo, {});

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Nuevo artículo
      </p>

      <Campo etiqueta="Código" htmlFor="codigo">
        <Entrada id="codigo" name="codigo" required placeholder="EPP-011" />
      </Campo>

      <Campo etiqueta="Nombre" htmlFor="nombreArticulo">
        <Entrada id="nombreArticulo" name="nombre" required />
      </Campo>

      <Campo etiqueta="Categoría" htmlFor="categoria">
        <Seleccion id="categoria" name="categoria" defaultValue="EPP">
          <option value="EPP">EPP</option>
          <option value="EQUIPAMIENTO">Equipamiento</option>
        </Seleccion>
      </Campo>

      <Campo etiqueta="Unidad" htmlFor="unidad">
        <Entrada id="unidad" name="unidad" defaultValue="unidad" />
      </Campo>

      <Campo etiqueta="CECO (opcional)" htmlFor="ceco">
        <Entrada id="ceco" name="ceco" placeholder="FD1400D082" />
      </Campo>

      <Campo
        etiqueta="Vida útil en días (opcional)"
        htmlFor="vidaUtilDias"
        pista="Déjalo vacío si el artículo no vence."
      >
        <Entrada
          id="vidaUtilDias"
          name="vidaUtilDias"
          type="number"
          min={1}
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

      <div className="sm:col-span-2 lg:col-span-3">
        <Boton type="submit" textoPendiente="Agregando…">
          Agregar artículo
        </Boton>
      </div>
    </form>
  );
}
