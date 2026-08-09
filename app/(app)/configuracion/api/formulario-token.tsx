"use client";

import { useActionState, useState } from "react";
import { crearTokenApi, type EstadoToken } from "@/actions/admin";
import Boton from "@/components/ui/boton";
import { Campo, Entrada, Seleccion } from "@/components/ui/campo";
import { Aviso } from "@/components/ui/superficie";
import type { EmpresaOpcion } from "../empresas/formulario-empresa";

/**
 * Alta de un token de la API de consulta.
 *
 * Lo particular de este formulario es lo que pasa **después** de enviarlo: el
 * token se muestra una única vez. No se guarda en claro en ninguna parte, así
 * que si se cierra la pantalla sin copiarlo hay que revocarlo y emitir otro.
 * Por eso el recuadro es grande, dice que no volverá a verse y trae un botón
 * de copiar.
 */
export default function FormularioToken({
  empresas,
}: {
  empresas: EmpresaOpcion[];
}) {
  const [estado, accion] = useActionState<EstadoToken, FormData>(crearTokenApi, {});
  const [copiado, setCopiado] = useState(false);

  async function copiar(valor: string) {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles queda seleccionarlo a mano; el valor está
      // a la vista, así que no hay nada que recuperar.
    }
  }

  return (
    <div className="space-y-3">
      <form
        action={accion}
        className="grid gap-3 rounded-xl border border-borde bg-panel p-4 sm:grid-cols-2"
      >
        <p className="text-sm font-semibold text-tinta sm:col-span-2">
          Nuevo token de consulta
        </p>

        <Campo
          etiqueta="Para qué es"
          htmlFor="nombre-token"
          pista="Se ve en el listado; ayuda a saber cuál revocar."
        >
          <Entrada
            id="nombre-token"
            name="nombre"
            required
            minLength={3}
            placeholder="Tablero de gerencia"
          />
        </Campo>

        <Campo
          etiqueta="Alcance"
          htmlFor="empresa-token"
          pista="Un token de una empresa solo lee lo de esa empresa."
        >
          <Seleccion id="empresa-token" name="empresaId" defaultValue="">
            <option value="">Todas las empresas</option>
            {empresas
              .filter((e) => e.activa)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nombre}
                </option>
              ))}
          </Seleccion>
        </Campo>

        {estado.error && (
          <Aviso tono="error" className="sm:col-span-2">
            {estado.error}
          </Aviso>
        )}

        <div className="sm:col-span-2">
          <Boton type="submit" textoPendiente="Creando…">
            Crear token
          </Boton>
        </div>
      </form>

      {estado.token && (
        <div className="space-y-3 rounded-xl border border-espera-borde bg-espera-fondo p-4">
          <p className="text-sm font-semibold text-espera">
            Cópialo ahora: no vuelve a mostrarse
          </p>
          <p className="text-sm text-tinta-suave">
            De aquí en adelante solo se guarda su huella. Si lo pierdes, revócalo
            y emite otro.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all break-all rounded-lg border border-borde bg-panel px-3 py-2 font-mono text-sm">
              {estado.token}
            </code>
            <Boton
              type="button"
              variante="secundario"
              tamano="sm"
              onClick={() => copiar(estado.token!)}
            >
              {copiado ? "Copiado" : "Copiar"}
            </Boton>
          </div>

          <p className="text-xs text-tinta-tenue">
            Se envía en cada consulta como{" "}
            <code className="font-mono">Authorization: Bearer …</code>
          </p>
        </div>
      )}
    </div>
  );
}
