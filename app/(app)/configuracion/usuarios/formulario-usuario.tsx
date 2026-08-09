"use client";

import { useActionState } from "react";
import { crearUsuario, type EstadoAdmin } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import CamposCuenta, { type BrigadaOpcion } from "./campos-cuenta";
import type { EmpresaOpcion } from "../empresas/formulario-empresa";

export default function FormularioUsuario({
  brigadas,
  empresas,
}: {
  brigadas: BrigadaOpcion[];
  empresas: EmpresaOpcion[];
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(crearUsuario, {});

  return (
    <form
      action={accion}
      className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Nueva cuenta
      </p>

      <Campo etiqueta="Nombre completo" htmlFor="nombre">
        <Entrada id="nombre" name="nombre" required />
      </Campo>

      <Campo etiqueta="Nombre de usuario" htmlFor="username">
        <Entrada
          id="username"
          name="username"
          required
          autoCapitalize="none"
          placeholder="jperez"
        />
      </Campo>

      <Campo etiqueta="RUT (opcional)" htmlFor="rut">
        <Entrada id="rut" name="rut" placeholder="12.345.678-9" />
      </Campo>

      <CamposCuenta idPrefijo="nuevo" empresas={empresas} brigadas={brigadas} />

      <Campo
        etiqueta="Contraseña inicial"
        htmlFor="password"
        pista="Mínimo 8 caracteres."
      >
        <Entrada id="password" name="password" type="text" required minLength={8} />
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
        <Boton type="submit" textoPendiente="Creando…">
          Crear usuario
        </Boton>
      </div>
    </form>
  );
}
