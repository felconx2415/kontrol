import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Rol } from "@/generated/prisma/enums";

export type DatosSesion = {
  usuarioId?: string;
};

const secreto = process.env.SESSION_SECRET;
if (!secreto || secreto.length < 32) {
  throw new Error(
    "Falta SESSION_SECRET en .env (mínimo 32 caracteres). Genera uno con: openssl rand -base64 32",
  );
}

export const opcionesSesion: SessionOptions = {
  password: secreto,
  cookieName: "kontrol_sesion",
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8, // jornada laboral
  },
};

export async function obtenerSesion() {
  const store = await cookies();
  return getIronSession<DatosSesion>(store, opcionesSesion);
}

export type UsuarioSesion = {
  id: string;
  username: string;
  nombre: string;
  rol: Rol;
  brigadaId: string | null;
  brigadaNombre: string | null;
};

/** Devuelve el usuario en sesión, o null si no hay sesión válida. */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const sesion = await obtenerSesion();
  if (!sesion.usuarioId) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: sesion.usuarioId },
    include: { brigada: { select: { nombre: true } } },
  });

  // Cuenta borrada o desactivada mientras la sesión seguía viva.
  if (!usuario || !usuario.activo) return null;

  return {
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    rol: usuario.rol,
    brigadaId: usuario.brigadaId,
    brigadaNombre: usuario.brigada?.nombre ?? null,
  };
}

/** Igual que usuarioActual pero redirige al login si no hay sesión. */
export async function requerirUsuario(): Promise<UsuarioSesion> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/login");
  return usuario;
}

/** Exige que el usuario tenga alguno de los roles indicados. */
export async function requerirRol(...roles: Rol[]): Promise<UsuarioSesion> {
  const usuario = await requerirUsuario();
  if (!roles.includes(usuario.rol)) redirect("/escritorio?error=sin-permiso");
  return usuario;
}

export async function verificarCredenciales(username: string, password: string) {
  const usuario = await db.usuario.findUnique({
    where: { username: username.trim().toLowerCase() },
  });
  if (!usuario || !usuario.activo) return null;

  const coincide = await bcrypt.compare(password, usuario.passwordHash);
  return coincide ? usuario : null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

/** Deja constancia de una acción relevante en el registro de auditoría. */
export async function registrarAuditoria(params: {
  usuarioId: string;
  entidad: string;
  entidadId: string;
  accion: string;
  detalle?: unknown;
}) {
  await db.auditoria.create({
    data: {
      usuarioId: params.usuarioId,
      entidad: params.entidad,
      entidadId: params.entidadId,
      accion: params.accion,
      detalleJson: params.detalle ? JSON.stringify(params.detalle) : null,
    },
  });
}
