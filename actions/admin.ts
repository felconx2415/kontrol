"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, registrarAuditoria, requerirRol } from "@/lib/auth";
import { ROLES, ROLES_ADMIN, ROLES_GESTION } from "@/lib/solicitud-estado";
import type { Categoria, Rol } from "@/generated/prisma/enums";

export type EstadoAdmin = { error?: string; ok?: string };

/**
 * Valida los campos que comparten crear y editar. Devuelve el mensaje de error
 * o null si todo está bien. `idActual` excluye al propio usuario de la
 * comprobación de unicidad al editar.
 */
async function validarDatosUsuario(
  username: string,
  nombre: string,
  rol: Rol,
  idActual?: string,
): Promise<string | null> {
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return "El usuario debe tener al menos 3 caracteres: letras, números, punto, guion o guion bajo.";
  }
  if (!nombre) return "Indica el nombre completo.";
  if (!ROLES.includes(rol)) return "Selecciona un rol válido.";

  const existente = await db.usuario.findUnique({ where: { username } });
  if (existente && existente.id !== idActual) {
    return "Ese nombre de usuario ya está en uso.";
  }
  return null;
}

export async function crearUsuario(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;
  const rol = String(formData.get("rol") ?? "") as Rol;
  const brigadaId = String(formData.get("brigadaId") ?? "") || null;
  const password = String(formData.get("password") ?? "");

  const error = await validarDatosUsuario(username, nombre, rol);
  if (error) return { error };
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const usuario = await db.usuario.create({
    data: {
      username,
      nombre,
      rut,
      rol,
      brigadaId,
      passwordHash: await hashPassword(password),
    },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: usuario.id,
    accion: "CREADO",
    detalle: { username, rol },
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${username} creado.` };
}

export async function editarUsuario(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("usuarioId") ?? "");

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return { error: "Ese usuario ya no existe." };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;
  const rol = String(formData.get("rol") ?? "") as Rol;
  const brigadaId = String(formData.get("brigadaId") ?? "") || null;

  const error = await validarDatosUsuario(username, nombre, rol, id);
  if (error) return { error };

  // Un admin no puede degradarse a sí mismo: dejaría el sistema sin quien
  // administre las cuentas.
  if (usuario.id === admin.id && rol !== usuario.rol) {
    return { error: "No puedes cambiar tu propio rol." };
  }

  const cambios: Record<string, [unknown, unknown]> = {};
  if (usuario.username !== username) cambios.username = [usuario.username, username];
  if (usuario.nombre !== nombre) cambios.nombre = [usuario.nombre, nombre];
  if (usuario.rut !== rut) cambios.rut = [usuario.rut, rut];
  if (usuario.rol !== rol) cambios.rol = [usuario.rol, rol];
  if (usuario.brigadaId !== brigadaId) cambios.brigadaId = [usuario.brigadaId, brigadaId];

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.usuario.update({
    where: { id },
    data: { username, nombre, rut, rol, brigadaId },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: id,
    accion: "EDITADO",
    detalle: cambios,
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${username} actualizado.` };
}

export async function eliminarUsuario(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("usuarioId") ?? "");

  if (id === admin.id) return { error: "No puedes eliminar tu propia cuenta." };

  const usuario = await db.usuario.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          solicitudesCreadas: true,
          solicitudesAprobadas: true,
          solicitudesGestionadas: true,
          solicitudesEditadas: true,
          entregasRecibidas: true,
          entregasHechas: true,
          auditorias: true,
          brigadasSupervisadas: true,
        },
      },
    },
  });
  if (!usuario) return { error: "Ese usuario ya no existe." };

  // El historial (solicitudes, actas de entrega firmadas, auditoría) apunta al
  // usuario sin cascada. Borrarlo destruiría la trazabilidad, así que solo se
  // permite eliminar cuentas que nunca llegaron a operar.
  const vinculos = Object.values(usuario._count).reduce((a, b) => a + b, 0);
  if (vinculos > 0) {
    return {
      error:
        "Este usuario tiene historial en el sistema y no puede eliminarse. Desactívalo para revocarle el acceso.",
    };
  }

  await db.usuario.delete({ where: { id } });

  // La auditoría se registra a nombre del admin, así sobrevive al borrado.
  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: id,
    accion: "ELIMINADO",
    detalle: { username: usuario.username, nombre: usuario.nombre },
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${usuario.username} eliminado.` };
}

export async function alternarUsuario(formData: FormData) {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("usuarioId") ?? "");

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return;

  // Evita que el admin se desactive a sí mismo y quede fuera del sistema.
  if (usuario.id === admin.id) return;

  await db.usuario.update({
    where: { id },
    data: { activo: !usuario.activo },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: id,
    accion: usuario.activo ? "DESACTIVADO" : "ACTIVADO",
  });

  revalidatePath("/admin/usuarios");
}

export async function restablecerPassword(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("usuarioId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const usuario = await db.usuario.findUnique({ where: { id } });
  if (!usuario) return { error: "Ese usuario ya no existe." };

  await db.usuario.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: id,
    accion: "PASSWORD_RESTABLECIDA",
  });

  revalidatePath("/admin/usuarios");
  return { ok: `Contraseña de ${usuario.username} actualizada.` };
}

/**
 * Valida el nombre de la brigada. `idActual` excluye a la propia brigada de la
 * comprobación de unicidad al editar.
 */
async function validarNombreBrigada(
  nombre: string,
  idActual?: string,
): Promise<string | null> {
  if (nombre.length < 3) {
    return "El nombre de la brigada debe tener al menos 3 caracteres.";
  }

  const existente = await db.brigada.findUnique({ where: { nombre } });
  if (existente && existente.id !== idActual) {
    return "Ya existe una brigada con ese nombre.";
  }
  return null;
}

export async function crearBrigada(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;

  const error = await validarNombreBrigada(nombre);
  if (error) return { error };

  const brigada = await db.brigada.create({ data: { nombre, supervisorId } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Brigada",
    entidadId: brigada.id,
    accion: "CREADA",
    detalle: { nombre },
  });

  revalidatePath("/admin/brigadas");
  revalidatePath("/admin/usuarios");
  return { ok: `«${nombre}» creada.` };
}

export async function editarBrigada(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("brigadaId") ?? "");

  const brigada = await db.brigada.findUnique({ where: { id } });
  if (!brigada) return { error: "Esa brigada ya no existe." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;

  const error = await validarNombreBrigada(nombre, id);
  if (error) return { error };

  const cambios: Record<string, [unknown, unknown]> = {};
  if (brigada.nombre !== nombre) cambios.nombre = [brigada.nombre, nombre];
  if (brigada.supervisorId !== supervisorId) {
    cambios.supervisorId = [brigada.supervisorId, supervisorId];
  }

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.brigada.update({ where: { id }, data: { nombre, supervisorId } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Brigada",
    entidadId: id,
    accion: "EDITADA",
    detalle: cambios,
  });

  revalidatePath("/admin/brigadas");
  revalidatePath("/admin/usuarios");
  return { ok: `«${nombre}» actualizada.` };
}

export async function eliminarBrigada(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("brigadaId") ?? "");

  const brigada = await db.brigada.findUnique({
    where: { id },
    include: { _count: { select: { miembros: true, solicitudes: true } } },
  });
  if (!brigada) return { error: "Esa brigada ya no existe." };

  // Las solicitudes apuntan a la brigada sin cascada: borrarla dejaría el
  // historial huérfano. Los miembros deben reasignarse antes a mano.
  if (brigada._count.solicitudes > 0) {
    return {
      error:
        "Esta brigada tiene solicitudes asociadas y no puede eliminarse sin perder el historial.",
    };
  }
  if (brigada._count.miembros > 0) {
    return {
      error: `Esta brigada tiene ${brigada._count.miembros} miembro(s). Reasígnalos a otra brigada antes de eliminarla.`,
    };
  }

  await db.brigada.delete({ where: { id } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Brigada",
    entidadId: id,
    accion: "ELIMINADA",
    detalle: { nombre: brigada.nombre },
  });

  revalidatePath("/admin/brigadas");
  revalidatePath("/admin/usuarios");
  return { ok: `«${brigada.nombre}» eliminada.` };
}

export async function crearArticulo(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const gestor = await requerirRol(...ROLES_GESTION);

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "") as Categoria;
  const unidad = String(formData.get("unidad") ?? "unidad").trim() || "unidad";
  const requiereTalla = formData.get("requiereTalla") === "on";
  const vidaUtilBruta = String(formData.get("vidaUtilDias") ?? "").trim();

  if (!codigo) return { error: "Indica el código del artículo." };
  if (!nombre) return { error: "Indica el nombre del artículo." };
  if (categoria !== "EPP" && categoria !== "EQUIPAMIENTO") {
    return { error: "Selecciona una categoría válida." };
  }

  let vidaUtilDias: number | null = null;
  if (vidaUtilBruta) {
    const dias = Number(vidaUtilBruta);
    if (!Number.isInteger(dias) || dias <= 0) {
      return { error: "La vida útil debe ser un número entero de días." };
    }
    vidaUtilDias = dias;
  }

  const existente = await db.articulo.findUnique({ where: { codigo } });
  if (existente) return { error: "Ese código ya existe en el catálogo." };

  const articulo = await db.articulo.create({
    data: { codigo, nombre, categoria, unidad, requiereTalla, vidaUtilDias },
  });

  await registrarAuditoria({
    usuarioId: gestor.id,
    entidad: "Articulo",
    entidadId: articulo.id,
    accion: "CREADO",
    detalle: { codigo, nombre },
  });

  revalidatePath("/admin/articulos");
  return { ok: `Artículo ${codigo} agregado.` };
}

export async function alternarArticulo(formData: FormData) {
  const gestor = await requerirRol(...ROLES_GESTION);
  const id = String(formData.get("articuloId") ?? "");

  const articulo = await db.articulo.findUnique({ where: { id } });
  if (!articulo) return;

  await db.articulo.update({
    where: { id },
    data: { activo: !articulo.activo },
  });

  await registrarAuditoria({
    usuarioId: gestor.id,
    entidad: "Articulo",
    entidadId: id,
    accion: articulo.activo ? "DESACTIVADO" : "ACTIVADO",
  });

  revalidatePath("/admin/articulos");
}
