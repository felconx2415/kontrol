import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import {
  COLOR_VENCIMIENTO,
  ETIQUETA_VENCIMIENTO,
  estadoVencimiento,
  formatearFecha,
} from "@/lib/vencimientos";
import { ETIQUETA_MOTIVO } from "@/lib/solicitud-estado";
import Insignia from "@/components/ui/insignia";
import ProgresoSolicitud from "@/components/progreso-solicitud";
import { Vacio } from "@/components/ui/superficie";
import { ListaPanel } from "@/components/ui/tabla";

export const metadata = { title: "Equipamiento asignado · Kontrol" };

export default async function Historial({
  params,
}: {
  params: Promise<{ usuarioId: string }>;
}) {
  const actual = await requerirUsuario();
  const { usuarioId } = await params;

  // Un solicitante solo consulta su propio historial.
  if (actual.rol === "SOLICITANTE" && actual.id !== usuarioId) {
    redirect("/escritorio?error=sin-permiso");
  }

  const esMio = actual.id === usuarioId;

  const persona = await db.usuario.findUnique({
    where: { id: usuarioId },
    include: { brigada: { select: { nombre: true } } },
  });

  if (!persona) notFound();

  // Pedidos todavía en curso. Van en esta página porque es la que la gente
  // abre para saber «qué tengo y qué me falta»: sin esto, un pedido que un
  // gestor registró a su nombre era invisible hasta que aparecía entregado.
  const enCurso = await db.solicitud.findMany({
    where: {
      solicitanteId: usuarioId,
      estado: { in: ["PENDIENTE", "APROBADA", "EN_GESTION", "RECIBIDA"] },
    },
    orderBy: { creadaEn: "desc" },
    select: {
      id: true,
      folio: true,
      tipo: true,
      estado: true,
      creadaEn: true,
      creadaPor: { select: { nombre: true } },
      items: { select: { articulo: { select: { nombre: true } } } },
    },
  });

  const entregados = await db.entregaItem.findMany({
    where: { entrega: { receptorId: usuarioId } },
    orderBy: { entrega: { entregadaEn: "desc" } },
    include: {
      entrega: {
        select: { entregadaEn: true, solicitud: { select: { id: true, folio: true } } },
      },
      solicitudItem: {
        include: { articulo: true },
      },
      // El reemplazo que dejó este ítem fuera de uso, si existe.
      reemplazadoPor: {
        include: {
          solicitud: { select: { id: true, folio: true, estado: true } },
        },
      },
    },
  });

  const vigentes = entregados.filter((i) => i.reemplazadoEn === null);
  const historicos = entregados.filter((i) => i.reemplazadoEn !== null);

  // Equipamiento entregado desde la Bodega local (asignaciones definitivas).
  const asignacionesBodega = await db.asignacionBodega.findMany({
    where: { usuarioId },
    orderBy: { asignadoEn: "desc" },
    include: {
      item: { select: { nombre: true, codigo: true, unidad: true } },
      asignadoPor: { select: { nombre: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">
          {esMio ? "Mi equipamiento" : persona.nombre}
        </h1>
        <p className="text-sm text-tinta-suave">
          {persona.brigada?.nombre ?? "Sin brigada"} · {vigentes.length} ítem
          {vigentes.length === 1 ? "" : "s"} asignado
          {vigentes.length === 1 ? "" : "s"}
        </p>
      </div>

      {enCurso.length > 0 && (
        <section>
          <h2 className="titulo-seccion mb-2">
            {esMio ? "Mis solicitudes en curso" : "Solicitudes en curso"}
          </h2>
          <ListaPanel>
            {enCurso.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/solicitudes/${s.id}`}
                  className="foco-anillo group block px-4 py-3 transition-colors duration-150 hover:bg-marca-50"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="min-w-0 text-sm font-medium">
                      {/* Los artículos pedidos importan más que el folio: es lo
                          que la persona está esperando. */}
                      <span className="truncate">
                        {s.items.map((i) => i.articulo.nombre).join(", ")}
                      </span>
                    </p>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-tinta-tenue">
                      {formatearFolio(s.folio)}
                    </span>
                  </div>

                  <div className="mt-2 max-w-md">
                    <ProgresoSolicitud estado={s.estado} />
                  </div>

                  <p className="mt-1 text-xs text-tinta-tenue">
                    {s.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo"} ·
                    pedido el {formatearFecha(s.creadaEn)}
                    {s.creadaPor
                      ? ` · registrada por ${s.creadaPor.nombre}${esMio ? " a tu nombre" : ""}`
                      : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ListaPanel>
        </section>
      )}

      <section>
        <h2 className="titulo-seccion mb-2">
          Asignado actualmente
        </h2>

        {vigentes.length === 0 ? (
          <Vacio mensaje="No hay equipamiento asignado todavía." />
        ) : (
          <ListaPanel>
            {vigentes.map((item) => {
              const vencimiento = estadoVencimiento(item.venceEn);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {item.solicitudItem.articulo.nombre}
                    </p>
                    <p className="text-xs text-tinta-tenue">
                      {item.solicitudItem.articulo.codigo} ·{" "}
                      {item.cantidadEntregada}{" "}
                      {item.solicitudItem.articulo.unidad}
                      {item.cantidadEntregada === 1 ? "" : "s"} · entregado{" "}
                      {formatearFecha(item.entrega.entregadaEn)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {item.venceEn && (
                      <span className="text-xs text-tinta-tenue">
                        vence {formatearFecha(item.venceEn)}
                      </span>
                    )}
                    <Insignia clases={COLOR_VENCIMIENTO[vencimiento]}>
                      {ETIQUETA_VENCIMIENTO[vencimiento]}
                    </Insignia>
                  </div>
                </li>
              );
            })}
          </ListaPanel>
        )}
      </section>

      {asignacionesBodega.length > 0 && (
        <section>
          <h2 className="titulo-seccion mb-2">Equipamiento de bodega</h2>
          <ListaPanel>
            {asignacionesBodega.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{a.item.nombre}</p>
                  <p className="text-xs text-tinta-tenue">
                    {a.item.codigo} · {a.cantidad} {a.item.unidad}
                    {a.cantidad === 1 ? "" : "s"} · asignado{" "}
                    {formatearFecha(a.asignadoEn)} por {a.asignadoPor.nombre}
                    {a.notas ? ` · ${a.notas}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {/* Solo las asignaciones firmadas tienen acta: las anteriores
                      a que se pidiera firma no pueden respaldar nada. */}
                  {a.firmaPngUrl && (
                    <a
                      href={`/api/bodega/asignaciones/${a.id}/acta`}
                      className="foco-anillo rounded text-xs text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                    >
                      Acta de entrega
                    </a>
                  )}
                  <Insignia clases="bg-marca-50 text-marca-700 ring-marca-200">
                    Bodega
                  </Insignia>
                </div>
              </li>
            ))}
          </ListaPanel>
        </section>
      )}

      {historicos.length > 0 && (
        <section>
          <h2 className="titulo-seccion mb-2">Reemplazados</h2>
          <ListaPanel>
            {historicos.map((item) => (
              <li key={item.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-tinta-suave">
                      {item.solicitudItem.articulo.nombre}
                    </p>
                    <p className="text-xs text-tinta-tenue">
                      Entregado {formatearFecha(item.entrega.entregadaEn)} ·
                      reemplazado {formatearFecha(item.reemplazadoEn)}
                    </p>
                  </div>
                  <Link
                    href={`/solicitudes/${item.entrega.solicitud.id}`}
                    className="foco-anillo rounded text-xs text-tinta-tenue underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                  >
                    {formatearFolio(item.entrega.solicitud.folio)}
                  </Link>
                </div>

                {item.reemplazadoPor && (
                  <p className="mt-1.5 rounded-lg bg-panel-suave px-2.5 py-1.5 text-xs text-tinta-suave">
                    Reemplazado por{" "}
                    <Link
                      href={`/solicitudes/${item.reemplazadoPor.solicitud.id}`}
                      className="foco-anillo rounded font-medium underline underline-offset-2"
                    >
                      {formatearFolio(item.reemplazadoPor.solicitud.folio)}
                    </Link>
                    {item.reemplazadoPor.motivo
                      ? ` · motivo: ${ETIQUETA_MOTIVO[item.reemplazadoPor.motivo]}`
                      : ""}
                  </p>
                )}
              </li>
            ))}
          </ListaPanel>
        </section>
      )}
    </div>
  );
}
