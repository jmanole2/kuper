import test from 'node:test';
import assert from 'node:assert/strict';
import { zonedToUtc, nextSlot, localDate } from '../src/schedule.js';

const TZ = 'America/Mexico_City';

test('convierte hora local de CDMX a UTC', () => {
  assert.equal(zonedToUtc('2026-10-27', '10:00', TZ), '2026-10-27T16:00:00.000Z');
  assert.equal(zonedToUtc('2026-07-01', '09:30', 'America/New_York'), '2026-07-01T13:30:00.000Z'); // con horario de verano
});

test('próxima fecha = última + frecuencia', () => {
  const now = new Date('2026-10-19T15:00:00Z');
  const s = nextSlot({ lastIso: '2026-10-15T16:00:00Z', frecuencia: 'semanal', hora: '10:00', tz: TZ, now });
  assert.equal(s.fecha, '2026-10-22');
  assert.equal(s.scheduledAt, '2026-10-22T16:00:00.000Z');
});

test('nunca programa en el pasado', () => {
  const now = new Date('2026-10-19T20:00:00Z'); // 14:00 en CDMX, ya pasó la hora de las 10
  const s = nextSlot({ lastIso: '2026-09-01T16:00:00Z', frecuencia: 'semanal', hora: '10:00', tz: TZ, now });
  assert.equal(s.fecha, '2026-10-20');
  const s2 = nextSlot({ lastIso: null, frecuencia: 'mensual', hora: '18:00', tz: TZ, now });
  assert.equal(s2.fecha, '2026-10-19');
  assert.equal(s2.sinHistorial, true);
});

test('fecha local respeta la zona horaria', () => {
  assert.equal(localDate('2026-10-20T03:00:00Z', TZ), '2026-10-19');
});
