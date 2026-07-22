import Link from "next/link";
import { requerirUsuario } from "@/lib/auth";
import { db } from "@/lib/db";
import FormularioSolicitud from "./formulario-solicitud";

export const metadata = { title: "Nueva solicitud · Kontrol" };

export default async function NuevaSolicitud() {
  const usuario = await requerirUsuario();

  const articulos = await db.articulo.findMany({
    where: { activo: true },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });

  // Ítems que el usuario tiene actualmente asignados y aún no han sido
  // reemplazados: son los candidatos válidos para una solicitud de reemplazo.
  const asignados = await db.entregaItem.findMany({
    where: {
      reemplazadoEn: null,
      entrega: { receptorId: usuario.id },
      reemplazadoPor: null,
    },
    orderBy: { entrega: { entregadaEn: "desc" } },
    include: {
      entrega: { select: { entregadaEn: true } },
      solicitudItem: {
        include: { articulo: { select: { id: true, nombre: true, codigo: true } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/solicitudes"
          className="foco-anillo -ml-1 inline-flex min-h-11 items-center rounded px-1 text-sm text-tinta-tenue transition-colors duration-150 hover:text-tinta"
        >
          ← Volver a solicitudes
        </Link>
        <h1 className="titulo-pagina mt-2">Nueva solicitud</h1>
        <p className="text-sm text-tinta-suave">
          Pide equipamiento o EPP nuevo, o el reemplazo de algo que ya tienes.
        </p>
      </div>

      <FormularioSolicitud
        articulos={articulos.map((a) => ({
          id: a.id,
          codigo: a.codigo,
          nombre: a.nombre,
          categoria: a.categoria,
        }))}
        asignados={asignados.map((i) => ({
          entregaItemId: i.id,
          articuloId: i.solicitudItem.articulo.id,
          articuloNombre: i.solicitudItem.articulo.nombre,
          entregadoEn: i.entrega.entregadaEn.toISOString(),
        }))}
      />
    </div>
  );
}
