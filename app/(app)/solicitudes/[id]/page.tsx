import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { formatearFecha, formatearFechaHora } from "@/lib/vencimientos";
import { accionesDisponibles, esGestion, ETIQUETA_ESTADO } from "@/lib/solicitud-estado";
import EstadoBadge from "@/components/estado-badge";
import TimelineSolicitud, { type HitoTimeline } from "@/components/timeline-solicitud";
import { Aviso, Tarjeta } from "@/components/ui/superficie";
import AccionesSolicitud from "./acciones-solicitud";
import EditorItems from "./editor-items";

export default async function DetalleSolicitud({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const usuario = await requerirUsuario();
  const { id } = await params;
  const { error } = await searchParams;

  const solicitud = await db.solicitud.findUnique({
    where: { id },
    include: {
      solicitante: { select: { id: true, nombre: true } },
      aprobador: { select: { nombre: true } },
      gestor: { select: { nombre: true } },
      editadaPor: { select: { nombre: true } },
      brigada: { select: { nombre: true } },
      items: {
        include: {
          articulo: true,
          entregaAnterior: {
            include: {
              entrega: { select: { entregadaEn: true } },
            },
          },
        },
      },
      entrega: {
        include: {
          receptor: { select: { nombre: true } },
          entregadoPor: { select: { nombre: true } },
          items: true,
        },
      },
    },
  });

  if (!solicitud) notFound();

  // Un solicitante solo puede ver lo suyo.
  if (usuario.rol === "SOLICITANTE" && solicitud.solicitanteId !== usuario.id) {
    redirect("/escritorio?error=sin-permiso");
  }

  // A este punto un solicitante solo puede ser el dueño: el redirect de
  // arriba ya descartó el resto.
  const acciones = accionesDisponibles(solicitud.estado, usuario.rol);

  // Ajustar el pedido solo tiene sentido antes de aprobarlo: después, el
  // pedido al almacén ya se hizo sobre esas cantidades.
  const puedeEditarItems =
    solicitud.estado === "PENDIENTE" &&
    (usuario.rol === "APROBADOR" || esGestion(usuario.rol));

  // Envío al almacén: solo gestión, desde que la solicitud está aprobada, y solo
  // si tiene ítems del CECO que va a ese almacén.
  const hayItemsAlmacen = solicitud.items.some(
    (i) => i.articulo.ceco === "FD1400D082",
  );
  const puedeEnviarAlmacen =
    esGestion(usuario.rol) &&
    hayItemsAlmacen &&
    ["APROBADA", "EN_GESTION", "RECIBIDA", "ENTREGADA"].includes(
      solicitud.estado,
    );

  // Ajustes hechos por quien aprueba. Se leen de la auditoría, que ya guarda
  // el detalle exacto de cada cambio.
  const registrosAjuste = await db.auditoria.findMany({
    where: { entidadId: solicitud.id, entidad: "Solicitud", accion: "EDITADA" },
    orderBy: { creadoEn: "asc" },
    include: { usuario: { select: { nombre: true } } },
  });

  const ajustes: HitoTimeline[] = registrosAjuste.map((r, i) => {
    let detalles: string[] = [];
    try {
      const leido = r.detalleJson ? JSON.parse(r.detalleJson) : null;
      if (Array.isArray(leido)) detalles = leido.map(String);
    } catch {
      // Un detalle ilegible no debe romper la página: se muestra el hito sin lista.
    }
    return {
      clave: `ajuste-${r.id}`,
      titulo: registrosAjuste.length > 1 ? `Pedido ajustado (${i + 1})` : "Pedido ajustado",
      fecha: r.creadoEn,
      responsable: r.usuario.nombre,
      detalles,
      evento: true,
    };
  });

  const interrumpido =
    solicitud.estado === "RECHAZADA" || solicitud.estado === "CANCELADA";

  const hitos: HitoTimeline[] = [
    {
      clave: "PENDIENTE",
      titulo: ETIQUETA_ESTADO.PENDIENTE,
      fecha: solicitud.enviadaEn,
      responsable: solicitud.solicitante.nombre,
    },
    // Los ajustes ocurren entre el envío y la aprobación.
    ...ajustes,
    {
      clave: "APROBADA",
      titulo: ETIQUETA_ESTADO.APROBADA,
      fecha: solicitud.estado === "RECHAZADA" ? null : solicitud.aprobadaEn,
      responsable: solicitud.aprobador?.nombre ?? null,
    },
    {
      clave: "EN_GESTION",
      titulo: ETIQUETA_ESTADO.EN_GESTION,
      fecha: solicitud.enGestionEn,
      responsable: solicitud.gestor?.nombre ?? null,
      nota: solicitud.pedidoExternoRef
        ? `Pedido al almacén: ${solicitud.pedidoExternoRef}`
        : null,
    },
    {
      clave: "RECIBIDA",
      titulo: ETIQUETA_ESTADO.RECIBIDA,
      fecha: solicitud.recibidaEn,
      responsable: solicitud.gestor?.nombre ?? null,
    },
    {
      clave: "ENTREGADA",
      titulo: ETIQUETA_ESTADO.ENTREGADA,
      fecha: solicitud.entrega?.entregadaEn ?? null,
      responsable: solicitud.entrega?.entregadoPor.nombre ?? null,
    },
    {
      clave: "RECHAZADA",
      titulo: ETIQUETA_ESTADO.RECHAZADA,
      fecha: solicitud.estado === "RECHAZADA" ? solicitud.aprobadaEn : null,
      responsable: solicitud.aprobador?.nombre ?? null,
      nota: solicitud.motivoRechazo,
      evento: true,
      alerta: true,
    },
    {
      clave: "CANCELADA",
      titulo: ETIQUETA_ESTADO.CANCELADA,
      fecha: solicitud.canceladaEn,
      responsable: null,
      evento: true,
      alerta: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/solicitudes"
          className="foco-anillo -ml-1 inline-flex min-h-11 items-center rounded px-1 text-sm text-tinta-tenue transition-colors duration-150 hover:text-tinta"
        >
          ← Volver a solicitudes
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="titulo-pagina">
            <span className="font-mono text-tinta-tenue">
              {formatearFolio(solicitud.folio)}
            </span>{" "}
            · {solicitud.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo"}
          </h1>
          <EstadoBadge estado={solicitud.estado} />
        </div>
        <p className="mt-1 text-sm text-tinta-suave">
          Solicitada por{" "}
          <Link
            href={`/historial/${solicitud.solicitante.id}`}
            className="foco-anillo rounded font-medium underline underline-offset-2"
          >
            {solicitud.solicitante.nombre}
          </Link>
          {solicitud.brigada ? ` · ${solicitud.brigada.nombre}` : ""} ·{" "}
          {formatearFechaHora(solicitud.creadaEn)}
        </p>
      </div>

      {error && <Aviso tono="error">{error}</Aviso>}

      {solicitud.editadaEn && (
        <Aviso tono="espera">
          {solicitud.editadaPor?.nombre ?? "Un aprobador"} ajustó este pedido el{" "}
          {formatearFechaHora(solicitud.editadaEn)}. Las cantidades que ves son
          las definitivas.
        </Aviso>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {solicitud.justificacion && (
            <Tarjeta>
              <h2 className="titulo-seccion">Justificación</h2>
              <p className="mt-1.5 text-sm text-tinta-suave">
                {solicitud.justificacion}
              </p>
            </Tarjeta>
          )}

          <EditorItems
            solicitudId={solicitud.id}
            puedeEditar={puedeEditarItems}
            items={solicitud.items.map((item) => ({
              id: item.id,
              articuloNombre: item.articulo.nombre,
              articuloCodigo: item.articulo.codigo,
              categoria: item.articulo.categoria,
              unidad: item.articulo.unidad,
              cantidad: item.cantidad,
              motivo: item.motivo,
              detalleReemplazo: item.detalleReemplazo,
              fotoEvidenciaUrl: item.fotoEvidenciaUrl,
              entregaAnteriorFecha: item.entregaAnterior
                ? formatearFecha(item.entregaAnterior.entrega.entregadaEn)
                : null,
            }))}
          />

          {solicitud.entrega && (
            <section className="rounded-xl border border-exito-borde bg-exito-fondo p-4">
              <h2 className="text-sm font-semibold text-exito">
                Entrega registrada
              </h2>
              <p className="mt-1 text-sm text-tinta">
                Recibido por {solicitud.entrega.receptor.nombre} el{" "}
                {formatearFechaHora(solicitud.entrega.entregadaEn)}, entregado por{" "}
                {solicitud.entrega.entregadoPor.nombre}.
              </p>
              {solicitud.entrega.observaciones && (
                <p className="mt-1 text-sm text-tinta-suave">
                  {solicitud.entrega.observaciones}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Image
                  src={solicitud.entrega.firmaPngUrl}
                  alt="Firma del receptor"
                  width={160}
                  height={64}
                  className="h-16 w-auto rounded-lg border border-exito-borde bg-panel"
                />
                <a
                  href={`/api/actas/${solicitud.entrega.id}`}
                  className="foco-anillo inline-flex min-h-11 items-center rounded-lg border border-borde-fuerte bg-panel px-4 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave"
                >
                  Descargar acta PDF
                </a>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          {puedeEnviarAlmacen && (
            <section className="no-print space-y-3 rounded-xl border border-borde bg-panel p-4">
              <h2 className="titulo-seccion">Envío a almacén</h2>
              <p className="text-sm text-tinta-suave">
                Descarga los ítems del CECO FD1400D082 en el formato para enviar
                al almacén.
              </p>
              <a
                href={`/api/solicitudes/${solicitud.id}/almacen`}
                className="foco-anillo inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-borde-fuerte bg-panel px-4 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave"
              >
                Descargar formato almacén (Excel)
              </a>
            </section>
          )}

          <Tarjeta>
            <h2 className="titulo-seccion mb-4">Seguimiento</h2>
            <TimelineSolicitud hitos={hitos} interrumpido={interrumpido} />
          </Tarjeta>

          {acciones.length > 0 && (
            <AccionesSolicitud
              solicitudId={solicitud.id}
              acciones={acciones.map((a) => ({ hacia: a.hacia, texto: a.accion }))}
              puedeEntregar={solicitud.estado === "RECIBIDA" && esGestion(usuario.rol)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
