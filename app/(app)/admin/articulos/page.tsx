import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { Tabla } from "@/components/ui/tabla";
import FormularioArticulo from "./formulario-articulo";
import FilaArticulo from "./fila-articulo";

export const metadata = { title: "Catálogo · Kontrol" };

export default async function AdminArticulos() {
  await requerirRol(...ROLES_GESTION);

  const articulos = await db.articulo.findMany({
    orderBy: [{ activo: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
  });

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
    </div>
  );
}
