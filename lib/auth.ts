import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type SessionOptions } from "iron-session";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { alcanceDe, type Alcance } from "@/lib/alcance";
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

/**
 * Cuánto dura la sesión.
 *
 * Eran ocho horas —una jornada—, pensadas para quien entra desde un computador
 * compartido de oficina. Con Kontrol instalado en el teléfono de cada persona
 * ese supuesto ya no aplica: quien pide EPP puede pasar meses entre solicitudes,
 * y tocar el icono para que lo primero que aparezca sea una pantalla de
 * contraseña convierte la app en un trámite. Treinta días cubre ese uso
 * esporádico sin volverse eterno.
 *
 * Es un plazo **absoluto**, no deslizante: se cuenta desde que se inició sesión
 * y no se renueva al usar la app. Renovarlo exigiría reescribir la cookie en
 * cada visita, y en el App Router las cookies solo pueden escribirse desde una
 * Server Action o un Route Handler —nunca desde el layout que resuelve al
 * usuario—, así que no hay dónde hacerlo sin ensuciar cada página.
 *
 * Lo que esto concede: un teléfono perdido queda dentro hasta 30 días. La
 * defensa no es el plazo sino la revocación — `usuarioActual()` relee la cuenta
 * en cada petición, así que desactivarla en /configuracion/usuarios corta el
 * acceso al instante, sin esperar a que la cookie caduque.
 */
const DURACION_SESION_S = 60 * 60 * 24 * 30;

export const opcionesSesion: SessionOptions = {
  password: secreto,
  cookieName: "kontrol_sesion",
  // Se fija el `ttl` —lo que dura el sello del contenido— y no el `maxAge` de
  // la cookie: iron-session deriva el segundo del primero restándole un minuto,
  // para que el navegador suelte la cookie *antes* de que el sello caduque.
  // Poniendo `maxAge` a mano se pierde ese margen y aparece una ventana en la
  // que el navegador manda una cookie que el servidor ya rechaza.
  //
  // Antes ocurría al revés: había `maxAge` de 8 horas sin `ttl`, así que el
  // sello valía los 14 días por defecto y quien conservara la cookie seguía
  // dentro. Ahora los dos plazos son el mismo.
  ttl: DURACION_SESION_S,
  cookieOptions: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
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
  /** Empresa a la que pertenece. Null en el ADMIN del sistema. */
  empresaId: string | null;
  empresaNombre: string | null;
  /** Las que atiende un gestor; vacío en el resto de los roles. */
  empresasGestionadas: { id: string; nombre: string }[];
  /**
   * Hasta dónde ve. Se resuelve una vez aquí y viaja con la sesión para que
   * ninguna consulta tenga que volver a deducirlo —ni pueda olvidarse de
   * hacerlo—. Ver lib/alcance.ts.
   */
  alcance: Alcance;
};

/** Devuelve el usuario en sesión, o null si no hay sesión válida. */
export async function usuarioActual(): Promise<UsuarioSesion | null> {
  const sesion = await obtenerSesion();
  if (!sesion.usuarioId) return null;

  const usuario = await db.usuario.findUnique({
    where: { id: sesion.usuarioId },
    include: {
      brigada: { select: { nombre: true } },
      empresa: { select: { nombre: true } },
      empresasGestionadas: {
        where: { activa: true },
        select: { id: true, nombre: true },
        orderBy: { nombre: "asc" },
      },
    },
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
    empresaId: usuario.empresaId,
    empresaNombre: usuario.empresa?.nombre ?? null,
    empresasGestionadas: usuario.empresasGestionadas,
    alcance: alcanceDe(usuario),
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
