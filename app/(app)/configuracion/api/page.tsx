import { requerirRol } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES_ADMIN } from "@/lib/solicitud-estado";
import { revocarTokenApi } from "@/actions/admin";
import { haceCuanto } from "@/lib/tiempo-relativo";
import { formatearFecha } from "@/lib/vencimientos";
import { Celda, Fila, Tabla } from "@/components/ui/tabla";
import Insignia from "@/components/ui/insignia";
import { Vacio } from "@/components/ui/superficie";
import FormularioToken from "./formulario-token";

export const metadata = { title: "API · Kontrol" };

export default async function PaginaApi() {
  // Un token es una llave de lectura sobre datos de toda una empresa: emitirlos
  // es exclusivo de ADMIN, igual que las cuentas.
  await requerirRol(...ROLES_ADMIN);

  const [tokens, empresas] = await Promise.all([
    db.tokenApi.findMany({
      orderBy: [{ revocadoEn: "asc" }, { creadoEn: "desc" }],
      select: {
        id: true,
        nombre: true,
        prefijo: true,
        creadoEn: true,
        ultimoUsoEn: true,
        revocadoEn: true,
        empresa: { select: { nombre: true } },
        creadoPor: { select: { nombre: true } },
      },
    }),
    db.empresa.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, activa: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titulo-pagina">API de consulta</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Para que otro sistema —un tablero, un ERP, un script— lea datos de
          Kontrol. Es de <strong>solo lectura</strong>: un token no puede crear,
          editar ni borrar nada.
        </p>
      </div>

      <FormularioToken empresas={empresas} />

      <section className="rounded-xl border border-borde bg-panel p-4">
        <h2 className="titulo-seccion">Cómo se usa</h2>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-lienzo p-3 font-mono text-xs text-tinta-suave">
{`curl -H "Authorization: Bearer kt_…" \\
  https://epp.rmsgestion.cl/api/v1`}
        </pre>
        <p className="mt-2 text-sm text-tinta-suave">
          Esa primera llamada devuelve el catálogo de recursos disponibles y el
          alcance del token, así que sirve además para comprobar que funciona.
        </p>
      </section>

      {tokens.length === 0 ? (
        <Vacio mensaje="Todavía no hay tokens. Crea el primero para que otro sistema pueda consultar." />
      ) : (
        <Tabla
          encabezados={[
            "Nombre",
            "Token",
            "Alcance",
            "Último uso",
            "Estado",
            { texto: "Acciones", alineado: "der" },
          ]}
          anchoMinimo="52rem"
        >
          {tokens.map((t) => (
            <Fila key={t.id} atenuada={t.revocadoEn !== null}>
              <Celda etiqueta="Nombre">
                <span className="font-medium">{t.nombre}</span>
                <span className="block text-xs text-tinta-tenue">
                  Creado por {t.creadoPor.nombre} · {formatearFecha(t.creadoEn)}
                </span>
              </Celda>
              {/* Solo el prefijo: el resto no existe en ninguna parte. */}
              <Celda etiqueta="Token" mono tenue>
                {t.prefijo}…
              </Celda>
              <Celda etiqueta="Alcance" tenue>
                {t.empresa?.nombre ?? "Todas las empresas"}
              </Celda>
              <Celda etiqueta="Último uso" tenue>
                {t.ultimoUsoEn ? haceCuanto(t.ultimoUsoEn) : "Nunca"}
              </Celda>
              <Celda etiqueta="Estado">
                <Insignia
                  clases={
                    t.revocadoEn
                      ? "bg-lienzo text-tinta-tenue ring-borde"
                      : "bg-exito-fondo text-exito ring-exito-borde"
                  }
                >
                  {t.revocadoEn ? "Revocado" : "Activo"}
                </Insignia>
              </Celda>
              <Celda derecha completa>
                {!t.revocadoEn && (
                  <form action={revocarTokenApi} className="inline">
                    <input type="hidden" name="tokenId" value={t.id} />
                    <button
                      type="submit"
                      className="foco-anillo inline-flex min-h-11 cursor-pointer items-center rounded px-2 text-xs font-medium text-fallo underline underline-offset-2"
                    >
                      Revocar
                    </button>
                  </form>
                )}
              </Celda>
            </Fila>
          ))}
        </Tabla>
      )}
    </div>
  );
}
