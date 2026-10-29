import test from 'node:test';
import assert from 'node:assert/strict';
import { elegirReceta, erroresReceta, elegirDireccion, resumenGuion, DIRECCIONES } from '../src/rotacion.js';

const perfil = { voz: '', pilares_de_contenido: ['agente whatsapp', 'blog', 'redes', 'llamadas', 'anuncios', 'web'].map((nombre) => ({ nombre })) };
const h = (pilar, extra = {}) => ({ plataforma: 'instagram', pilar, tipo_post: 'historia', estructura: 'antes_despues', formato: 'video_animado', formula: 21, ...extra });

test('receta: no repite pilar reciente, estructura, tipo ni fórmulas usadas', () => {
  const historial = [h('agente whatsapp'), h('agente whatsapp', { estructura: 'comparacion' }), h('blog', { estructura: 'checklist', formula: 5 })];
  for (let i = 0; i < 30; i++) {
    const r = elegirReceta({ perfil, plataforma: 'instagram', historial });
    assert.ok(!['agente whatsapp', 'blog'].includes(r.pilar), r.pilar);
    assert.ok(!['antes_despues', 'comparacion', 'checklist'].includes(r.estructura));
    assert.notEqual(r.tipo_post, 'historia');
    assert.notEqual(r.tipo_post, 'prueba'); // la voz no trae pruebas
    assert.equal(r.formulas.length, 5);
    assert.ok(!r.formulas.includes(21) && !r.formulas.includes(5));
    assert.notEqual(r.formato, 'video_animado'); // ya van tres videos seguidos
  }
});

test('receta: con tema pedido no impone pilar', () => {
  assert.equal(elegirReceta({ perfil, plataforma: 'instagram', tema: 'promo' }).pilar, undefined);
});

test('erroresReceta detecta pilar, estructura, formato y fórmula fuera de la receta', () => {
  const receta = { pilar: 'redes', estructura: 'mito_realidad', formato: 'carrusel', formulas: [1, 2, 3, 4, 6] };
  const out = { pilar_de_contenido: 'blog', estructura: 'checklist', formato_contenido: 'video_animado', ganchos: [{ formula_id: 21 }], gancho_elegido: 0 };
  assert.equal(erroresReceta(out, receta).length, 4);
  assert.deepEqual(erroresReceta({ pilar_de_contenido: 'Redes', estructura: 'mito_realidad', formato_contenido: 'carrusel', ganchos: [{ formula_id: 2 }], gancho_elegido: 0 }, receta), []);
});

test('dirección visual: nunca una de las 4 últimas', () => {
  const anteriores = DIRECCIONES.slice(0, 4).map((d) => ({ direccion: d.id }));
  for (let i = 0; i < 30; i++) assert.ok(!anteriores.some((a) => a.direccion === elegirDireccion(anteriores).id));
});

test('resumenGuion saca gancho, fórmula y titulares', () => {
  const r = resumenGuion({ ganchos: [{ formula_id: 3, en_pantalla: 'a' }, { formula_id: 9, en_pantalla: 'b' }], gancho_elegido: 1, animacion: { escenas: [{ titular: 'x' }, { titular: 'y' }] } });
  assert.deepEqual(r, { gancho: 'b', formula: 9, titulares: ['x', 'y'] });
});

test('historia: arma 1080x1920 con la pieza completa y fondo desenfocado', async () => {
  const { argsHistoria, rutaHistoria } = await import('../src/media/historia.js');
  assert.equal(rutaHistoria('/m/a-b.mp4'), '/m/a-b-historia.mp4');
  assert.equal(rutaHistoria('/m/a.png'), '/m/a-historia.jpg');
  const a = argsHistoria('/m/a.mp4', '/m/a-historia.mp4').join(' ');
  assert.match(a, /force_original_aspect_ratio=decrease/);
  assert.match(a, /0:a\?/);
});

test('temas agotados: WhatsApp en muchos posts se prohíbe salvo en su pilar', async () => {
  const { temasAgotados } = await import('../src/rotacion.js');
  const historial = [
    h('a', { tema: 'El negocio que dejaba los mensajes de WhatsApp sin responder', gancho: 'Te escribió de noche' }),
    h('b', { tema: 'Contestar WhatsApp a mano te cuesta clientes' }),
    h('c', { tema: 'Diseño web que sí vende' }),
    h('d', { tema: 'Por qué tu WhatsApp pierde ventas en la noche' }),
    h('e', { tema: 'Tu logo no es tu marca' }),
  ];
  assert.ok(temasAgotados(historial).includes('whatsapp'));
  const r = elegirReceta({ perfil, plataforma: 'instagram', historial });
  if (r.pilar !== 'agente whatsapp') assert.ok(r.evitar.includes('whatsapp'));
  const errs = erroresReceta({ pilar_de_contenido: r.pilar, estructura: r.estructura, formato_contenido: r.formato, tema: 'El error de los anuncios sin WhatsApp atendido', ganchos: [{ formula_id: r.formulas[0] }], gancho_elegido: 0 }, { ...r, evitar: ['whatsapp'] });
  assert.ok(errs.some((e) => /whatsapp/.test(e)));
  const conPilar = elegirReceta({ perfil: { ...perfil, pilares_de_contenido: [{ nombre: 'agente whatsapp' }] }, plataforma: 'instagram', historial });
  assert.ok(!conPilar.evitar?.includes('whatsapp'));
});

test('tema casi igual a uno reciente se rechaza', () => {
  const errs = erroresReceta({ tema: 'Mensajes de WhatsApp sin responder hasta la mañana' }, { recientes: ['El negocio que dejaba los mensajes de WhatsApp sin responder hasta la mañana siguiente'] });
  assert.equal(errs.length, 1);
});
