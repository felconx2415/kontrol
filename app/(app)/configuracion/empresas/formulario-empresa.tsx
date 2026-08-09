"use client";

import { useActionState } from "react";
import { crearEmpresa, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export type EmpresaOpcion = { id: string; nombre: string; activa: boolean };

/** Marca las inactivas para que no se asignen por descuido. */
export function etiquetaEmpresa(e: EmpresaOpcion) {
  return e.activa ? e.nombre : `${e.nombre} (inactiva)`;
}

export default function FormularioEmpresa() {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(crearEmpresa, {});

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2">
        Nueva empresa
      </p>

      <Campo etiqueta="Nombre" htmlFor="nombre">
        <Entrada
          id="nombre"
          name="nombre"
          required
          placeholder="Contratista Los Ríos"
        />
      </Campo>

      <Campo etiqueta="RUT (opcional)" htmlFor="rut">
        <Entrada id="rut" name="rut" placeholder="76.123.456-7" />
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
          Crear empresa
        </Boton>
      </div>
    </form>
  );
}
