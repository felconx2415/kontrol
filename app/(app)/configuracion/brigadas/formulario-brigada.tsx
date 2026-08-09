"use client";

import { useActionState } from "react";
import { crearBrigada, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import type { EmpresaOpcion } from "../empresas/formulario-empresa";

export type SupervisorOpcion = { id: string; nombre: string; activo: boolean };

/** Marca las cuentas inactivas para que no se asignen por descuido. */
export function etiquetaSupervisor(s: SupervisorOpcion) {
  return s.activo ? s.nombre : `${s.nombre} (inactivo)`;
}

export default function FormularioBrigada({
  supervisores,
  empresas,
}: {
  supervisores: SupervisorOpcion[];
  empresas: EmpresaOpcion[];
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(crearBrigada, {});

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2">
        Nueva brigada
      </p>

      <Campo etiqueta="Nombre" htmlFor="nombre">
        <Entrada id="nombre" name="nombre" required placeholder="Brigada Norte" />
      </Campo>

      {/* La brigada vive dentro de una empresa: el nombre se repite entre
          empresas sin chocar, pero la brigada pertenece a una sola. */}
      <Campo etiqueta="Empresa" htmlFor="empresaId" requerido>
        <Seleccion id="empresaId" name="empresaId" required defaultValue="">
          <option value="" disabled>
            Elige una empresa
          </option>
          {empresas
            .filter((e) => e.activa)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
        </Seleccion>
      </Campo>

      <Campo
        etiqueta="Tipo"
        htmlFor="tipo"
        pista="Define en qué columna del formato de almacén aparece."
      >
        <Seleccion id="tipo" name="tipo" defaultValue="EMPRESA">
          <option value="EMPRESA">Empresa</option>
          <option value="CONTRATISTA">Contratista</option>
        </Seleccion>
      </Campo>

      <Campo etiqueta="Supervisor" htmlFor="supervisorId">
        <Seleccion id="supervisorId" name="supervisorId" defaultValue="">
          <option value="">Sin supervisor</option>
          {/* En el alta solo se ofrecen cuentas activas. */}
          {supervisores
            .filter((s) => s.activo)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
        </Seleccion>
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
          Crear brigada
        </Boton>
      </div>
    </form>
  );
}
