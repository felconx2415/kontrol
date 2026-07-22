import { requerirRol } from "@/lib/auth";
import { ROLES_GESTION } from "@/lib/solicitud-estado";
import { db } from "@/lib/db";
import { alternarArticulo } from "@/actions/admin";
import Insignia from "@/components/ui/insignia";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import FormularioArticulo from "./formulario-articulo";

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
          "Talla",
          "Vida útil",
          "Estado",
          { texto: "", alineado: "der" },
        ]}
      >
        {articulos.map((a) => (
          <Fila key={a.id} atenuada={!a.activo}>
            <Celda etiqueta="Código" mono tenue>
              {a.codigo}
            </Celda>
            <Celda etiqueta="Nombre">{a.nombre}</Celda>
            <Celda etiqueta="Categoría" tenue>
              {a.categoria === "EPP" ? "EPP" : "Equipamiento"}
            </Celda>
            <Celda etiqueta="Talla" tenue>
              {a.requiereTalla ? "Sí" : "No"}
            </Celda>
            <Celda etiqueta="Vida útil" mono tenue>
              {a.vidaUtilDias ? `${a.vidaUtilDias} días` : "—"}
            </Celda>
            <Celda etiqueta="Estado">
              <Insignia
                clases={
                  a.activo
                    ? "bg-exito-fondo text-exito ring-exito-borde"
                    : "bg-lienzo text-tinta-tenue ring-borde"
                }
              >
                {a.activo ? "Activo" : "Inactivo"}
              </Insignia>
            </Celda>
            <Celda derecha completa>
              <form action={alternarArticulo}>
                <input type="hidden" name="articuloId" value={a.id} />
                <button
                  type="submit"
                  className="foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-tinta-suave underline underline-offset-2 transition-colors duration-150 hover:text-tinta"
                >
                  {a.activo ? "Desactivar" : "Activar"}
                </button>
              </form>
            </Celda>
          </Fila>
        ))}
      </Tabla>
    </div>
  );
}
