import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { Tarjeta } from "@/components/ui/superficie";
import FormularioEntrega from "./formulario-entrega";

export const metadata = { title: "Entregar · Kontrol" };

export default async function PaginaEntrega({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirRol(...ROLES_GESTION);
  const { id } = await params;

  const solicitud = await db.solicitud.findUnique({
    where: { id },
    include: {
      solicitante: { select: { nombre: true, rut: true } },
      brigada: { select: { nombre: true } },
      items: { include: { articulo: true } },
    },
  });

  if (!solicitud) notFound();

  // Entregar solo tiene sentido sobre una solicitud ya recibida del almacén.
  if (solicitud.estado !== "RECIBIDA") {
    redirect(`/solicitudes/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href={`/solicitudes/${id}`}
          className="foco-anillo -ml-1 inline-flex min-h-11 items-center rounded px-1 text-sm text-tinta-tenue transition-colors duration-150 hover:text-tinta"
        >
          ← Volver a la solicitud
        </Link>
        <h1 className="titulo-pagina mt-2">
          Entregar {formatearFolio(solicitud.folio)}
        </h1>
        <p className="text-sm text-tinta-suave">
          Confirma las cantidades y pide al receptor que firme.
        </p>
      </div>

      <Tarjeta>
        <p className="text-sm text-tinta-suave">Receptor</p>
        <p className="text-base font-medium">{solicitud.solicitante.nombre}</p>
        <p className="text-sm text-tinta-tenue">
          {solicitud.solicitante.rut ?? "Sin RUT registrado"}
          {solicitud.brigada ? ` · ${solicitud.brigada.nombre}` : ""}
        </p>
      </Tarjeta>

      <FormularioEntrega
        solicitudId={solicitud.id}
        items={solicitud.items.map((i) => ({
          id: i.id,
          nombre: i.articulo.nombre,
          codigo: i.articulo.codigo,
          unidad: i.articulo.unidad,
          cantidadPedida: i.cantidad,
        }))}
      />
    </div>
  );
}
