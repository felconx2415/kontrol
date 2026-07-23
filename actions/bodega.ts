"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirRol } from "@/lib/auth";
import { bufferDesdeDataUrl, guardarImagen } from "@/lib/archivos";
import { dejarAviso } from "@/lib/avisos";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { REQUIERE_PERSONA, TIPOS_MOVIMIENTO_MANUAL } from "@/lib/bodega";
import type { TipoMovimiento } from "@/generated/prisma/enums";

export type EstadoBodega = { error?: string; ok?: string };

/** Lee un entero > 0 (o >= 0 si `permiteCero`) desde el FormData. */
function leerCantidad(bruta: string, permiteCero = false): number | null {
  const n = Number(bruta);
  if (!Number.isInteger(n)) return null;
  if (permiteCero ? n < 0 : n <= 0) return null;
  return n;
}

export async function crearItemBodega(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || "General";
  const unidad = String(formData.get("unidad") ?? "unidad").trim() || "unidad";
  const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;
  const stockBruto = String(formData.get("stock") ?? "0").trim();

  if (!codigo) return { error: "Indica el código del ítem." };
  if (!nombre) return { error: "Indica el nombre del ítem." };

  const stock = leerCantidad(stockBruto || "0", true);
  if (stock === null) {
    return { error: "El stock inicial debe ser un número entero de 0 o más." };
  }

  const existente = await db.itemBodega.findUnique({ where: { codigo } });
  if (existente) return { error: "Ese código ya existe en la bodega." };

  const item = await db.itemBodega.create({
    data: { codigo, nombre, categoria, unidad, ubicacion, stock },
  });

  // El stock inicial queda como primer movimiento, para que la historia del
  // ítem parta desde cero y cuadre con las entradas y salidas posteriores.
  if (stock > 0) {
    await db.movimientoBodega.create({
      data: {
        itemId: item.id,
        tipo: "ENTRADA",
        cantidad: stock,
        stockResultante: stock,
        notas: "Stock inicial",
        usuarioId: usuario.id,
      },
    });
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: item.id,
    accion: "CREADO",
    detalle: { codigo, nombre, stock },
  });

  revalidatePath("/bodega");
  return { ok: `«${nombre}» agregado a la bodega.` };
}

/**
 * Agrega a la bodega un ítem tomado del catálogo de artículos: copia código,
 * nombre, categoría y unidad del artículo, y solo pide stock inicial y
 * ubicación. Así no hay que tipear todo a mano.
 */
export async function crearItemBodegaDesdeCatalogo(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const articuloId = String(formData.get("articuloId") ?? "");
  const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;
  const stock = leerCantidad(String(formData.get("stock") ?? "0").trim() || "0", true);

  if (!articuloId) return { error: "Elige un artículo del catálogo." };
  if (stock === null) {
    return { error: "El stock inicial debe ser un número entero de 0 o más." };
  }

  const articulo = await db.articulo.findUnique({ where: { id: articuloId } });
  if (!articulo || !articulo.activo) {
    return { error: "Ese artículo del catálogo ya no está disponible." };
  }

  // El código del artículo es la clave del ítem de bodega: si ya está, no se
  // duplica.
  const existente = await db.itemBodega.findUnique({
    where: { codigo: articulo.codigo },
  });
  if (existente) {
    return { error: `«${articulo.nombre}» (${articulo.codigo}) ya está en la bodega.` };
  }

  const item = await db.itemBodega.create({
    data: {
      codigo: articulo.codigo,
      nombre: articulo.nombre,
      categoria: articulo.categoria === "EPP" ? "EPP" : "Equipamiento",
      unidad: articulo.unidad,
      ubicacion,
      stock,
    },
  });

  if (stock > 0) {
    await db.movimientoBodega.create({
      data: {
        itemId: item.id,
        tipo: "ENTRADA",
        cantidad: stock,
        stockResultante: stock,
        notas: "Stock inicial (desde catálogo)",
        usuarioId: usuario.id,
      },
    });
  }

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: item.id,
    accion: "CREADO_DESDE_CATALOGO",
    detalle: { codigo: articulo.codigo, nombre: articulo.nombre, stock, articuloId },
  });

  revalidatePath("/bodega");
  return { ok: `«${articulo.nombre}» agregado a la bodega.` };
}

export async function registrarMovimiento(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const itemId = String(formData.get("itemId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoMovimiento;
  const cantidad = leerCantidad(String(formData.get("cantidad") ?? ""), tipo === "AJUSTE");
  const persona = String(formData.get("persona") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!TIPOS_MOVIMIENTO_MANUAL.includes(tipo)) {
    return { error: "Selecciona un tipo de movimiento válido." };
  }
  if (cantidad === null) {
    return {
      error:
        tipo === "AJUSTE"
          ? "El nuevo stock debe ser un número entero de 0 o más."
          : "La cantidad debe ser un número entero mayor que 0.",
    };
  }
  if (REQUIERE_PERSONA.includes(tipo) && !persona) {
    return { error: "Indica a quién se entrega el material." };
  }

  const item = await db.itemBodega.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ese ítem ya no existe en la bodega." };
  if (!item.activo) return { error: "Ese ítem está inactivo. Actívalo antes de moverlo." };

  // Calcula el stock resultante y valida que no quede negativo.
  let stockResultante: number;
  switch (tipo) {
    case "ENTRADA":
      stockResultante = item.stock + cantidad;
      break;
    case "SALIDA":
      if (cantidad > item.stock) {
        return {
          error: `No hay stock suficiente: quedan ${item.stock} ${item.unidad}(s) de «${item.nombre}».`,
        };
      }
      stockResultante = item.stock - cantidad;
      break;
    case "AJUSTE":
      stockResultante = cantidad; // el ajuste fija un valor absoluto
      break;
    default:
      return { error: "Tipo de movimiento no soportado." };
  }

  await db.$transaction(async (tx) => {
    await tx.itemBodega.update({
      where: { id: item.id },
      data: { stock: stockResultante },
    });

    await tx.movimientoBodega.create({
      data: {
        itemId: item.id,
        tipo,
        cantidad,
        stockResultante,
        persona,
        notas,
        usuarioId: usuario.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: item.id,
    accion: `MOV_${tipo}`,
    detalle: { cantidad, persona, stockResultante },
  });

  revalidatePath("/bodega");
  revalidatePath(`/bodega/${item.id}`);

  const mensajes: Record<TipoMovimiento, string> = {
    ENTRADA: `Ingresaron ${cantidad} ${item.unidad}(s) de «${item.nombre}».`,
    SALIDA: `Salieron ${cantidad} ${item.unidad}(s) de «${item.nombre}».`,
    PRESTAMO: `Prestadas ${cantidad} ${item.unidad}(s) de «${item.nombre}» a ${persona}.`,
    DEVOLUCION: `Devueltas ${cantidad} ${item.unidad}(s) de «${item.nombre}».`,
    AJUSTE: `Stock de «${item.nombre}» ajustado a ${stockResultante} ${item.unidad}(s).`,
    ASIGNACION: `Asignadas ${cantidad} ${item.unidad}(s) de «${item.nombre}».`,
  };
  return { ok: mensajes[tipo] };
}

/**
 * Registra un préstamo firmado: descuenta stock, crea el préstamo con su firma
 * de salida y deja el movimiento. La firma es obligatoria (acta de salida).
 */
export async function registrarPrestamo(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const itemId = String(formData.get("itemId") ?? "");
  const cantidad = leerCantidad(String(formData.get("cantidad") ?? ""));
  const persona = String(formData.get("persona") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const firma = bufferDesdeDataUrl(String(formData.get("firmaSalida") ?? ""));

  if (cantidad === null) {
    return { error: "La cantidad debe ser un número entero mayor que 0." };
  }
  if (!persona) return { error: "Indica a quién se presta el material." };
  if (!firma) return { error: "Falta la firma de salida de quien recibe." };

  const item = await db.itemBodega.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ese ítem ya no existe en la bodega." };
  if (!item.activo) return { error: "Ese ítem está inactivo. Actívalo antes de prestarlo." };
  if (cantidad > item.stock) {
    return {
      error: `No hay stock suficiente: quedan ${item.stock} ${item.unidad}(s) de «${item.nombre}».`,
    };
  }

  const firmaSalidaUrl = await guardarImagen(firma, "image/png", "firmas");
  const stockResultante = item.stock - cantidad;

  await db.$transaction(async (tx) => {
    await tx.itemBodega.update({
      where: { id: item.id },
      data: { stock: stockResultante },
    });
    const prestamo = await tx.prestamo.create({
      data: {
        itemId: item.id,
        cantidad,
        persona,
        notas,
        prestadoPorId: usuario.id,
        firmaSalidaUrl,
      },
    });
    await tx.movimientoBodega.create({
      data: {
        itemId: item.id,
        tipo: "PRESTAMO",
        cantidad,
        stockResultante,
        persona,
        notas,
        usuarioId: usuario.id,
        prestamoId: prestamo.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: item.id,
    accion: "MOV_PRESTAMO",
    detalle: { cantidad, persona, stockResultante },
  });

  await dejarAviso(
    `Préstamo de «${item.nombre}» a ${persona} registrado con firma.`,
  );
  revalidatePath("/bodega");
  revalidatePath(`/bodega/${item.id}`);
  redirect("/bodega");
}

/**
 * Registra la devolución firmada de un préstamo: repone stock, guarda la firma
 * de entrega, las observaciones y las fotos de daños (si las hay).
 */
export async function devolverPrestamo(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const prestamoId = String(formData.get("prestamoId") ?? "");
  const observaciones = String(formData.get("observaciones") ?? "").trim() || null;
  const firma = bufferDesdeDataUrl(String(formData.get("firmaDevolucion") ?? ""));

  if (!firma) return { error: "Falta la firma de entrega de quien devuelve." };

  let fotos: string[] = [];
  try {
    const leido = JSON.parse(String(formData.get("fotos") ?? "[]"));
    if (Array.isArray(leido)) fotos = leido.filter((u) => typeof u === "string");
  } catch {
    // Fotos ilegibles: se ignoran, no deben bloquear la devolución.
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { item: true },
  });
  if (!prestamo || prestamo.estado !== "ACTIVO") {
    return { error: "Ese préstamo ya no está activo." };
  }

  const firmaDevolucionUrl = await guardarImagen(firma, "image/png", "firmas");
  const stockResultante = prestamo.item.stock + prestamo.cantidad;

  await db.$transaction(async (tx) => {
    await tx.itemBodega.update({
      where: { id: prestamo.itemId },
      data: { stock: stockResultante },
    });
    await tx.prestamo.update({
      where: { id: prestamo.id },
      data: {
        estado: "DEVUELTO",
        devueltoEn: new Date(),
        firmaDevolucionUrl,
        observacionesDevolucion: observaciones,
        fotosDevolucion: fotos.length > 0 ? JSON.stringify(fotos) : null,
      },
    });
    await tx.movimientoBodega.create({
      data: {
        itemId: prestamo.itemId,
        tipo: "DEVOLUCION",
        cantidad: prestamo.cantidad,
        stockResultante,
        persona: prestamo.persona,
        notas: observaciones,
        usuarioId: usuario.id,
        prestamoId: prestamo.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: prestamo.itemId,
    accion: "MOV_DEVOLUCION",
    detalle: {
      prestamoId: prestamo.id,
      cantidad: prestamo.cantidad,
      persona: prestamo.persona,
      fotos: fotos.length,
    },
  });

  await dejarAviso(`Devolución de «${prestamo.item.nombre}» registrada con firma.`);
  revalidatePath("/bodega");
  revalidatePath(`/bodega/${prestamo.itemId}`);
  redirect("/bodega");
}

/**
 * Asigna equipamiento de bodega a un usuario del sistema como entrega
 * definitiva: descuenta el stock y deja el registro a nombre del usuario (que
 * lo verá en «Mi equipamiento»). No vuelve a la bodega.
 */
export async function asignarItemBodega(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuarioActual = await requerirRol(...ROLES_GESTION);

  const itemId = String(formData.get("itemId") ?? "");
  const usuarioId = String(formData.get("usuarioId") ?? "");
  const cantidad = leerCantidad(String(formData.get("cantidad") ?? ""));
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (cantidad === null) {
    return { error: "La cantidad debe ser un número entero mayor que 0." };
  }

  const [item, usuario] = await Promise.all([
    db.itemBodega.findUnique({ where: { id: itemId } }),
    db.usuario.findUnique({ where: { id: usuarioId } }),
  ]);

  if (!item) return { error: "Ese ítem ya no existe en la bodega." };
  if (!item.activo) return { error: "Ese ítem está inactivo. Actívalo antes de asignarlo." };
  if (!usuario || !usuario.activo) return { error: "Elige un usuario válido." };
  if (cantidad > item.stock) {
    return {
      error: `No hay stock suficiente: quedan ${item.stock} ${item.unidad}(s) de «${item.nombre}».`,
    };
  }

  const stockResultante = item.stock - cantidad;

  await db.$transaction(async (tx) => {
    await tx.itemBodega.update({
      where: { id: item.id },
      data: { stock: stockResultante },
    });
    await tx.asignacionBodega.create({
      data: {
        itemId: item.id,
        usuarioId: usuario.id,
        cantidad,
        notas,
        asignadoPorId: usuarioActual.id,
      },
    });
    await tx.movimientoBodega.create({
      data: {
        itemId: item.id,
        tipo: "ASIGNACION",
        cantidad,
        stockResultante,
        persona: usuario.nombre,
        notas,
        usuarioId: usuarioActual.id,
      },
    });
  });

  await registrarAuditoria({
    usuarioId: usuarioActual.id,
    entidad: "ItemBodega",
    entidadId: item.id,
    accion: "MOV_ASIGNACION",
    detalle: { cantidad, usuarioId: usuario.id, usuario: usuario.nombre, stockResultante },
  });

  await dejarAviso(
    `Asignadas ${cantidad} ${item.unidad}(s) de «${item.nombre}» a ${usuario.nombre}.`,
  );
  revalidatePath("/bodega");
  revalidatePath(`/bodega/${item.id}`);
  redirect("/bodega");
}

/**
 * Edita los datos de un ítem de bodega (no el stock: eso cambia por
 * movimientos). El código sigue siendo único.
 */
export async function editarItemBodega(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);
  const id = String(formData.get("itemId") ?? "");

  const item = await db.itemBodega.findUnique({ where: { id } });
  if (!item) return { error: "Ese ítem ya no existe en la bodega." };

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || "General";
  const unidad = String(formData.get("unidad") ?? "unidad").trim() || "unidad";
  const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!codigo) return { error: "Indica el código del ítem." };
  if (!nombre) return { error: "Indica el nombre del ítem." };

  if (codigo !== item.codigo) {
    const existente = await db.itemBodega.findUnique({ where: { codigo } });
    if (existente) return { error: "Ese código ya existe en la bodega." };
  }

  const cambios: Record<string, [unknown, unknown]> = {};
  if (item.codigo !== codigo) cambios.codigo = [item.codigo, codigo];
  if (item.nombre !== nombre) cambios.nombre = [item.nombre, nombre];
  if (item.categoria !== categoria) cambios.categoria = [item.categoria, categoria];
  if (item.unidad !== unidad) cambios.unidad = [item.unidad, unidad];
  if (item.ubicacion !== ubicacion) cambios.ubicacion = [item.ubicacion, ubicacion];
  if (item.notas !== notas) cambios.notas = [item.notas, notas];

  if (Object.keys(cambios).length === 0) return { ok: "Sin cambios que guardar." };

  await db.itemBodega.update({
    where: { id },
    data: { codigo, nombre, categoria, unidad, ubicacion, notas },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: id,
    accion: "EDITADO",
    detalle: cambios,
  });

  revalidatePath("/bodega");
  revalidatePath(`/bodega/${id}`);
  return { ok: `«${nombre}» actualizado.` };
}

export async function alternarItemBodega(formData: FormData) {
  const usuario = await requerirRol(...ROLES_GESTION);
  const id = String(formData.get("itemId") ?? "");

  const item = await db.itemBodega.findUnique({ where: { id } });
  if (!item) return;

  await db.itemBodega.update({
    where: { id },
    data: { activo: !item.activo },
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "ItemBodega",
    entidadId: id,
    accion: item.activo ? "DESACTIVADO" : "ACTIVADO",
  });

  revalidatePath("/bodega");
}
