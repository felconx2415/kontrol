import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatearFolio } from "@/lib/folio";
import {
  esGestion,
  puedeActuarSobre,
  puedeTransicionar,
} from "@/lib/solicitud-estado";
import { Tarjeta } from "@/components/ui/superficie";
import FormularioEntrega from "./formulario-entrega";

export const metadata = { title: "Entregar · Kontrol" };

export default async function PaginaEntrega({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirUsuario();
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

  // El beneficiario firma la suya cuando retira él mismo; gestión, cualquiera.
  if (
    !puedeTransicionar(solicitud.estado, "ENTREGADA", usuario.rol) ||
    !puedeActuarSobre(usuario, solicitud)
  ) {
    redirect("/escritorio?error=sin-permiso");
  }

  // Entregar solo tiene sentido sobre una solicitud ya recibida del almacén.
  if (solicitud.estado !== "RECIBIDA") {
    redirect(`/solicitudes/${id}`);
  }

  const retiroPropio = !esGestion(usuario.rol);

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
          {retiroPropio ? "Recibir" : "Entregar"} {formatearFolio(solicitud.folio)}
        </h1>
        <p className="text-sm text-tinta-suave">
          {retiroPropio
            ? "Confirma lo que estás retirando y firma la recepción."
            : "Confirma las cantidades y pide al receptor que firme."}
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
        retiroPropio={retiroPropio}
        solicitudId={solicitud.id}
        items={solicitud.items.map((i) => ({
          id: i.id,
          nombre: i.articulo.nombre,
          codigo: i.articulo.codigo,
          unidad: i.articulo.unidad,
          cantidadPedida: i.cantidad,
          // Tope de la entrega: lo que realmente llegó del almacén. Si nunca se
          // registró recepción por ítem, se cae a lo pedido.
          cantidadRecibida: i.cantidadRecibida ?? i.cantidad,
        }))}
      />
    </div>
  );
}
