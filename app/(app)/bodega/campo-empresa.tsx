"use client";

import { Campo, Seleccion } from "@/components/ui/campo";

export type EmpresaBodega = { id: string; nombre: string };

/**
 * A qué bodega entra el ítem, cuando quien lo crea alcanza más de una empresa.
 *
 * Con una sola no se pregunta nada: se asume la suya y el campo ni aparece, que
 * es el caso de casi todo el mundo. Solo el gestor que atiende varias —y el
 * administrador— tienen que decidir, y para ellos equivocarse de bodega es un
 * error caro: el stock queda contado en la empresa que no es.
 */
export default function CampoEmpresa({
  empresas,
  idPrefijo,
}: {
  empresas: EmpresaBodega[];
  idPrefijo: string;
}) {
  if (empresas.length <= 1) return null;

  return (
    <Campo
      etiqueta="Bodega de"
      htmlFor={`empresa-${idPrefijo}`}
      requerido
      pista="Gestionas más de una empresa: elige a cuál entra."
    >
      <Seleccion
        id={`empresa-${idPrefijo}`}
        name="empresaId"
        required
        defaultValue=""
      >
        <option value="" disabled>
          Elige una empresa
        </option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </Seleccion>
    </Campo>
  );
}
