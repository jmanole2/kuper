// Agente de blog: noticias por RSS, redacción con correcciones, imagen de Pexels, HTML seguro y API para los sitios PHP.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

Object.assign(process.env, { DATA_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'blog-')), SECRET_KEY: 'x', LOG_EVENTOS: '0', PEXELS_API_KEY: 'px-123', PUBLIC_BASE_URL: 'https://redes.test', ADMIN_PASSWORD: 'maestra-123', SCHEDULER: '0' });
const db = await import('../src/db.js');
const blog = await import('../src/blog.js');
db.openDb(':memory:');
const cliente = db.createClient({ slug: 'k', nombre: 'Kuper', perfil: { cliente: 'x', pilares_de_contenido: [{ nombre: 'x' }] }, credentials: {}, config: { notificaciones: { email: 'yo@kuper.media' } } });
const correos = [];
blog.hooks.mail = async (m) => { correos.push(m); };
blog.hooks.smtp = () => true;

const RSS = `<rss><channel>
<item><title><![CDATA[La IA llega a las pymes mexicanas - El Economista]]></title><link>https://news.google.com/a1</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate><source url="https://eleconomista.com.mx">El Economista</source><description>&lt;a&gt;Más negocios usan IA&lt;/a&gt;</description></item>
<item><title>Otra noticia de tecnología</title><link>https://news.google.com/a2</link><pubDate>Sun, 25 Oct 2026</pubDate></item>
</channel></rss>`;
const pedidos = [];
blog.hooks.fetch = async (url, opt = {}) => {
  pedidos.push({ url, headers: opt.headers });
  if (url.includes('news.google.com/rss')) return { ok: true, text: async () => RSS };
  if (url.includes('api.pexels.com')) return { ok: true, json: async () => ({ photos: [{ id: 77, photographer: 'Ana Foto', photographer_url: 'https://pexels.com/@ana', url: 'https://pexels.com/photo/77', src: { large2x: 'https://images.pexels.com/77.jpg' } }] }) };
  if (url.includes('images.pexels.com')) return { ok: true, arrayBuffer: async () => new Uint8Array([255, 216, 255, 0]).buffer };
  return { ok: false, status: 404 };
};
const parrafos = '<p>' + 'Texto útil para el lector del blog sobre inteligencia artificial. '.repeat(18) + '</p>';
const bueno = (extra = {}) => ({
  titulo: 'Inteligencia artificial en pymes: qué cambia este año', slug: 'inteligencia-artificial-en-pymes', meta_title: 'Inteligencia artificial en pymes este año',
  meta_description: 'Qué significa que más pymes en México usen inteligencia artificial, por qué importa y qué puedes hacer hoy en tu negocio con ella.',
  extracto: 'Más negocios usan IA.', categoria: 'ia', etiquetas: ['ia', 'pymes', 'negocios'], palabra_clave: 'inteligencia artificial en pymes',
  contenido_html: `${parrafos}<h2>Qué pasó con la inteligencia artificial en pymes</h2>${parrafos}<h2>Qué hacer</h2>${parrafos}<script>alert(1)</script><a href="javascript:x">mal</a>`,
  fuentes: [{ titulo: 'La IA llega', url: 'https://news.google.com/a1' }], noticia_base_url: 'https://news.google.com/a1',
  busqueda_imagen: 'small business technology', prompt_imagen: 'x', alt_imagen: 'Persona usando una laptop', ...extra,
});

let sitio;
test('alta de sitio con categorías', () => {
  assert.throws(() => blog.parseSitio({ nombre: 'Mi blog', categorias: '' }), /al menos una categoría/);
  sitio = blog.guardarSitio(cliente.id, blog.parseSitio({ nombre: 'Blog Kuper', dominio: 'https://kuper.media', categorias: 'IA | inteligencia artificial pymes\nMarketing digital', frecuencia: '3_por_semana', modo: 'aprobacion', activo: '1', palabras: '600' }));
  assert.equal(sitio.slug, 'blog-kuper');
  assert.deepEqual(sitio.config.categorias.map((c) => c.slug), ['ia', 'marketing-digital']);
  assert.throws(() => blog.guardarSitio(cliente.id, blog.parseSitio({ nombre: 'Blog Kuper', categorias: 'X' })), /Ya existe/);
});

test('lee noticias de Google Noticias por RSS', async () => {
  const n = await blog.buscarNoticias(sitio, sitio.config.categorias[0]);
  assert.equal(n.length, 2);
  assert.equal(n[0].fuente, 'El Economista'); assert.equal(n[0].resumen, 'Más negocios usan IA');
  assert.match(pedidos[0].url, /news\.google\.com\/rss\/search\?q=inteligencia%20artificial%20pymes%20when%3A7d&hl=es-419&gl=MX/);
});

test('HTML seguro: sin scripts, sin javascript:, h1 pasa a h2', () => {
  const h = blog.limpiarHtml('<h1 class="x">T</h1><p style="a" onclick="b">Hola <a href="https://x.com" onclick="y">x</a> <a href="javascript:alert(1)">y</a></p><script>mal()</script><img src=x>');
  assert.equal(h, '<h2>T</h2><p>Hola <a href="https://x.com" target="_blank" rel="noopener nofollow">x</a> <a>y</a></p>');
});

test('escribe, corrige lo que no pasa la revisión y pone foto de Pexels', async () => {
  const llamadas = [];
  blog.hooks.pedir = async (args) => {
    llamadas.push(args);
    const data = llamadas.length === 1 ? bueno({ meta_description: 'corta', fuentes: [{ titulo: 'inventada', url: 'https://inventada.com' }] }) : bueno();
    return { data, content: JSON.stringify(data) };
  };
  const a = await blog.generarArticulo(sitio.id);
  assert.equal(llamadas.length, 2, 'una corrección');
  assert.match(llamadas[1].messages.at(-1).content, /meta_description[\s\S]*inventada\.com/);
  assert.equal(a.status, 'borrador'); assert.equal(a.slug, 'inteligencia-artificial-en-pymes'); assert.equal(a.categoria, 'ia');
  assert.doesNotMatch(a.contenido_html, /<script|javascript:/);
  assert.equal(a.imagen_credito.autor, 'Ana Foto'); assert.ok(fs.existsSync(a.imagen_path));
  assert.equal(pedidos.find((p) => p.url.includes('api.pexels.com')).headers.Authorization, 'px-123');
  assert.equal(a.noticia_url, 'https://news.google.com/a1');
  assert.equal((await blog.buscarNoticias(sitio, sitio.config.categorias[0])).length, 1, 'no vuelve a usar la misma noticia');
});

test('solo lo publicado sale en la API de los sitios', async () => {
  assert.equal(blog.apiLista('blog-kuper').total, 0);
  const [a] = blog.listarArticulos(sitio.id);
  blog.publicar(a.id);
  const l = blog.apiLista('blog-kuper');
  assert.equal(l.total, 1); assert.equal(l.articulos[0].categoria, 'IA');
  assert.match(l.articulos[0].imagen, /^https:\/\/redes\.test\/media\/blog-blog-kuper-/);
  assert.equal(l.articulos[0].contenido_html, undefined, 'la lista no trae el contenido completo');
  assert.deepEqual(l.categorias.map((c) => [c.slug, c.total]), [['ia', 1], ['marketing-digital', 0]]);
  const d = blog.apiArticulo('blog-kuper', a.slug);
  assert.match(d.articulo.contenido_html, /<h2>/); assert.equal(d.articulo.fuentes.length, 1);
  assert.equal(blog.apiArticulo('blog-kuper', 'no-existe'), null);
  assert.equal(blog.apiSitemap('blog-kuper').length, 1);
  assert.equal(blog.siguienteCategoria(blog.getSitio(sitio.id)).slug, 'marketing-digital', 'rota a la categoría menos usada');
});

test('calendario: con 3 por semana toca cada 2 días', () => {
  const s = blog.getSitio(sitio.id);
  assert.equal(blog.tocaSitio(s, new Date()), false, 'acaba de escribir uno');
  assert.equal(blog.tocaSitio(s, new Date(Date.now() + 2 * 86400_000)), true);
  // Por día de calendario: si el último salió tarde en la madrugada, a los 2 días toca desde temprano.
  db.getDb().prepare("UPDATE blog_articulos SET created_at = datetime('now', '-1 day', '-20 hours') WHERE sitio_id = ?").run(sitio.id);
  assert.equal(blog.tocaSitio(s, new Date(Date.now() + 4 * 3600_000)), true);
  // Un artículo escrito a mano no frena la programación.
  db.getDb().prepare("INSERT INTO blog_articulos (sitio_id, status, tema_pedido) VALUES (?, 'publicado', 'Escrito a mano')").run(sitio.id);
  assert.equal(blog.tocaSitio(s, new Date(Date.now() + 4 * 3600_000)), true);
  db.getDb().prepare("DELETE FROM blog_articulos WHERE tema_pedido = 'Escrito a mano'").run();
  db.getDb().prepare("UPDATE blog_articulos SET created_at = datetime('now') WHERE sitio_id = ?").run(sitio.id);
});

test('tema pedido: se usa en el siguiente artículo y sale de la lista', async () => {
  blog.agregarTemaBlog(sitio.id, 'Cómo usar IA en un restaurante');
  let entrada = '';
  blog.hooks.pedir = async (args) => { entrada = args.messages[0].content; const data = bueno({ slug: 'ia-en-restaurantes', titulo: 'Inteligencia artificial en restaurantes: guía rápida' }); return { data, content: '' }; };
  const a = await blog.generarArticulo(sitio.id);
  assert.match(entrada, /TEMA PEDIDO[\s\S]*Cómo usar IA en un restaurante/);
  assert.equal(a.tema_pedido, 'Cómo usar IA en un restaurante');
  assert.equal(blog.getSitio(sitio.id).config.temas_pendientes.length, 0);
});

test('panel: alta de sitio, escribir, revisar y publicar; el JSON público solo trae lo publicado', async () => {
  const { createApp } = await import('../src/server.js');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const login = await fetch(`${base}/entrar`, { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: '', password: 'maestra-123' }) });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    const post = (u, body) => fetch(`${base}${u}`, { method: 'POST', redirect: 'manual', headers: { cookie, 'Content-Type': 'application/x-www-form-urlencoded', Origin: base }, body: new URLSearchParams(body) });
    const get = (u) => fetch(`${base}${u}`, { headers: { cookie } });
    let r = await post(`/admin/clientes/${cliente.id}/blog/sitios`, { nombre: 'Blog Recetas', dominio: 'https://recetas.mx', categorias: 'Cocina mexicana | recetas mexicanas', frecuencia: 'semanal', modo: 'aprobacion', activo: '1', palabras: '600' });
    assert.equal(r.status, 303);
    const s = blog.sitioPorSlug('blog-recetas');
    assert.ok(s);
    blog.hooks.pedir = async () => { const data = bueno({ categoria: 'cocina-mexicana', slug: 'mole-poblano-facil', titulo: 'Mole poblano fácil: la receta que sí sale a la primera', palabra_clave: 'mole poblano' }); return { data, content: '' }; };
    r = await post(`/admin/clientes/${cliente.id}/blog/sitios/${s.id}/generar`, { accion: 'ya', tema: '' });
    assert.equal(r.status, 303);
    for (let i = 0; i < 50 && !blog.listarArticulos(s.id).some((a) => a.status === 'borrador'); i++) await new Promise((ok) => setTimeout(ok, 20));
    const a = blog.listarArticulos(s.id)[0];
    assert.equal(a.status, 'borrador');
    const pagina = await (await get(`/admin/clientes/${cliente.id}/blog?sitio=${s.id}`)).text();
    assert.match(pagina, /Mole poblano fácil/); assert.match(pagina, /\$SITIO = &#39;blog-recetas&#39;|\$SITIO = 'blog-recetas'/);
    assert.match(await (await get(`/admin/blog/articulos/${a.id}`)).text(), /Así se vería en Google/);
    assert.equal((await (await fetch(`${base}/blog/blog-recetas/articulos.json`)).json()).total, 0);
    await post(`/admin/blog/articulos/${a.id}/editar`, { titulo: 'Mole poblano fácil: receta paso a paso', slug: 'mole-poblano', meta_title: 'Mole poblano fácil', meta_description: 'x', categoria: 'cocina-mexicana', etiquetas: 'mole, recetas', extracto: 'Rico', contenido_html: '<p>Hola</p><script>x</script>' });
    await post(`/admin/blog/articulos/${a.id}/publicar`, {});
    const lista = await fetch(`${base}/blog/blog-recetas/articulos.json`);
    assert.equal(lista.headers.get('access-control-allow-origin'), '*');
    const j = await lista.json();
    assert.equal(j.total, 1); assert.equal(j.articulos[0].slug, 'mole-poblano'); assert.equal(j.articulos[0].titulo, 'Mole poblano fácil: receta paso a paso');
    const d = await (await fetch(`${base}/blog/blog-recetas/articulo/mole-poblano.json`)).json();
    assert.equal(d.articulo.contenido_html, '<p>Hola</p>');
    assert.equal((await fetch(`${base}/blog/blog-recetas/articulo/no-existe.json`)).status, 404);
    // cambiar imagen: subir una propia, buscar otra en Pexels y quitarla
    const fd = new FormData(); fd.append('archivo', new Blob([new Uint8Array([255, 216, 255, 0])], { type: 'image/jpeg' }), 'mia.jpg');
    r = await fetch(`${base}/admin/blog/articulos/${a.id}/imagen`, { method: 'POST', redirect: 'manual', headers: { cookie, Origin: base }, body: fd });
    assert.match(r.headers.get('location'), /ok=Imagen/);
    assert.equal(blog.getArticulo(a.id).imagen_credito.fuente, 'Propia');
    r = await post(`/admin/blog/articulos/${a.id}/imagen`, { busqueda: 'mole' });
    const conPexels = blog.getArticulo(a.id);
    assert.ok(conPexels.imagen_credito.fuente === 'Pexels' || /Error/.test(decodeURIComponent(r.headers.get('location'))));
    await post(`/admin/blog/articulos/${a.id}/imagen`, { accion: 'quitar' });
    assert.equal(blog.getArticulo(a.id).imagen_path, null);
  } finally { server.close(); }
});

test('modo automático: se publica solo y llega el correo de aviso', async () => {
  const s = blog.guardarSitio(cliente.id, blog.parseSitio({ nombre: 'Blog Auto', dominio: 'https://auto.mx', categorias: 'IA | inteligencia artificial', activo: '1', palabras: '600' }));
  assert.equal(s.config.modo, 'auto', 'por defecto se publica solo');
  blog.hooks.pedir = async () => { const data = bueno({ slug: 'ia-auto' }); return { data, content: '' }; };
  const antes = correos.length;
  const a = await blog.generarArticulo(s.id);
  assert.equal(a.status, 'publicado');
  const m = correos[antes];
  assert.equal(m.to, 'yo@kuper.media');
  assert.match(m.subject, /Nuevo artículo publicado en Blog Auto/);
  assert.match(m.html, /https:\/\/auto\.mx\/blog\/ia-auto/); assert.match(m.html, /\/admin\/blog\/articulos\//);
  // con errores que no se corrigieron, queda por revisar y el correo lo dice
  blog.hooks.pedir = async () => { const data = bueno({ slug: 'ia-auto-2', meta_description: 'corta' }); return { data, content: '' }; };
  const b = await blog.generarArticulo(s.id);
  assert.equal(b.status, 'borrador');
  assert.match(correos.at(-1).subject, /para revisar/);
});

test('artículo escrito a mano: texto simple a HTML, foto de Pexels y publicado', async () => {
  assert.equal(blog.textoAHtml('Hola **mundo**.\n\n## Qué pasó\nDetalle\n\n- uno\n- dos\n\n1. a\n2. b'),
    '<p>Hola <strong>mundo</strong>.</p><h2>Qué pasó</h2><p>Detalle</p><ul><li>uno</li><li>dos</li></ul><ol><li>a</li><li>b</li></ol>');
  const s = blog.sitioPorSlug('blog-kuper');
  await assert.rejects(blog.articuloManual(s.id, { titulo: 'Corto', contenido: 'x' }), /título/);
  const a = await blog.articuloManual(s.id, { titulo: 'La falla de PHP que encontró una IA', categoria: 'ia', contenido: ('Párrafo con contenido útil. '.repeat(30)) + '\n\n## Qué hacer\n\n- Actualiza PHP', fuentes: 'La República | https://larepublica.co/x\nhttps://otra.com/y', busqueda_imagen: 'server security', publicar: true });
  assert.equal(a.status, 'publicado'); assert.equal(a.slug, 'la-falla-de-php-que-encontro-una-ia');
  assert.match(a.contenido_html, /<h2>Qué hacer<\/h2><ul><li>Actualiza PHP<\/li><\/ul>$/);
  assert.deepEqual(a.fuentes.map((f) => f.titulo), ['La República', 'https://otra.com/y']);
  assert.ok((a.imagen_path || a.advertencias.length) && a.meta_description.length <= 160, 'foto o aviso de por qué no hay');
});
