/**
 * Búsqueda por texto sobre listas cargadas en memoria.
 *
 * No se hace con `contains` de Prisma a propósito: sobre SQLite eso es un LIKE
 * que ignora mayúsculas solo en ASCII y **no** ignora tildes, así que buscar
 * «perez» no encontraría a «Pérez» ni «munoz» a «Muñoz» —justo los apellidos
 * que se teclean a diario aquí—. Normalizar en JS resuelve las dos cosas de una
 * vez, al precio de traer la tabla entera; se usa donde eso no duele: catálogo,
 * cuentas, brigadas y empresas son cientos de filas, no millones.
 */

/** Quita tildes y pasa a minúsculas para buscar sin importar acentos. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Predicado de búsqueda ya preparado: normaliza el término **una vez** y
 * devuelve la función con que se filtra cada fila.
 *
 *     const coincide = buscador(q);
 *     const filtradas = todas.filter((e) => coincide(e.nombre, e.rut));
 *
 * Sin término escrito, todo coincide: la lista sin filtrar es la lista entera.
 */
export function buscador(
  q: string | null | undefined,
): (...campos: (string | null | undefined)[]) => boolean {
  const termino = normalizar((q ?? "").trim());
  if (!termino) return () => true;
  return (...campos) =>
    campos.some((campo) => campo && normalizar(campo).includes(termino));
}
