"use client";

import { useActionState } from "react";
import { crearCargo, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export type CargoOpcion = { id: string; nombre: string; activo: boolean };

/** Marca los inactivos para que no se asignen por descuido. */
export function etiquetaCargo(c: CargoOpcion) {
  return c.activo ? c.nombre : `${c.nombre} (inactivo)`;
}

export default function FormularioCargo() {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(crearCargo, {});

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2">Nuevo cargo</p>

      <Campo
        etiqueta="Nombre"
        htmlFor="nombre"
        pista="Cómo se llama la función en terreno, no el rol dentro de Kontrol."
      >
        <Entrada
          id="nombre"
          name="nombre"
          required
          minLength={3}
          placeholder="Prevencionista de riesgo"
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

      <div className="sm:col-span-2">
        <Boton type="submit" textoPendiente="Creando…">
          Crear cargo
        </Boton>
      </div>
    </form>
  );
}
