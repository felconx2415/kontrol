/**
 * «hace 5 min», «ayer», «hace 3 d».
 *
 * En una notificación, la hora exacta casi nunca importa y la distancia sí:
 * lo que se quiere saber es si esto es de recién o lleva una semana esperando.
 * Pasada la semana se cae a la fecha, porque «hace 23 d» ya no le dice nada a
 * nadie.
 */
export function haceCuanto(fecha: Date, ahora = new Date()): string {
  const segundos = Math.round((ahora.getTime() - fecha.getTime()) / 1000);

  // Un reloj adelantado en el equipo no debe producir «en 3 minutos».
  if (segundos < 60) return "recién";

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;

  return fecha.toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "short",
  });
}

/**
 * Cuánto pasó entre dos momentos, en corto: «+2 h», «+4 d», «+15 min».
 *
 * La línea de tiempo repetía la fecha completa en cada hito —cinco veces el
 * mismo «09-08-2026, 01:07 p. m.»— y eso escondía lo único que ahí se quiere
 * leer: **cuánto tardó cada paso**. Un pedido que estuvo cuatro días esperando
 * la reserva se ve de un vistazo; la fecha exacta queda en el `title`.
 */
export function duracionEntre(desde: Date, hasta: Date): string {
  const segundos = Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / 1000));

  if (segundos < 60) return "+1 min"; // menos de un minuto se lee como inmediato

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `+${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `+${horas} h`;

  return `+${Math.floor(horas / 24)} d`;
}

/** Cuántos días enteros lleva algo desde una fecha. */
export function diasDesde(fecha: Date, ahora = new Date()): number {
  return Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000);
}

/** «hoy», «1 día», «5 días» — para decir cuánto lleva algo detenido. */
export function cuantoLleva(fecha: Date, ahora = new Date()): string {
  const dias = diasDesde(fecha, ahora);
  if (dias <= 0) return "hoy";
  return dias === 1 ? "1 día" : `${dias} días`;
}
