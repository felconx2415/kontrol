import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { conToken, error, iso } from "@/lib/api-respuesta";
import { formatearFolio } from "@/lib/folio";

type Contexto = { params: Promise<{ id: string }> };

/**
 * Detalle de una solicitud: sus ítems con la reserva de cada línea, y la
 * entrega si ya ocurrió.
 *
 * Se busca **dentro** del alcance del token, no se busca y luego se comprueba:
 * fuera de su empresa, la solicitud sencillamente no existe, y así el 404 no
 * delata cuáles hay.
 */
export const GET = conToken<Contexto>(async (_request, llamante, { params }) => {
  const { id } = await params;

  const solicitud = await db.solicitud.findFirst({
    where: { ...filtroEmpresa(llamante.alcance), id },
    select: {
      id: true,
      folio: true,
      tipo: true,
      estado: true,
      justificacion: true,
      motivoRechazo: true,
      creadaEn: true,
      enviadaEn: true,
      aprobadaEn: true,
      reservaSolicitadaEn: true,
      enGestionEn: true,
      recibidaEn: true,
      canceladaEn: true,
      solicitante: { select: { id: true, nombre: true, rut: true } },
      creadaPor: { select: { id: true, nombre: true } },
      aprobador: { select: { id: true, nombre: true } },
      gestor: { select: { id: true, nombre: true } },
      brigada: { select: { id: true, nombre: true, tipo: true } },
      empresa: { select: { id: true, nombre: true } },
      items: {
        select: {
          id: true,
          cantidad: true,
          cantidadRecibida: true,
          numeroReserva: true,
          posicionReserva: true,
          motivo: true,
          detalleReemplazo: true,
          articulo: {
            select: {
              codigo: true,
              nombre: true,
              categoria: true,
              unidad: true,
              ceco: true,
            },
          },
          entregaItem: {
            select: {
              cantidadEntregada: true,
              numeroSerie: true,
              venceEn: true,
              reemplazadoEn: true,
            },
          },
        },
      },
      entrega: {
        select: {
          entregadaEn: true,
          observaciones: true,
          receptor: { select: { id: true, nombre: true, rut: true } },
          entregadoPor: { select: { id: true, nombre: true } },
          recibidoPor: { select: { id: true, nombre: true, rut: true } },
          recibidoPorNombre: true,
          recibidoPorRut: true,
        },
      },
    },
  });

  if (!solicitud) return error("No se encontró esa solicitud.", 404);

  // Quien retiró de verdad, cuando no fue el destinatario: con cuenta sale de
  // la relación, sin cuenta del nombre anotado a mano.
  const entrega = solicitud.entrega;
  const retiro = entrega?.recibidoPor
    ? { nombre: entrega.recibidoPor.nombre, rut: entrega.recibidoPor.rut }
    : entrega?.recibidoPorNombre
      ? { nombre: entrega.recibidoPorNombre, rut: entrega.recibidoPorRut }
      : null;

  return NextResponse.json({
    id: solicitud.id,
    folio: formatearFolio(solicitud.folio),
    tipo: solicitud.tipo,
    estado: solicitud.estado,
    justificacion: solicitud.justificacion,
    motivoRechazo: solicitud.motivoRechazo,
    solicitante: solicitud.solicitante,
    registradaPor: solicitud.creadaPor,
    aprobador: solicitud.aprobador,
    gestor: solicitud.gestor,
    brigada: solicitud.brigada,
    empresa: solicitud.empresa,
    fechas: {
      creada: iso(solicitud.creadaEn),
      enviada: iso(solicitud.enviadaEn),
      aprobada: iso(solicitud.aprobadaEn),
      reservaSolicitada: iso(solicitud.reservaSolicitadaEn),
      enGestion: iso(solicitud.enGestionEn),
      recibida: iso(solicitud.recibidaEn),
      entregada: iso(entrega?.entregadaEn),
      cancelada: iso(solicitud.canceladaEn),
    },
    items: solicitud.items.map((i) => ({
      id: i.id,
      articulo: i.articulo,
      cantidad: i.cantidad,
      cantidadRecibida: i.cantidadRecibida,
      motivo: i.motivo,
      detalleReemplazo: i.detalleReemplazo,
      reserva: i.numeroReserva
        ? { numero: i.numeroReserva, posicion: i.posicionReserva }
        : null,
      entregado: i.entregaItem
        ? {
            cantidad: i.entregaItem.cantidadEntregada,
            numeroSerie: i.entregaItem.numeroSerie,
            venceEn: iso(i.entregaItem.venceEn),
            reemplazadoEn: iso(i.entregaItem.reemplazadoEn),
          }
        : null,
    })),
    entrega: entrega
      ? {
          entregadaEn: iso(entrega.entregadaEn),
          destinatario: entrega.receptor,
          entregadoPor: entrega.entregadoPor,
          // Solo aparece cuando hubo un tercero; el equipamiento sigue siendo
          // del destinatario en cualquier caso.
          retiradoPor: retiro,
          observaciones: entrega.observaciones,
        }
      : null,
  });
});
