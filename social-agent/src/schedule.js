// Cálculo de fechas de publicación respetando la zona horaria del cliente.

export const FREQ_DAYS = {
  diario: 1,
  '3_por_semana': 2,
  '2_por_semana': 3,
  semanal: 7,
  quincenal: 14,
  mensual: 30,
};

export function freqDays(freq) {
  const d = FREQ_DAYS[freq];
  if (!d) throw new Error(`Frecuencia desconocida: ${freq} (usa ${Object.keys(FREQ_DAYS).join(', ')})`);
  return d;
}

// 'YYYY-MM-DD' de un instante en la zona horaria dada.
export function localDate(date, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
}

export function localTime(date, tz) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(date));
}

function tzOffsetMs(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - utcMs;
}

// Fecha + hora local de `tz` → ISO en UTC.
export function zonedToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '10:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffsetMs(guess, tz);
  ts = guess - tzOffsetMs(ts, tz); // segunda pasada por cambios de horario
  return new Date(ts).toISOString();
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Próxima fecha de publicación para una plataforma:
 * última publicación + frecuencia, nunca antes de hoy (o mañana si la hora ya pasó).
 * Devuelve { fecha: 'YYYY-MM-DD', scheduledAt: ISO UTC, sinHistorial: bool }.
 */
export function nextSlot({ lastIso, frecuencia, hora = '10:00', tz, now = new Date(), minDays = 0 }) {
  const today = localDate(now, tz);
  // minDays: días mínimos desde hoy (p. ej. 1 para dar tiempo al cliente de aprobar).
  let earliest = addDays(today, minDays);
  if (zonedToUtc(earliest, hora, tz) <= now.toISOString()) earliest = addDays(earliest, 1);
  let fecha = lastIso ? addDays(localDate(lastIso, tz), freqDays(frecuencia)) : earliest;
  if (fecha < earliest) fecha = earliest;
  return { fecha, scheduledAt: zonedToUtc(fecha, hora, tz), sinHistorial: !lastIso };
}

export function daysUntil(iso, now = new Date()) {
  return (new Date(iso) - now) / 86400000;
}
