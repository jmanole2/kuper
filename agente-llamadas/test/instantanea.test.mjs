import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as inst from '../instantanea.mjs';
import { promptChat } from '../chat.mjs';
import { construirPrompt } from '../prompt.mjs';
import { readFileSync } from 'node:fs';

const html = `<html><head><title>Clínica Sonrisa | Dentista en Coyoacán</title><meta name="description" content="Limpieza, blanqueamiento y ortodoncia">
<link rel="icon" href="/fav.png"></head><body><script>var x=1</script><nav><a href="/contacto">Contacto</a><a href="https://otro.com/precios">fuera</a></nav>
<h1>Clínica Sonrisa</h1><p>Limpieza dental $850 &amp; blanqueamiento $3,500.</p><p>Lunes a sábado 9 a 19 h</p></body></html>`;
const paginas = { 'https://sonrisa.mx/': html, 'https://sonrisa.mx/contacto': '<p>Av. México 123, Coyoacán. WhatsApp 55 1234 5678</p>' };
inst.hooks.lookup = async (h) => (h === 'interna.mx' ? [{ address: '10.0.0.5' }] : h === 'rebind.mx' ? [{ address: '127.0.0.1' }] : [{ address: '93.184.216.34' }]);
inst.hooks.fetch = async (u) => {
  const k = String(u);
  if (k === 'https://redirige.mx/') return new Response('', { status: 301, headers: { location: 'http://interna.mx/admin' } });
  if (paginas[k]) return new Response(paginas[k], { headers: { 'content-type': 'text/html' } });
  return new Response('no', { status: 404 });
};

test('normaliza links y rechaza los raros', () => {
  assert.equal(inst.normalizarUrl('sonrisa.mx').href, 'https://sonrisa.mx/');
  assert.equal(inst.normalizarUrl('@clinica.sonrisa').hostname, 'www.instagram.com');
  assert.equal(inst.normalizarUrl('ftp://x.mx'), null);
  assert.equal(inst.normalizarUrl('https://user:pass@x.mx'), null);
  assert.equal(inst.normalizarUrl('https://x.mx:8080'), null);
  assert.equal(inst.normalizarUrl('localhost'), null);
});

test('no abre direcciones internas, ni directas ni por redirección', async () => {
  await assert.rejects(() => inst.descargar(new URL('https://interna.mx/')), /direccion_no_permitida/);
  await assert.rejects(() => inst.descargar(new URL('https://rebind.mx/')), /direccion_no_permitida/);
  await assert.rejects(() => inst.descargar(new URL('https://redirige.mx/')), /direccion_no_permitida/);
  await assert.rejects(() => inst.descargar(new URL('http://169.254.169.254/')), /direccion_no_permitida/);
  await assert.rejects(() => inst.descargar(new URL('http://[::1]/')), /direccion_no_permitida/);
});

test('lee el texto visible, el logo y la página de contacto', async () => {
  const s = await inst.leerSitio(new URL('https://sonrisa.mx/'));
  assert.equal(s.titulo, 'Clínica Sonrisa | Dentista en Coyoacán');
  assert.match(s.texto, /Limpieza dental \$850 & blanqueamiento/);
  assert.doesNotMatch(s.texto, /var x/);
  assert.match(s.texto, /WhatsApp 55 1234 5678/); // de /contacto
  assert.equal(s.logo, 'https://sonrisa.mx/fav.png');
});

test('arma el negocio con la IA y rechaza lo que no es negocio', async () => {
  inst.hooks.ia = async ({ texto }) => (/Sonrisa/.test(texto) ? { es_negocio: true, negocio: 'Clínica Sonrisa', giro: 'Clínica dental en Coyoacán', servicios: ['Limpieza $850', 'Blanqueamiento $3,500'],
    horario: 'Lunes a sábado de 9 a 19 h', ubicacion: 'Av. México 123', contacto: '', preguntas_frecuentes: ['¿Aceptan tarjeta?: Sí'], tipo_de_cita: 'agendar una cita', tono: 'de usted' } : { es_negocio: false });
  const n = await inst.armarNegocio({ sitio: { url: 'x', titulo: 'Clínica Sonrisa', desc: '', sitio: '', texto: 'Clínica Sonrisa' } });
  assert.equal(n.negocio, 'Clínica Sonrisa');
  await assert.rejects(() => inst.armarNegocio({ descripcion: 'casino en línea' }), /no_es_negocio/);
  // guardar, variables de la llamada y prompt del chat
  const a = inst.almacen(mkdtempSync(join(tmpdir(), 'inst-')));
  const d = a.crear({ negocio: n, contacto: { nombre: 'Ana' } });
  assert.equal(a.leer(d.id).negocio.negocio, 'Clínica Sonrisa');
  assert.equal(a.leer('../../etc/passwd'), null);
  const v = inst.variables(d);
  assert.match(v.servicios, /Limpieza \$850\n- Blanqueamiento/);
  assert.match(v.saludo, /gracias por llamar a Clínica Sonrisa/);
  const base = JSON.parse(readFileSync(new URL('../demos/instantanea.json', import.meta.url)));
  const p = promptChat(inst.cfgChat(d, base));
  assert.match(p, /asistente virtual de Clínica Sonrisa, Clínica dental en Coyoacán/);
  assert.match(p, /- Limpieza \$850/);
  assert.doesNotMatch(p, /\{\{negocio\}\}/);
  // el prompt de la voz deja las variables para Retell
  assert.match(construirPrompt(base), /asistente virtual de \{\{negocio\}\}, \{\{giro\}\}/);
});
