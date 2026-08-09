import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { ZONA_HORARIA } from "@/lib/vencimientos";
import FormularioDevolucion from "./formulario-devolucion";

export const metadata = { title: "Devolver préstamo · Kontrol" };

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CL", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export default async function PaginaDevolver({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirRol(...ROLES_GESTION);
  const { id } = await params;

  // findFirst y no findUnique: el préstamo tiene que ser además de una bodega
  // que este gestor alcance, y eso se resuelve por sus líneas.
  const prestamo = await db.prestamo.findFirst({
    where: { id, items: { some: { item: filtroEmpresa(usuario.alcance) } } },
    include: {
      items: {
        where: { devueltoEn: null },
        include: { item: { select: { nombre: true, codigo: true, unidad: true } } },
      },
    },
  });

  // Si ya no está activo (o no existe), no hay nada que devolver.
  if (!prestamo || prestamo.estado !== "ACTIVO") redirect("/bodega");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/bodega"
          className="foco-anillo rounded text-sm text-marca-700 underline-offset-2 hover:underline"
        >
          ← Volver a bodega
        </Link>
        <h1 className="titulo-pagina mt-2">Registrar devolución</h1>
        <p className="text-sm text-tinta-suave">
          {prestamo.items.length} ítem{prestamo.items.length === 1 ? "" : "s"}{" "}
          prestado{prestamo.items.length === 1 ? "" : "s"} a {prestamo.persona} el{" "}
          {fecha(prestamo.prestadoEn)}. Revisa cada uno y anota cómo vuelve.
        </p>
      </div>

      <FormularioDevolucion
        prestamoId={prestamo.id}
        lineas={prestamo.items.map((l) => ({
          id: l.id,
          nombre: l.item.nombre,
          codigo: l.item.codigo,
          unidad: l.item.unidad,
          cantidad: l.cantidad,
          numeroSerie: l.numeroSerie,
        }))}
      />
    </div>
  );
}
