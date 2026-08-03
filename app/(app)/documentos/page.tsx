import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { formatearFechaHora } from "@/lib/vencimientos";
import Insignia from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/superficie";
import { ListaPanel } from "@/components/ui/tabla";

export const metadata = { title: "Mis documentos · Kontrol" };

/**
 * Todos los documentos firmados de una persona, en un solo lugar.
 *
 * Antes cada acta vivía junto al trámite que la produjo: la de una solicitud en
 * su ficha, la de bodega en «Mi equipamiento». Para responder «¿qué he firmado
 * yo?» había que recorrer la app entera. Aquí se juntan por fecha, que es como
 * se busca un papel cuando alguien lo pide.
 *
 * Solo aparece lo firmado: un documento sin firma no respalda nada, así que
 * listarlo daría una falsa sensación de respaldo.
 */
export default async function MisDocumentos() {
  const usuario = await requerirUsuario();

  const [entregas, asignaciones] = await Promise.all([
    db.entrega.findMany({
      where: { receptorId: usuario.id },
      orderBy: { entregadaEn: "desc" },
      select: {
        id: true,
        entregadaEn: true,
        solicitud: { select: { id: true, folio: true, tipo: true } },
        _count: { select: { items: true } },
      },
    }),
    db.asignacionBodega.findMany({
      where: { usuarioId: usuario.id, firmaPngUrl: { not: null } },
      orderBy: { asignadoEn: "desc" },
      select: {
        id: true,
        asignadoEn: true,
        cantidad: true,
        item: { select: { nombre: true, unidad: true } },
      },
    }),
  ]);

  type Documento = {
    clave: string;
    titulo: string;
    detalle: string;
    fecha: Date;
    href: string;
    etiqueta: string;
    /** Ficha del trámite que originó el documento, si se puede visitar. */
    origen: { texto: string; href: string } | null;
  };

  const documentos: Documento[] = [
    ...entregas.map((e) => ({
      clave: `e-${e.id}`,
      titulo: `Acta de entrega ${formatearFolio(e.solicitud.folio)}`,
      detalle: `${e.solicitud.tipo === "REEMPLAZO" ? "Reemplazo" : "Equipamiento nuevo"} · ${
        e._count.items
      } ítem${e._count.items === 1 ? "" : "s"}`,
      fecha: e.entregadaEn,
      href: `/api/actas/${e.id}`,
      etiqueta: "Solicitud",
      origen: {
        texto: formatearFolio(e.solicitud.folio),
        href: `/solicitudes/${e.solicitud.id}`,
      },
    })),
    ...asignaciones.map((a) => ({
      clave: `a-${a.id}`,
      titulo: "Acta de entrega de bodega",
      detalle: `${a.item.nombre} · ${a.cantidad} ${a.item.unidad}${
        a.cantidad === 1 ? "" : "s"
      }`,
      fecha: a.asignadoEn,
      href: `/api/bodega/asignaciones/${a.id}/acta`,
      etiqueta: "Bodega",
      origen: null,
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="titulo-pagina">Mis documentos</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Las actas que has firmado al recibir equipamiento. Cada una lleva un
          código QR para verificarla.
        </p>
      </div>

      {documentos.length === 0 ? (
        <Vacio mensaje="Todavía no has firmado ningún documento. Aparecerán aquí cuando recibas equipamiento." />
      ) : (
        <ListaPanel>
          {documentos.map((d) => (
            <li
              key={d.clave}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{d.titulo}</p>
                <p className="text-xs text-tinta-tenue">
                  {d.detalle} · {formatearFechaHora(d.fecha)}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Insignia clases="bg-marca-50 text-marca-700 ring-marca-200">
                  {d.etiqueta}
                </Insignia>
                {d.origen && (
                  <Link
                    href={d.origen.href}
                    className="foco-anillo rounded font-mono text-xs text-tinta-tenue underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                  >
                    {d.origen.texto}
                  </Link>
                )}
                <a
                  href={d.href}
                  className="foco-anillo inline-flex min-h-11 items-center rounded-lg border border-borde-fuerte bg-panel px-4 text-sm font-medium text-tinta transition-colors duration-150 hover:bg-panel-suave"
                >
                  Descargar PDF
                </a>
              </div>
            </li>
          ))}
        </ListaPanel>
      )}
    </div>
  );
}
