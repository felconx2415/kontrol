import Link from "next/link";
import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { filtroEmpresa } from "@/lib/alcance";
import { Vacio } from "@/components/ui/superficie";
import FormularioAsignar from "./formulario-asignar";

export const metadata = { title: "Asignar equipamiento · Kontrol" };

export default async function PaginaAsignar({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const usuario = await requerirRol(...ROLES_GESTION);
  const { item: itemPreseleccionado } = await searchParams;
  const deMiEmpresa = filtroEmpresa(usuario.alcance);

  const [items, usuarios, brigadas] = await Promise.all([
    db.itemBodega.findMany({
      where: { ...deMiEmpresa, activo: true, stock: { gt: 0 } },
      orderBy: { nombre: "asc" },
      select: { id: true, codigo: true, nombre: true, unidad: true, stock: true },
    }),
    db.usuario.findMany({
      where: { ...deMiEmpresa, activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        brigada: { select: { nombre: true } },
        cargo: { select: { nombre: true } },
      },
    }),
    // Con cuántos: al elegir a quién entregar, «BBOO 2169 · 6 personas» dice
    // más que el nombre solo, sobre todo entre brigadas de nombre parecido.
    db.brigada.findMany({
      where: deMiEmpresa,
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        _count: { select: { miembros: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/bodega"
          className="foco-anillo rounded text-sm text-marca-700 underline-offset-2 hover:underline"
        >
          ← Volver a bodega
        </Link>
        <h1 className="titulo-pagina mt-2">Asignar equipamiento</h1>
        <p className="text-sm text-tinta-suave">
          Entrega definitiva: baja el stock de la bodega y queda a nombre de una
          persona —lo verá en «Mi equipamiento»— o de una brigada entera, cuando
          el material es de la cuadrilla y no de nadie en particular.
        </p>
      </div>

      {items.length === 0 ? (
        <Vacio mensaje="No hay ítems con stock disponible para asignar." />
      ) : (
        <FormularioAsignar
          items={items}
          itemPreseleccionado={itemPreseleccionado}
          usuarios={usuarios.map((u) => ({
            id: u.id,
            nombre: u.nombre,
            brigada: u.brigada?.nombre ?? null,
            cargo: u.cargo?.nombre ?? null,
          }))}
          brigadas={brigadas.map((b) => ({
            id: b.id,
            nombre: b.nombre,
            miembros: b._count.miembros,
          }))}
        />
      )}
    </div>
  );
}
