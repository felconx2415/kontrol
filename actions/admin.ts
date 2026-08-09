"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPassword, registrarAuditoria, requerirRol } from "@/lib/auth";
import {
  ETIQUETA_ROL,
  ROLES,
  ROLES_ADMIN,
  ROLES_GESTION,
} from "@/lib/solicitud-estado";
import { notificar } from "@/lib/notificaciones";
import type { Categoria, Rol, TipoBrigada } from "@/generated/prisma/enums";

export type EstadoAdmin = { error?: string; ok?: string };

/**
 * Empresa y alcance leídos del formulario de cuenta.
 *
 * La empresa propia dice a qué gente pertenece; las gestionadas, hasta dónde
 * llega si es gestor. Son dos cosas distintas y por eso se leen por separado:
 * un gestor de la empresa A puede atender A y B, o solo B.
 */
type EmpresasDeCuenta = {
  empresaId: string | null;
  empresasGestionadas: string[];
};

function leerEmpresas(formData: FormData, rol: Rol): EmpresasDeCuenta {
  return {
    empresaId: String(formData.get("empresaId") ?? "") || null,
    // Solo el gestor lleva varias; en el resto de los roles el campo ni se
    // muestra, y si llegara se ignora.
    empresasGestionadas:
      rol === "GESTOR"
        ? formData.getAll("empresasGestionadas").map(String).filter(Boolean)
        : [],
  };
}

/**
 * Valida los campos que comparten crear y editar. Devuelve el mensaje de error
 * o null si todo está bien. `idActual` excluye al propio usuario de la
 * comprobación de unicidad al editar.
 */
async function validarDatosUsuario(
  username: string,
  nombre: string,
  rol: Rol,
  empresas: EmpresasDeCuenta,
  brigadaId: string | null,
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

  // El ADMIN administra el sistema entero y no se circunscribe a ninguna
  // empresa. Todos los demás sí: sin empresa no verían absolutamente nada, que
  // es peor que no poder crear la cuenta.
  if (rol !== "ADMIN" && !empresas.empresaId) {
    return "Indica a qué empresa pertenece la cuenta.";
  }

  if (empresas.empresaId) {
    const empresa = await db.empresa.findUnique({
      where: { id: empresas.empresaId },
    });
    if (!empresa) return "Esa empresa ya no existe.";
  }

  if (empresas.empresasGestionadas.length > 0) {
    const encontradas = await db.empresa.count({
      where: { id: { in: empresas.empresasGestionadas } },
    });
    if (encontradas !== empresas.empresasGestionadas.length) {
      return "Alguna de las empresas a gestionar ya no existe.";
    }
  }

  // La brigada vive dentro de una empresa: cruzarlas dejaría al usuario en una
  // brigada que su propia gestión no ve.
  if (brigadaId) {
    const brigada = await db.brigada.findUnique({ where: { id: brigadaId } });
    if (!brigada) return "Esa brigada ya no existe.";
    if (empresas.empresaId && brigada.empresaId !== empresas.empresaId) {
      return "Esa brigada pertenece a otra empresa.";
    }
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
  const empresas = leerEmpresas(formData, rol);

  const error = await validarDatosUsuario(
    username,
    nombre,
    rol,
    empresas,
    brigadaId,
  );
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
      empresaId: empresas.empresaId,
      empresasGestionadas: {
        connect: empresas.empresasGestionadas.map((id) => ({ id })),
      },
      passwordHash: await hashPassword(password),
    },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: usuario.id,
    accion: "CREADO",
    detalle: {
      username,
      rol,
      empresaId: empresas.empresaId,
      ...(empresas.empresasGestionadas.length > 0
        ? { gestiona: empresas.empresasGestionadas }
        : {}),
    },
  });

  // Estrenar la cuenta con un aviso propio: la primera vez que entre ya tiene
  // algo en la campana que le explica qué es esto y qué puede hacer.
  await notificar({
    destinatarios: [usuario.id],
    tipo: "CUENTA_CREADA",
    titulo: "Tu cuenta de Kontrol está lista",
    cuerpo: `Ingresaste como ${ETIQUETA_ROL[rol].toLowerCase()}. Cambia tu contraseña en cuanto puedas.`,
    url: "/escritorio",
  });

  revalidatePath("/configuracion/usuarios");
  return { ok: `Usuario ${username} creado.` };
}

export async function editarUsuario(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("usuarioId") ?? "");

  const usuario = await db.usuario.findUnique({
    where: { id },
    include: { empresasGestionadas: { select: { id: true } } },
  });
  if (!usuario) return { error: "Ese usuario ya no existe." };

  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;
  const rol = String(formData.get("rol") ?? "") as Rol;
  const brigadaId = String(formData.get("brigadaId") ?? "") || null;
  const empresas = leerEmpresas(formData, rol);

  const error = await validarDatosUsuario(
    username,
    nombre,
    rol,
    empresas,
    brigadaId,
    id,
  );
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
  if (usuario.empresaId !== empresas.empresaId) {
    cambios.empresaId = [usuario.empresaId, empresas.empresaId];
  }

  // Las gestionadas se comparan como conjunto: el orden en que llegan del
  // formulario no significa nada.
  const gestionadasAntes = usuario.empresasGestionadas.map((e) => e.id).sort();
  const gestionadasAhora = [...empresas.empresasGestionadas].sort();
  if (gestionadasAntes.join() !== gestionadasAhora.join()) {
    cambios.empresasGestionadas = [gestionadasAntes, gestionadasAhora];
  }

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.usuario.update({
    where: { id },
    data: {
      username,
      nombre,
      rut,
      rol,
      brigadaId,
      empresaId: empresas.empresaId,
      // `set` y no `connect`: la lista del formulario es la definitiva, así que
      // quitar una empresa de la selección tiene que quitarla de verdad.
      empresasGestionadas: {
        set: empresas.empresasGestionadas.map((idEmpresa) => ({ id: idEmpresa })),
      },
    },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Usuario",
    entidadId: id,
    accion: "EDITADO",
    detalle: cambios,
  });

  revalidatePath("/configuracion/usuarios");
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

  revalidatePath("/configuracion/usuarios");
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

  revalidatePath("/configuracion/usuarios");
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

  revalidatePath("/configuracion/usuarios");
  return { ok: `Contraseña de ${usuario.username} actualizada.` };
}

/**
 * Valida nombre y empresa de la brigada. `idActual` excluye a la propia brigada
 * de la comprobación de unicidad al editar.
 *
 * El nombre es único dentro de la empresa y no en todo el sistema: dos empresas
 * pueden tener cada una su «Brigada Norte» sin pisarse.
 */
async function validarBrigada(
  nombre: string,
  empresaId: string,
  idActual?: string,
): Promise<string | null> {
  if (nombre.length < 3) {
    return "El nombre de la brigada debe tener al menos 3 caracteres.";
  }
  if (!empresaId) return "Indica a qué empresa pertenece la brigada.";

  const empresa = await db.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) return "Esa empresa ya no existe.";

  const existente = await db.brigada.findFirst({ where: { empresaId, nombre } });
  if (existente && existente.id !== idActual) {
    return `Ya existe una brigada «${nombre}» en ${empresa.nombre}.`;
  }
  return null;
}

/** Normaliza el tipo de brigada; cualquier valor inesperado cae en EMPRESA. */
function leerTipoBrigada(bruto: FormDataEntryValue | null): TipoBrigada {
  return String(bruto) === "CONTRATISTA" ? "CONTRATISTA" : "EMPRESA";
}

export async function crearBrigada(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const supervisorId = String(formData.get("supervisorId") ?? "") || null;
  const tipo = leerTipoBrigada(formData.get("tipo"));
  const empresaId = String(formData.get("empresaId") ?? "").trim();

  const error = await validarBrigada(nombre, empresaId);
  if (error) return { error };

  const brigada = await db.brigada.create({
    data: { nombre, tipo, supervisorId, empresaId },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Brigada",
    entidadId: brigada.id,
    accion: "CREADA",
    detalle: { nombre },
  });

  revalidatePath("/configuracion/brigadas");
  revalidatePath("/configuracion/usuarios");
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
  const tipo = leerTipoBrigada(formData.get("tipo"));
  const empresaId = String(formData.get("empresaId") ?? "").trim();

  const error = await validarBrigada(nombre, empresaId, id);
  if (error) return { error };

  // Mudar una brigada de empresa arrastraría a sus miembros y su historial a un
  // lado del que su propia gestión no los ve. Si de verdad hay que hacerlo, se
  // crea la brigada en la otra empresa y se reasigna a la gente a mano.
  if (brigada.empresaId !== empresaId) {
    const miembros = await db.usuario.count({ where: { brigadaId: id } });
    if (miembros > 0) {
      return {
        error: `«${brigada.nombre}» tiene ${miembros} miembro(s) y no puede cambiar de empresa. Reasígnalos primero.`,
      };
    }
  }

  const cambios: Record<string, [unknown, unknown]> = {};
  if (brigada.nombre !== nombre) cambios.nombre = [brigada.nombre, nombre];
  if (brigada.tipo !== tipo) cambios.tipo = [brigada.tipo, tipo];
  if (brigada.empresaId !== empresaId) {
    cambios.empresaId = [brigada.empresaId, empresaId];
  }
  if (brigada.supervisorId !== supervisorId) {
    cambios.supervisorId = [brigada.supervisorId, supervisorId];
  }

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.brigada.update({
    where: { id },
    data: { nombre, tipo, supervisorId, empresaId },
  });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Brigada",
    entidadId: id,
    accion: "EDITADA",
    detalle: cambios,
  });

  revalidatePath("/configuracion/brigadas");
  revalidatePath("/configuracion/usuarios");
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

  revalidatePath("/configuracion/brigadas");
  revalidatePath("/configuracion/usuarios");
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
  const ceco = String(formData.get("ceco") ?? "").trim() || null;
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
    data: { codigo, nombre, categoria, unidad, ceco, vidaUtilDias },
  });

  await registrarAuditoria({
    usuarioId: gestor.id,
    entidad: "Articulo",
    entidadId: articulo.id,
    accion: "CREADO",
    detalle: { codigo, nombre },
  });

  revalidatePath("/configuracion/catalogo");
  return { ok: `Artículo ${codigo} agregado.` };
}

export async function editarArticulo(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const gestor = await requerirRol(...ROLES_GESTION);
  const id = String(formData.get("articuloId") ?? "");

  const articulo = await db.articulo.findUnique({ where: { id } });
  if (!articulo) return { error: "Ese artículo ya no existe." };

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "") as Categoria;
  const unidad = String(formData.get("unidad") ?? "unidad").trim() || "unidad";
  const ceco = String(formData.get("ceco") ?? "").trim() || null;
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

  // El código es la clave única del catálogo: si cambia, no debe chocar con otro.
  if (codigo !== articulo.codigo) {
    const existente = await db.articulo.findUnique({ where: { codigo } });
    if (existente) return { error: "Ese código ya existe en el catálogo." };
  }

  const cambios: Record<string, [unknown, unknown]> = {};
  if (articulo.codigo !== codigo) cambios.codigo = [articulo.codigo, codigo];
  if (articulo.nombre !== nombre) cambios.nombre = [articulo.nombre, nombre];
  if (articulo.categoria !== categoria) cambios.categoria = [articulo.categoria, categoria];
  if (articulo.unidad !== unidad) cambios.unidad = [articulo.unidad, unidad];
  if (articulo.ceco !== ceco) cambios.ceco = [articulo.ceco, ceco];
  if (articulo.vidaUtilDias !== vidaUtilDias) {
    cambios.vidaUtilDias = [articulo.vidaUtilDias, vidaUtilDias];
  }

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.articulo.update({
    where: { id },
    data: { codigo, nombre, categoria, unidad, ceco, vidaUtilDias },
  });

  await registrarAuditoria({
    usuarioId: gestor.id,
    entidad: "Articulo",
    entidadId: id,
    accion: "EDITADO",
    detalle: cambios,
  });

  revalidatePath("/configuracion/catalogo");
  return { ok: `Artículo ${codigo} actualizado.` };
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

  revalidatePath("/configuracion/catalogo");
}

// ── Empresas ──────────────────────────────────────────────────────────────
// La empresa es la frontera del sistema: quien pertenece a una no ve lo de las
// otras. Administrarlas es solo del ADMIN, igual que las cuentas.

async function validarEmpresa(
  nombre: string,
  idActual?: string,
): Promise<string | null> {
  if (nombre.length < 2) {
    return "El nombre de la empresa debe tener al menos 2 caracteres.";
  }

  const existente = await db.empresa.findUnique({ where: { nombre } });
  if (existente && existente.id !== idActual) {
    return "Ya existe una empresa con ese nombre.";
  }
  return null;
}

export async function crearEmpresa(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;

  const error = await validarEmpresa(nombre);
  if (error) return { error };

  const empresa = await db.empresa.create({ data: { nombre, rut } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Empresa",
    entidadId: empresa.id,
    accion: "CREADA",
    detalle: { nombre },
  });

  revalidatePath("/configuracion/empresas");
  revalidatePath("/configuracion/usuarios");
  revalidatePath("/configuracion/brigadas");
  return { ok: `«${nombre}» creada. Ya puedes asignarle cuentas y brigadas.` };
}

export async function editarEmpresa(
  _estado: EstadoAdmin,
  formData: FormData,
): Promise<EstadoAdmin> {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("empresaId") ?? "");

  const empresa = await db.empresa.findUnique({ where: { id } });
  if (!empresa) return { error: "Esa empresa ya no existe." };

  const nombre = String(formData.get("nombre") ?? "").trim();
  const rut = String(formData.get("rut") ?? "").trim() || null;

  const error = await validarEmpresa(nombre, id);
  if (error) return { error };

  const cambios: Record<string, [unknown, unknown]> = {};
  if (empresa.nombre !== nombre) cambios.nombre = [empresa.nombre, nombre];
  if (empresa.rut !== rut) cambios.rut = [empresa.rut, rut];

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.empresa.update({ where: { id }, data: { nombre, rut } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Empresa",
    entidadId: id,
    accion: "EDITADA",
    detalle: cambios,
  });

  revalidatePath("/configuracion/empresas");
  revalidatePath("/configuracion/usuarios");
  revalidatePath("/configuracion/brigadas");
  return { ok: `«${nombre}» actualizada.` };
}

/**
 * Desactiva o reactiva una empresa. No se elimina: sus solicitudes, actas y
 * bodega apuntan a ella y borrarla dejaría el historial huérfano. Desactivada
 * sigue existiendo para el registro pero deja de ofrecerse al crear cuentas o
 * brigadas.
 */
export async function alternarEmpresa(formData: FormData) {
  const admin = await requerirRol(...ROLES_ADMIN);
  const id = String(formData.get("empresaId") ?? "");

  const empresa = await db.empresa.findUnique({ where: { id } });
  if (!empresa) return;

  await db.empresa.update({ where: { id }, data: { activa: !empresa.activa } });

  await registrarAuditoria({
    usuarioId: admin.id,
    entidad: "Empresa",
    entidadId: id,
    accion: empresa.activa ? "DESACTIVADA" : "ACTIVADA",
    detalle: { nombre: empresa.nombre },
  });

  revalidatePath("/configuracion/empresas");
  revalidatePath("/configuracion/usuarios");
  revalidatePath("/configuracion/brigadas");
}
