import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { Tabla } from "@/components/ui/tabla";
import Paginacion from "@/components/ui/paginacion";
import FormularioArticulo from "./formulario-articulo";
import FilaArticulo from "./fila-articulo";

export const metadata = { title: "Catálogo · Kontrol" };

const POR_PAGINA = 10;

export default async function AdminArticulos({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requerirRol(...ROLES_GESTION);

  const { page } = await searchParams;
  const pagina = Math.max(1, Number(page) || 1);

  const [total, articulos] = await Promise.all([
    db.articulo.count(),
    db.articulo.findMany({
      orderBy: [{ activo: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
      skip: (pagina - 1) * POR_PAGINA,
      take: POR_PAGINA,
    }),
  ]);
  const totalPaginas = Math.ceil(total / POR_PAGINA);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">Catálogo</h1>
        <p className="text-sm text-tinta-suave">
          Artículos que las brigadas pueden solicitar. Kontrol no lleva stock: el
          inventario vive en el almacén externo.
        </p>
      </div>

      <FormularioArticulo />

      <Tabla
        encabezados={[
          "Código",
          "Nombre",
          "Categoría",
          "CECO",
          "Vida útil",
          "Estado",
          { texto: "", alineado: "der" },
        ]}
      >
        {articulos.map((a) => (
          <FilaArticulo
            key={a.id}
            articulo={{
              id: a.id,
              codigo: a.codigo,
              nombre: a.nombre,
              categoria: a.categoria,
              unidad: a.unidad,
              ceco: a.ceco,
              vidaUtilDias: a.vidaUtilDias,
              activo: a.activo,
            }}
          />
        ))}
      </Tabla>

      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        href={(p) => `/admin/articulos?page=${p}`}
      />
    </div>
  );
}
