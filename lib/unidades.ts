/**
 * Cómo se escribe una cantidad con su unidad.
 *
 * La unidad es texto libre del catálogo —hoy conviven «unidad», «par» y «UN»— y
 * en la interfaz se pluralizaba añadiéndole una «s», que en español solo vale
 * para las palabras terminadas en vocal. Salían «2 unidads», «3 pars» y «5 UNs»
 * en pantallas que la gente lee todos los días y que además terminan impresas
 * en un acta firmada.
 */

/** Plural español de una palabra suelta. */
export function pluralizar(palabra: string): string {
  const limpia = palabra.trim();
  if (!limpia) return limpia;

  // Abreviaturas («UN», «KG», «M2»): no se pluralizan, se dejan como están.
  if (limpia.length <= 3 && limpia === limpia.toUpperCase()) return limpia;

  const ultima = limpia.at(-1)!.toLowerCase();

  // Las terminadas en -z hacen el plural en -ces: «lápiz» → «lápices».
  if (ultima === "z") return `${limpia.slice(0, -1)}ces`;

  // Vocal → +s («caja» → «cajas»); consonante → +es («unidad» → «unidades»,
  // «par» → «pares», «rollo» ya cae en el primer caso).
  return "aeiouáéíóú".includes(ultima) ? `${limpia}s` : `${limpia}es`;
}

/** «1 unidad», «2 unidades», «3 pares», «5 UN». */
export function cantidadConUnidad(cantidad: number, unidad: string): string {
  return `${cantidad} ${cantidad === 1 ? unidad.trim() : pluralizar(unidad)}`;
}
