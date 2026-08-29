import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { buscador } from "@/lib/busqueda";
import { Tabla } from "@/components/ui/tabla";
import { Vacio } from "@/components/ui/superficie";
import Buscador from "@/components/ui/buscador";
import Paginacion from "@/components/ui/paginacion";
import FormularioArticulo from "./formulario-articulo";
import FilaArticulo from "./fila-articulo";

export const metadata = { title: "Catálogo · Kontrol" };

const POR_PAGINA = 10;

export default async function AdminArticulos({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  await requerirRol(...ROLES_GESTION);

  const { page, q } = await searchParams;

  // El catálogo entero y no una página: son un par de cientos de artículos y
  // buscarlos sin tropezar con las tildes exige filtrarlos en JS (ver
  // lib/busqueda.ts). La paginación se aplica después, sobre lo que quedó.
  const articulos = await db.articulo.findMany({
    orderBy: [{ activo: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
  });

  const coincide = buscador(q);
  const filtrados = articulos.filter((a) =>
    coincide(a.codigo, a.nombre, a.ceco, a.categoria),
  );

  // La página se acota a las que existen tras filtrar: quien venía en la 7 y
  // busca algo que cabe en una no debe encontrarse una tabla vacía.
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number(page) || 1), totalPaginas);
  const enPantalla = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  const buscando = Boolean(q?.trim());

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

      <Buscador
        etiqueta="Buscar artículo"
        placeholder="Código, nombre o CECO…"
        valor={q ?? ""}
        accion="/configuracion/catalogo"
        resumen={
          buscando
            ? `${filtrados.length} de ${articulos.length} artículos`
            : undefined
        }
      />

      {enPantalla.length === 0 ? (
        <Vacio
          mensaje={
            buscando
              ? "Ningún artículo coincide con esa búsqueda. Prueba con el código o parte del nombre."
              : "Todavía no hay artículos en el catálogo. Crea el primero para que las brigadas puedan pedirlo."
          }
        />
      ) : (
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
          {enPantalla.map((a) => (
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
      )}

      <Paginacion
        paginaActual={pagina}
        totalPaginas={totalPaginas}
        href={(p) =>
          `/configuracion/catalogo?${new URLSearchParams({
            ...(q ? { q } : {}),
            page: String(p),
          })}`
        }
      />
    </div>
  );
}
