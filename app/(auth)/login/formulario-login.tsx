"use client";

import { useActionState } from "react";
import { iniciarSesion, type EstadoLogin } from "@/actions/sesion";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";

export default function FormularioLogin() {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {});

  return (
    <form action={accion} className="space-y-4">
      <Campo etiqueta="Usuario" htmlFor="username">
        <Entrada
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoFocus
          required
        />
      </Campo>

      <Campo etiqueta="Contraseña" htmlFor="password">
        <Entrada
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Campo>

      {estado.error && <Aviso tono="error">{estado.error}</Aviso>}

      <Boton type="submit" bloque textoPendiente="Ingresando…">
        Ingresar
      </Boton>
    </form>
  );
}
