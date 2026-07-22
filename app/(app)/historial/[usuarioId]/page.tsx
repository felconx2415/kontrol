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

  const persona = await db.usuario.findUnique({
    where: { id: usuarioId },
    include: { brigada: { select: { nombre: true } } },
  });

  if (!persona) notFound();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">
          {actual.id === usuarioId ? "Mi equipamiento" : persona.nombre}
        </h1>
        <p className="text-sm text-tinta-suave">
          {persona.brigada?.nombre ?? "Sin brigada"} · {vigentes.length} ítem
          {vigentes.length === 1 ? "" : "s"} asignado
          {vigentes.length === 1 ? "" : "s"}
        </p>
      </div>

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
                      {item.solicitudItem.articulo.codigo}
                      {item.solicitudItem.talla
                        ? ` · talla ${item.solicitudItem.talla}`
                        : ""}{" "}
                      · {item.cantidadEntregada}{" "}
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
                    {item.reemplazadoPor.motivoReemplazo
                      ? ` · motivo: ${ETIQUETA_MOTIVO[item.reemplazadoPor.motivoReemplazo]}`
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
