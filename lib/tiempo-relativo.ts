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
