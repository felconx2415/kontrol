"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { registrarAuditoria, requerirRol } from "@/lib/auth";
import { alcanza, empresaParaCrear } from "@/lib/alcance";
import { destinatariosPorRol, notificar } from "@/lib/notificaciones";
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

  const empresa = empresaParaCrear(
    usuario.alcance,
    String(formData.get("empresaId") ?? ""),
  );
  if (empresa.error) return { error: empresa.error };

  // El código es único dentro de la bodega de cada empresa, no en todo el
  // sistema: el mismo artículo existe en varias a la vez.
  const existente = await db.itemBodega.findFirst({
    where: { empresaId: empresa.empresaId, codigo },
  });
  if (existente) return { error: "Ese código ya existe en la bodega." };

  const item = await db.itemBodega.create({
    data: {
      codigo,
      nombre,
      categoria,
      unidad,
      ubicacion,
      stock,
      empresaId: empresa.empresaId,
    },
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
  const empresa = empresaParaCrear(
    usuario.alcance,
    String(formData.get("empresaId") ?? ""),
  );
  if (empresa.error) return { error: empresa.error };

  const existente = await db.itemBodega.findFirst({
    where: { empresaId: empresa.empresaId, codigo: articulo.codigo },
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
      empresaId: empresa.empresaId,
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
  if (!alcanza(usuario.alcance, item.empresaId)) {
    return { error: "Ese ítem pertenece a la bodega de otra empresa." };
  }
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

/** Una línea del préstamo tal como llega del formulario. */
type LineaPrestamo = {
  itemId: string;
  cantidad: number;
  numeroSerie?: string | null;
};

/**
 * Registra un préstamo firmado con una o varias líneas.
 *
 * A una cuadrilla se le entregan varias cosas de una vez y firma una sola
 * acta; cuando el préstamo era de un ítem había que repetir el trámite —y la
 * firma— tantas veces como herramientas salieran.
 *
 * La firma de salida es obligatoria: es lo que convierte el registro en acta.
 */
export async function registrarPrestamo(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuario = await requerirRol(...ROLES_GESTION);

  const persona = String(formData.get("persona") ?? "").trim();
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const firma = bufferDesdeDataUrl(String(formData.get("firmaSalida") ?? ""));

  if (!persona) return { error: "Indica a quién se presta el material." };
  if (!firma) return { error: "Falta la firma de salida de quien recibe." };

  let lineas: LineaPrestamo[];
  try {
    const crudo = JSON.parse(String(formData.get("items") ?? "[]"));
    lineas = Array.isArray(crudo) ? crudo : [];
  } catch {
    return { error: "No se pudieron leer los ítems del préstamo." };
  }

  if (lineas.length === 0) return { error: "Agrega al menos un ítem al préstamo." };

  const ids = lineas.map((l) => String(l.itemId ?? ""));
  if (new Set(ids).size !== ids.length) {
    return { error: "Hay un ítem repetido. Súmalo en una sola línea." };
  }

  const items = await db.itemBodega.findMany({ where: { id: { in: ids } } });
  const porId = new Map(items.map((i) => [i.id, i]));

  const ajeno = items.find((i) => !alcanza(usuario.alcance, i.empresaId));
  if (ajeno) {
    return { error: `«${ajeno.nombre}» pertenece a la bodega de otra empresa.` };
  }

  // Se valida todo antes de tocar nada: un préstamo a medias dejaría stock
  // descontado sin registro que lo respalde.
  for (const linea of lineas) {
    const item = porId.get(linea.itemId);
    if (!item) return { error: "Uno de los ítems ya no existe en la bodega." };
    if (!item.activo) {
      return { error: `«${item.nombre}» está inactivo. Actívalo antes de prestarlo.` };
    }
    if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) {
      return { error: `Cantidad inválida para «${item.nombre}».` };
    }
    if (linea.cantidad > item.stock) {
      return {
        error: `No hay stock suficiente de «${item.nombre}»: quedan ${item.stock} ${item.unidad}(s).`,
      };
    }
  }

  const firmaSalidaUrl = await guardarImagen(firma, "image/png", "firmas");

  const prestamoId = await db.$transaction(async (tx) => {
    const prestamo = await tx.prestamo.create({
      data: { persona, notas, prestadoPorId: usuario.id, firmaSalidaUrl },
    });

    for (const linea of lineas) {
      const item = porId.get(linea.itemId)!;
      const stockResultante = item.stock - linea.cantidad;

      await tx.itemBodega.update({
        where: { id: item.id },
        data: { stock: stockResultante },
      });
      await tx.prestamoItem.create({
        data: {
          prestamoId: prestamo.id,
          itemId: item.id,
          cantidad: linea.cantidad,
          numeroSerie: String(linea.numeroSerie ?? "").trim() || null,
        },
      });
      await tx.movimientoBodega.create({
        data: {
          itemId: item.id,
          tipo: "PRESTAMO",
          cantidad: linea.cantidad,
          stockResultante,
          persona,
          notas,
          usuarioId: usuario.id,
          prestamoId: prestamo.id,
        },
      });
    }

    return prestamo.id;
  });

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Prestamo",
    entidadId: prestamoId,
    accion: "MOV_PRESTAMO",
    detalle: { persona, lineas: lineas.length },
  });

  // Al resto del equipo de bodega: el stock bajó y hay material afuera que
  // alguien tiene que ver volver. Quien lo registró no recibe nada.
  await notificar({
    destinatarios: await destinatariosPorRol(
      ["GESTOR", "ADMIN"],
      items[0]?.empresaId ?? null,
    ),
    tipo: "PRESTAMO_REGISTRADO",
    titulo: `Préstamo a ${persona}`,
    cuerpo: `${lineas.length} ítem${lineas.length === 1 ? "" : "s"} salieron de bodega y están pendientes de devolución.`,
    url: "/bodega?tab=prestamos",
    excluir: usuario.id,
  });

  await dejarAviso(
    lineas.length === 1
      ? `Préstamo a ${persona} registrado con firma.`
      : `Préstamo de ${lineas.length} ítems a ${persona} registrado con firma.`,
  );
  revalidatePath("/bodega");
  // Se vuelve a la bodega con el acta recién firmada en primer plano: el
  // respaldo de la entrega se necesita en ese momento, no cuando alguien se
  // acuerde de buscarlo en la tabla.
  redirect(`/bodega?tab=prestamos&acta=${prestamoId}`);
}

/** Cómo vuelve cada línea, tal como llega del formulario de devolución. */
type LineaDevolucion = {
  lineaId: string;
  estado: "BUENO" | "DANADO" | "PERDIDO";
  observacion?: string | null;
  fotos?: string[];
};

/**
 * Registra la devolución firmada de un préstamo, línea por línea.
 *
 * Cada ítem se recibe con su propio estado, porque es lo que se comprueba al
 * revisarlos: uno puede volver intacto y el de al lado roto. Lo que vuelve
 * —bien o dañado— repone stock; lo que se declara perdido no, porque
 * físicamente no está.
 *
 * Se devuelve el préstamo completo en un acto: así la firma de quien entrega
 * corresponde sin ambigüedad a todo lo que se está recibiendo.
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

  let devoluciones: LineaDevolucion[];
  try {
    const crudo = JSON.parse(String(formData.get("devoluciones") ?? "[]"));
    devoluciones = Array.isArray(crudo) ? crudo : [];
  } catch {
    return { error: "No se pudo leer el estado de los ítems devueltos." };
  }

  const prestamo = await db.prestamo.findUnique({
    where: { id: prestamoId },
    include: { items: { include: { item: true } } },
  });
  if (!prestamo || prestamo.estado !== "ACTIVO") {
    return { error: "Ese préstamo ya no está activo." };
  }
  // El préstamo llega a la empresa por los ítems que salieron.
  if (!prestamo.items.some((l) => alcanza(usuario.alcance, l.item.empresaId))) {
    return { error: "Ese préstamo es de la bodega de otra empresa." };
  }

  const pendientes = prestamo.items.filter((l) => l.devueltoEn === null);
  const porLinea = new Map(devoluciones.map((d) => [d.lineaId, d]));

  const ESTADOS = ["BUENO", "DANADO", "PERDIDO"] as const;
  for (const linea of pendientes) {
    const dev = porLinea.get(linea.id);
    if (!dev) {
      return { error: `Falta indicar cómo volvió «${linea.item.nombre}».` };
    }
    if (!ESTADOS.includes(dev.estado)) {
      return { error: `Estado inválido para «${linea.item.nombre}».` };
    }
    if (dev.estado !== "BUENO" && !String(dev.observacion ?? "").trim()) {
      return {
        error: `Describe qué pasó con «${linea.item.nombre}»: no volvió en buen estado.`,
      };
    }
  }

  const firmaDevolucionUrl = await guardarImagen(firma, "image/png", "firmas");
  const ahora = new Date();

  await db.$transaction(async (tx) => {
    for (const linea of pendientes) {
      const dev = porLinea.get(linea.id)!;
      const fotos = (dev.fotos ?? []).filter((u) => typeof u === "string");

      await tx.prestamoItem.update({
        where: { id: linea.id },
        data: {
          devueltoEn: ahora,
          estadoDevolucion: dev.estado,
          observacion: String(dev.observacion ?? "").trim() || null,
          fotos: fotos.length > 0 ? JSON.stringify(fotos) : null,
        },
      });

      // Lo perdido no vuelve al stock: no está.
      if (dev.estado === "PERDIDO") continue;

      const actual = await tx.itemBodega.findUnique({ where: { id: linea.itemId } });
      const stockResultante = (actual?.stock ?? 0) + linea.cantidad;

      await tx.itemBodega.update({
        where: { id: linea.itemId },
        data: { stock: stockResultante },
      });
      await tx.movimientoBodega.create({
        data: {
          itemId: linea.itemId,
          tipo: "DEVOLUCION",
          cantidad: linea.cantidad,
          stockResultante,
          persona: prestamo.persona,
          notas:
            dev.estado === "DANADO"
              ? `Devuelto con daños: ${String(dev.observacion ?? "").trim()}`
              : observaciones,
          usuarioId: usuario.id,
          prestamoId: prestamo.id,
        },
      });
    }

    await tx.prestamo.update({
      where: { id: prestamo.id },
      data: {
        estado: "DEVUELTO",
        devueltoEn: ahora,
        firmaDevolucionUrl,
        observacionesDevolucion: observaciones,
      },
    });
  });

  const conNovedad = pendientes.filter(
    (l) => porLinea.get(l.id)!.estado !== "BUENO",
  ).length;

  await registrarAuditoria({
    usuarioId: usuario.id,
    entidad: "Prestamo",
    entidadId: prestamo.id,
    accion: "MOV_DEVOLUCION",
    detalle: { persona: prestamo.persona, lineas: pendientes.length, conNovedad },
  });

  // Lo que volvió con daño o no volvió es lo que el resto del equipo necesita
  // saber: hay que revisarlo antes de volver a prestarlo.
  await notificar({
    destinatarios: await destinatariosPorRol(
      ["GESTOR", "ADMIN"],
      prestamo.items[0]?.item.empresaId ?? null,
    ),
    tipo: "PRESTAMO_DEVUELTO",
    titulo: `Devolución de ${prestamo.persona}`,
    cuerpo:
      conNovedad > 0
        ? `${conNovedad} ítem${conNovedad === 1 ? "" : "s"} volvió con novedad: revísalo antes de volver a prestarlo.`
        : "Todo volvió en buen estado y se repuso el stock.",
    url: "/bodega?tab=prestamos",
    excluir: usuario.id,
  });

  await dejarAviso(
    conNovedad > 0
      ? `Devolución registrada con firma. ${conNovedad} ítem${
          conNovedad === 1 ? "" : "s"
        } volvió con novedad.`
      : "Devolución registrada con firma.",
  );
  revalidatePath("/bodega");
  redirect(`/bodega?tab=prestamos&acta=${prestamo.id}`);
}

/** Una línea de la asignación tal como llega del formulario. */
type LineaAsignacion = {
  itemId: string;
  cantidad: number;
  numeroSerie?: string | null;
};

/**
 * Asigna equipamiento de bodega a un usuario del sistema como entrega
 * definitiva: descuenta el stock y deja el registro a nombre del usuario (que
 * lo verá en «Mi equipamiento»). No vuelve a la bodega.
 *
 * Admite varias líneas por la misma razón que el préstamo: a quien se le
 * habilita se le entrega casco, guantes y linterna en el mismo acto y firma
 * una sola acta; una asignación por ítem obligaba a repetir el trámite —y la
 * firma— tantas veces como cosas se entregaran.
 */
export async function asignarItemBodega(
  _estado: EstadoBodega,
  formData: FormData,
): Promise<EstadoBodega> {
  const usuarioActual = await requerirRol(...ROLES_GESTION);

  const usuarioId = String(formData.get("usuarioId") ?? "");
  const notas = String(formData.get("notas") ?? "").trim() || null;
  const firma = bufferDesdeDataUrl(String(formData.get("firma") ?? ""));

  // La asignación es una entrega definitiva: sale de bodega y queda a nombre
  // de la persona, así que se firma igual que un préstamo.
  if (!firma) return { error: "Falta la firma de quien recibe el equipamiento." };

  let lineas: LineaAsignacion[];
  try {
    const crudo = JSON.parse(String(formData.get("items") ?? "[]"));
    lineas = Array.isArray(crudo) ? crudo : [];
  } catch {
    return { error: "No se pudieron leer los ítems de la entrega." };
  }

  if (lineas.length === 0) return { error: "Agrega al menos un ítem a la entrega." };

  const ids = lineas.map((l) => String(l.itemId ?? ""));
  if (new Set(ids).size !== ids.length) {
    return { error: "Hay un ítem repetido. Súmalo en una sola línea." };
  }

  const [items, usuario] = await Promise.all([
    db.itemBodega.findMany({ where: { id: { in: ids } } }),
    db.usuario.findUnique({ where: { id: usuarioId } }),
  ]);
  const porId = new Map(items.map((i) => [i.id, i]));

  if (!usuario || !usuario.activo) return { error: "Elige un usuario válido." };
  // El equipamiento sale de la bodega de una empresa y queda a nombre de
  // alguien: ese alguien tiene que ser de una empresa que se alcance.
  if (!alcanza(usuarioActual.alcance, usuario.empresaId)) {
    return { error: "Esa persona no pertenece a ninguna de las empresas que gestionas." };
  }

  const ajeno = items.find((i) => !alcanza(usuarioActual.alcance, i.empresaId));
  if (ajeno) {
    return { error: `«${ajeno.nombre}» pertenece a la bodega de otra empresa.` };
  }

  // Se valida todo antes de tocar nada: una entrega a medias dejaría stock
  // descontado sin acta que lo respalde.
  for (const linea of lineas) {
    const item = porId.get(linea.itemId);
    if (!item) return { error: "Uno de los ítems ya no existe en la bodega." };
    if (!item.activo) {
      return { error: `«${item.nombre}» está inactivo. Actívalo antes de asignarlo.` };
    }
    if (!Number.isInteger(linea.cantidad) || linea.cantidad < 1) {
      return { error: `Cantidad inválida para «${item.nombre}».` };
    }
    if (linea.cantidad > item.stock) {
      return {
        error: `No hay stock suficiente de «${item.nombre}»: quedan ${item.stock} ${item.unidad}(s).`,
      };
    }
  }

  const firmaPngUrl = await guardarImagen(firma, "image/png", "firmas");

  const asignacionId = await db.$transaction(async (tx) => {
    const asignacion = await tx.asignacionBodega.create({
      data: {
        usuarioId: usuario.id,
        notas,
        asignadoPorId: usuarioActual.id,
        firmaPngUrl,
      },
    });

    for (const linea of lineas) {
      const item = porId.get(linea.itemId)!;
      const stockResultante = item.stock - linea.cantidad;

      await tx.itemBodega.update({
        where: { id: item.id },
        data: { stock: stockResultante },
      });
      await tx.asignacionItem.create({
        data: {
          asignacionId: asignacion.id,
          itemId: item.id,
          cantidad: linea.cantidad,
          numeroSerie: String(linea.numeroSerie ?? "").trim() || null,
        },
      });
      await tx.movimientoBodega.create({
        data: {
          itemId: item.id,
          tipo: "ASIGNACION",
          cantidad: linea.cantidad,
          stockResultante,
          persona: usuario.nombre,
          notas,
          usuarioId: usuarioActual.id,
        },
      });
    }

    return asignacion.id;
  });

  await registrarAuditoria({
    usuarioId: usuarioActual.id,
    entidad: "AsignacionBodega",
    entidadId: asignacionId,
    accion: "MOV_ASIGNACION",
    detalle: { usuarioId: usuario.id, usuario: usuario.nombre, lineas: lineas.length },
  });

  const primero = porId.get(lineas[0].itemId)!;
  const resumen =
    lineas.length === 1
      ? `${lineas[0].cantidad} ${primero.unidad}(s) de «${primero.nombre}»`
      : `${lineas.length} ítems`;

  // A quien recibió: el equipamiento quedó a su nombre y su acta ya existe.
  await notificar({
    destinatarios: [usuario.id],
    tipo: "BODEGA_ASIGNACION",
    titulo:
      lineas.length === 1
        ? `Te asignaron ${primero.nombre}`
        : `Te asignaron ${lineas.length} ítems de bodega`,
    cuerpo: `${resumen} desde bodega. El acta firmada está en tus documentos.`,
    url: "/documentos",
    excluir: usuarioActual.id,
  });

  await dejarAviso(`Asignados ${resumen} a ${usuario.nombre} con firma.`);
  revalidatePath("/bodega");
  for (const linea of lineas) revalidatePath(`/bodega/${linea.itemId}`);
  revalidatePath(`/historial/${usuario.id}`);
  // Igual que en el préstamo: el respaldo de la entrega se ofrece al entregar.
  redirect(`/bodega?asignacion=${asignacionId}`);
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
  if (!alcanza(usuario.alcance, item.empresaId)) {
    return { error: "Ese ítem pertenece a la bodega de otra empresa." };
  }

  const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim() || "General";
  const unidad = String(formData.get("unidad") ?? "unidad").trim() || "unidad";
  const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;
  const notas = String(formData.get("notas") ?? "").trim() || null;

  if (!codigo) return { error: "Indica el código del ítem." };
  if (!nombre) return { error: "Indica el nombre del ítem." };

  if (codigo !== item.codigo) {
    const existente = await db.itemBodega.findFirst({
      where: { empresaId: item.empresaId, codigo },
    });
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
  if (!alcanza(usuario.alcance, item.empresaId)) return;

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
