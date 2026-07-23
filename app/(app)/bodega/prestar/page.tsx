import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { Vacio } from "@/components/ui/superficie";
import FormularioPrestamo from "./formulario-prestamo";

export const metadata = { title: "Prestar ítem · Kontrol" };

export default async function PaginaPrestar({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  await requerirRol(...ROLES_GESTION);
  const { item: itemPreseleccionado } = await searchParams;

  const items = await db.itemBodega.findMany({
    where: { activo: true, stock: { gt: 0 } },
    orderBy: { nombre: "asc" },
    select: { id: true, codigo: true, nombre: true, unidad: true, stock: true },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/bodega"
          className="foco-anillo rounded text-sm text-marca-700 underline-offset-2 hover:underline"
        >
          ← Volver a bodega
        </Link>
        <h1 className="titulo-pagina mt-2">Registrar préstamo</h1>
        <p className="text-sm text-tinta-suave">
          Quien recibe firma la salida del material. La devolución se firma
          después, al volver el ítem.
        </p>
      </div>

      {items.length === 0 ? (
        <Vacio mensaje="No hay ítems con stock disponible para prestar." />
      ) : (
        <FormularioPrestamo items={items} itemPreseleccionado={itemPreseleccionado} />
      )}
    </div>
  );
}
