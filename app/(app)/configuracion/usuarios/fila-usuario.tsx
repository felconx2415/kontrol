"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  alternarUsuario,
  editarUsuario,
  eliminarUsuario,
  restablecerPassword,
  type EstadoAdmin,
} from "@/actions/admin";
import { ETIQUETA_ROL } from "@/lib/solicitud-estado";
import Boton from "@/components/ui/boton";
import { Campo, Entrada } from "@/components/ui/campo";
import Insignia from "@/components/ui/insignia";
import { Aviso } from "@/components/ui/superficie";
import CamposCuenta, { type BrigadaOpcion } from "./campos-cuenta";
import type { EmpresaOpcion } from "../empresas/formulario-empresa";
import type { CargoOpcion } from "../cargos/formulario-cargo";
import type { Rol } from "@/generated/prisma/enums";

export type UsuarioFila = {
  id: string;
  nombre: string;
  username: string;
  rut: string | null;
  rol: Rol;
  brigadaId: string | null;
  brigadaNombre: string | null;
  cargoId: string | null;
  cargoNombre: string | null;
  empresaId: string | null;
  empresaNombre: string | null;
  /** Las que atiende, si es gestor. Vacío en el resto de los roles. */
  empresasGestionadas: string[];
  activo: boolean;
};

type Panel = "editar" | "password" | "eliminar" | null;

/**
 * Fila de la tabla de usuarios con sus acciones. El panel de edición se abre
 * en una segunda <tr> a todo el ancho en vez de en un modal: el proyecto no
 * tiene sistema de diálogos y una fila expandible mantiene el contexto visible.
 */
export default function FilaUsuario({
  usuario,
  brigadas,
  empresas,
  cargos,
  esUsuarioActual,
  marcada,
  onMarcar,
}: {
  usuario: UsuarioFila;
  brigadas: BrigadaOpcion[];
  empresas: EmpresaOpcion[];
  cargos: CargoOpcion[];
  esUsuarioActual: boolean;
  /** Seleccionada para una acción en lote. */
  marcada: boolean;
  onMarcar: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const cerrar = () => setPanel(null);

  const alternarPanel = (cual: Exclude<Panel, null>) =>
    setPanel((actual) => (actual === cual ? null : cual));

  return (
    <>
      <tr
        className={`transition-colors duration-150 hover:bg-panel-suave ${
          usuario.activo ? "" : "text-tinta-tenue"
        }`}
      >
        {/* La casilla va sin `data-label`: al apilarse en móvil no necesita
            rótulo, se entiende por su posición junto al nombre. */}
        <td className="w-10 py-2.5 pl-4">
          <input
            type="checkbox"
            checked={marcada}
            onChange={onMarcar}
            aria-label={`Seleccionar a ${usuario.nombre}`}
            className="foco-anillo size-5 cursor-pointer rounded border-borde-fuerte accent-marca-600"
          />
        </td>
        <td data-label="Nombre" className="px-4 py-2.5">
          <Link
            href={`/historial/${usuario.id}`}
            className="foco-anillo inline-flex min-h-6 items-center rounded underline underline-offset-2"
          >
            {usuario.nombre}
          </Link>
          {/* Bajo el nombre y no en columna propia: la tabla ya lleva ocho y
              el cargo se lee junto a la persona, no comparado entre filas. */}
          {usuario.cargoNombre && (
            <span className="block text-xs text-tinta-tenue">
              {usuario.cargoNombre}
            </span>
          )}
        </td>
        <td
          data-label="Usuario"
          className="px-4 py-2.5 font-mono tabular-nums text-tinta-suave"
        >
          {usuario.username}
        </td>
        <td data-label="Rol" className="px-4 py-2.5">
          {ETIQUETA_ROL[usuario.rol]}
        </td>
        <td data-label="Empresa" className="px-4 py-2.5 text-tinta-suave">
          {usuario.rol === "ADMIN" && !usuario.empresaNombre
            ? "Todas"
            : (usuario.empresaNombre ?? "—")}
          {/* Un gestor de varias empresas es lo primero que hay que poder ver
              de un vistazo: es lo que define hasta dónde llega su cuenta. */}
          {usuario.empresasGestionadas.length > 0 && (
            <span className="block text-xs text-tinta-tenue">
              atiende {usuario.empresasGestionadas.length} empresa
              {usuario.empresasGestionadas.length === 1 ? "" : "s"}
            </span>
          )}
        </td>
        <td data-label="Brigada" className="px-4 py-2.5 text-tinta-suave">
          {usuario.brigadaNombre ?? "—"}
        </td>
        <td data-label="Estado" className="px-4 py-2.5">
          <Insignia
            clases={
              usuario.activo
                ? "bg-exito-fondo text-exito ring-exito-borde"
                : "bg-lienzo text-tinta-tenue ring-borde"
            }
          >
            {usuario.activo ? "Activo" : "Inactivo"}
          </Insignia>
        </td>
        <td className="celda-completa px-4 py-2.5">
          <div className="flex flex-wrap justify-end gap-1">
            <BotonAccion
              onClick={() => alternarPanel("editar")}
              activo={panel === "editar"}
            >
              Editar
            </BotonAccion>
            <BotonAccion
              onClick={() => alternarPanel("password")}
              activo={panel === "password"}
            >
              Contraseña
            </BotonAccion>

            {/* Nadie puede desactivarse ni eliminarse a sí mismo. */}
            {!esUsuarioActual && (
              <>
                <form action={alternarUsuario} className="contents">
                  <input type="hidden" name="usuarioId" value={usuario.id} />
                  <button type="submit" className={CLASES_ACCION}>
                    {usuario.activo ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <BotonAccion
                  onClick={() => alternarPanel("eliminar")}
                  activo={panel === "eliminar"}
                  peligro
                >
                  Eliminar
                </BotonAccion>
              </>
            )}
          </div>
        </td>
      </tr>

      {panel && (
        <tr className="bg-panel-suave">
          <td colSpan={8} className="celda-completa panel-expandible px-4 py-4">
            {panel === "editar" && (
              <PanelEditar
                usuario={usuario}
                brigadas={brigadas}
                empresas={empresas}
                cargos={cargos}
                esUsuarioActual={esUsuarioActual}
                onCerrar={cerrar}
              />
            )}
            {panel === "password" && (
              <PanelPassword usuario={usuario} onCerrar={cerrar} />
            )}
            {panel === "eliminar" && (
              <PanelEliminar usuario={usuario} onCerrar={cerrar} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const CLASES_ACCION =
  "foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta";

function BotonAccion({
  onClick,
  activo,
  peligro = false,
  children,
}: {
  onClick: () => void;
  activo: boolean;
  peligro?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={activo}
      className={`${CLASES_ACCION} ${peligro ? "text-fallo hover:text-fallo" : ""} ${
        activo ? "text-tinta" : ""
      }`}
    >
      {children}
    </button>
  );
}

function PanelEditar({
  usuario,
  brigadas,
  empresas,
  cargos,
  esUsuarioActual,
  onCerrar,
}: {
  usuario: UsuarioFila;
  brigadas: BrigadaOpcion[];
  empresas: EmpresaOpcion[];
  cargos: CargoOpcion[];
  esUsuarioActual: boolean;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(editarUsuario, {});

  return (
    <form action={accion} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <input type="hidden" name="usuarioId" value={usuario.id} />
      <p className="text-sm font-semibold text-tinta sm:col-span-2 lg:col-span-3">
        Editar a {usuario.nombre}
      </p>

      <Campo etiqueta="Nombre completo" htmlFor={`nombre-${usuario.id}`}>
        <Entrada
          id={`nombre-${usuario.id}`}
          name="nombre"
          required
          defaultValue={usuario.nombre}
        />
      </Campo>

      <Campo etiqueta="Nombre de usuario" htmlFor={`username-${usuario.id}`}>
        <Entrada
          id={`username-${usuario.id}`}
          name="username"
          required
          autoCapitalize="none"
          defaultValue={usuario.username}
        />
      </Campo>

      <Campo etiqueta="RUT (opcional)" htmlFor={`rut-${usuario.id}`}>
        <Entrada
          id={`rut-${usuario.id}`}
          name="rut"
          defaultValue={usuario.rut ?? ""}
        />
      </Campo>

      <CamposCuenta
        idPrefijo={usuario.id}
        empresas={empresas}
        brigadas={brigadas}
        cargos={cargos}
        rolInicial={usuario.rol}
        empresaInicial={usuario.empresaId}
        brigadaInicial={usuario.brigadaId}
        cargoInicial={usuario.cargoId}
        gestionadasIniciales={usuario.empresasGestionadas}
        rolBloqueado={esUsuarioActual}
      />

      <Mensajes estado={estado} />

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <Boton type="submit" tamano="sm" textoPendiente="Guardando…">
          Guardar cambios
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </form>
  );
}

function PanelPassword({
  usuario,
  onCerrar,
}: {
  usuario: UsuarioFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(
    restablecerPassword,
    {},
  );

  return (
    <form action={accion} className="grid gap-3 sm:max-w-md">
      <input type="hidden" name="usuarioId" value={usuario.id} />
      <p className="text-sm font-semibold text-tinta">
        Nueva contraseña para {usuario.username}
      </p>

      <Campo
        etiqueta="Contraseña"
        htmlFor={`password-${usuario.id}`}
        pista="Mínimo 8 caracteres. Comunícasela a la persona por un canal seguro."
      >
        <Entrada
          id={`password-${usuario.id}`}
          name="password"
          type="text"
          required
          minLength={8}
        />
      </Campo>

      <Mensajes estado={estado} />

      <div className="flex gap-2">
        <Boton type="submit" tamano="sm" textoPendiente="Guardando…">
          Restablecer
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </form>
  );
}

function PanelEliminar({
  usuario,
  onCerrar,
}: {
  usuario: UsuarioFila;
  onCerrar: () => void;
}) {
  const [estado, accion] = useActionState<EstadoAdmin, FormData>(eliminarUsuario, {});

  return (
    <form action={accion} className="grid gap-3 sm:max-w-xl">
      <input type="hidden" name="usuarioId" value={usuario.id} />
      <p className="text-sm font-semibold text-tinta">
        ¿Eliminar la cuenta de {usuario.nombre}?
      </p>
      <p className="text-sm text-tinta-suave">
        La eliminación es permanente. Solo es posible en cuentas sin historial;
        si la persona ya registró solicitudes o entregas, desactívala en vez de
        eliminarla.
      </p>

      <Mensajes estado={estado} />

      <div className="flex gap-2">
        <Boton
          type="submit"
          tamano="sm"
          variante="peligro"
          textoPendiente="Eliminando…"
        >
          Sí, eliminar
        </Boton>
        <Boton type="button" tamano="sm" variante="secundario" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </form>
  );
}

function Mensajes({ estado }: { estado: EstadoAdmin }) {
  return (
    <>
      {estado.error && (
        <Aviso tono="error" className="col-span-full">
          {estado.error}
        </Aviso>
      )}
      {estado.ok && (
        <Aviso tono="exito" className="col-span-full">
          {estado.ok}
        </Aviso>
      )}
    </>
  );
}
