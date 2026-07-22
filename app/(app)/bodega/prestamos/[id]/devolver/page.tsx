import Link from "next/link";
import { redirect } from "next/navigation";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import FormularioDevolucion from "./formulario-devolucion";

export const metadata = { title: "Devolver préstamo · Kontrol" };

const fecha = (d: Date) =>
  d.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });

export default async function PaginaDevolver({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requerirRol(...ROLES_GESTION);
  const { id } = await params;

  const prestamo = await db.prestamo.findUnique({
    where: { id },
    include: { item: { select: { nombre: true, codigo: true, unidad: true } } },
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
          {prestamo.cantidad} {prestamo.item.unidad} de «{prestamo.item.nombre}» ·
          prestado a {prestamo.persona} el {fecha(prestamo.prestadoEn)}.
        </p>
      </div>

      <FormularioDevolucion prestamoId={prestamo.id} />
    </div>
  );
}
