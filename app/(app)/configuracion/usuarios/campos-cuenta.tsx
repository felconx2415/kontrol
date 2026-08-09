"use client";

import { useState } from "react";
import { Campo, Seleccion } from "@/components/ui/campo";
import { ETIQUETA_ROL, ROLES } from "@/lib/solicitud-estado";
import {
  etiquetaEmpresa,
  type EmpresaOpcion,
} from "../empresas/formulario-empresa";
import type { Rol } from "@/generated/prisma/enums";

export type BrigadaOpcion = { id: string; nombre: string; empresaId: string };

/**
 * Rol, empresa y brigada de una cuenta. Van en un solo componente porque se
 * condicionan entre sí y separarlos obligaría a sincronizar tres estados:
 *
 * - El **rol** decide si hay que elegir empresa (el ADMIN no se circunscribe a
 *   ninguna) y si aparece la lista de empresas que atiende (solo el gestor).
 * - La **empresa** acota las brigadas: una brigada vive dentro de una empresa,
 *   y ofrecer las de otra solo produciría un error al guardar.
 *
 * Lo usan por igual el alta y el panel de edición, así que las dos pantallas
 * aplican las mismas reglas sin repetirlas.
 */
export default function CamposCuenta({
  empresas,
  brigadas,
  idPrefijo,
  rolInicial = "SOLICITANTE",
  empresaInicial = null,
  brigadaInicial = null,
  gestionadasIniciales = [],
  /** El ADMIN no puede cambiar su propio rol; el select queda fijo. */
  rolBloqueado = false,
}: {
  empresas: EmpresaOpcion[];
  brigadas: BrigadaOpcion[];
  idPrefijo: string;
  rolInicial?: Rol;
  empresaInicial?: string | null;
  brigadaInicial?: string | null;
  gestionadasIniciales?: string[];
  rolBloqueado?: boolean;
}) {
  const [rol, setRol] = useState<Rol>(rolInicial);
  const [empresaId, setEmpresaId] = useState(empresaInicial ?? "");

  // La empresa actual se ofrece siempre aunque esté inactiva: si faltara,
  // guardar cualquier otro cambio la borraría sin querer.
  const empresasVisibles = empresas.filter(
    (e) => e.activa || e.id === empresaInicial,
  );

  // Sin empresa elegida no hay brigadas que ofrecer: son de una empresa.
  const brigadasVisibles = empresaId
    ? brigadas.filter((b) => b.empresaId === empresaId)
    : [];

  return (
    <>
      <Campo etiqueta="Rol" htmlFor={`rol-${idPrefijo}`}>
        <Seleccion
          id={`rol-${idPrefijo}`}
          name="rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as Rol)}
          disabled={rolBloqueado}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ETIQUETA_ROL[r]}
            </option>
          ))}
        </Seleccion>
        {/* Un select deshabilitado no se envía; conserva el rol actual. */}
        {rolBloqueado && <input type="hidden" name="rol" value={rol} />}
      </Campo>

      <Campo
        etiqueta="Empresa"
        htmlFor={`empresa-${idPrefijo}`}
        requerido={rol !== "ADMIN"}
        pista={
          rol === "ADMIN" ? "El administrador ve todas las empresas." : undefined
        }
      >
        <Seleccion
          id={`empresa-${idPrefijo}`}
          name="empresaId"
          value={empresaId}
          required={rol !== "ADMIN"}
          onChange={(e) => setEmpresaId(e.target.value)}
        >
          <option value="">
            {rol === "ADMIN" ? "Todas (sin empresa propia)" : "Elige una empresa"}
          </option>
          {empresasVisibles.map((e) => (
            <option key={e.id} value={e.id}>
              {etiquetaEmpresa(e)}
            </option>
          ))}
        </Seleccion>
      </Campo>

      <Campo
        etiqueta="Brigada"
        htmlFor={`brigada-${idPrefijo}`}
        pista={
          empresaId && brigadasVisibles.length === 0
            ? "Esa empresa todavía no tiene brigadas."
            : undefined
        }
      >
        <Seleccion
          id={`brigada-${idPrefijo}`}
          name="brigadaId"
          // Cambiar de empresa deja la brigada anterior fuera de la lista: se
          // vuelve a «Sin brigada» en vez de enviar una que ya no corresponde.
          key={empresaId}
          defaultValue={
            brigadasVisibles.some((b) => b.id === brigadaInicial)
              ? (brigadaInicial ?? "")
              : ""
          }
          disabled={!empresaId}
        >
          <option value="">Sin brigada</option>
          {brigadasVisibles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </Seleccion>
      </Campo>

      {/* Solo el gestor atiende varias empresas. Casillas y no un
          `<select multiple>`: en un táctil y con guantes, el multiselect nativo
          es de lo más difícil de operar que existe. */}
      {rol === "GESTOR" && (
        <fieldset className="sm:col-span-2 lg:col-span-3">
          <legend className="mb-1 block text-sm font-medium text-tinta">
            Empresas que atiende
          </legend>
          <p className="mb-2 text-xs text-tinta-tenue">
            Marca todas las que gestiona; verá las solicitudes y la bodega de
            cada una. Sin marcar ninguna, verá solo la empresa a la que
            pertenece.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {empresas
              .filter((e) => e.activa || gestionadasIniciales.includes(e.id))
              .map((e) => (
                <label
                  key={e.id}
                  className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-tinta-suave"
                >
                  <input
                    type="checkbox"
                    name="empresasGestionadas"
                    value={e.id}
                    defaultChecked={gestionadasIniciales.includes(e.id)}
                    className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
                  />
                  {etiquetaEmpresa(e)}
                </label>
              ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
