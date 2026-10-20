import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishInstagram, publishFacebook } from '../src/publishers/meta.js';
import { publishLinkedIn, toLittleText } from '../src/publishers/linkedin.js';

function mockFetch(handler) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || 'GET', body: opts.body, headers: opts.headers });
    const [status, body, headers = {}] = handler(u, opts, calls.length);
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
  };
  return { calls, restore: () => { globalThis.fetch = orig; } };
}

test('Instagram: imagen → contenedor → publicar', async () => {
  const m = mockFetch((u) => {
    if (u.includes('/media_publish')) return [200, { id: 'MEDIA1' }];
    if (u.includes('/IG1/media')) return [200, { id: 'CONT1' }];
    if (u.includes('/MEDIA1')) return [200, { permalink: 'https://instagram.com/p/x' }];
    return [404, { error: { message: 'no' } }];
  });
  try {
    const r = await publishInstagram({ ig_user_id: 'IG1', page_token: 'T' }, { caption: 'hola', imageUrl: 'https://x/a.jpg', altText: 'alt' });
    assert.deepEqual(r, { id: 'MEDIA1', url: 'https://instagram.com/p/x' });
    const body = new URLSearchParams(m.calls[0].body);
    assert.equal(body.get('image_url'), 'https://x/a.jpg');
    assert.equal(body.get('access_token'), 'T');
    assert.equal(new URLSearchParams(m.calls[1].body).get('creation_id'), 'CONT1');
  } finally { m.restore(); }
});

test('Instagram: Reel espera a que el video termine de procesarse', async () => {
  let polls = 0;
  const m = mockFetch((u) => {
    if (u.includes('/media_publish')) return [200, { id: 'M2' }];
    if (u.includes('/IG1/media')) return [200, { id: 'C2' }];
    if (u.includes('/C2?')) return [200, { status_code: ++polls < 2 ? 'IN_PROGRESS' : 'FINISHED' }];
    return [200, {}];
  });
  try {
    const r = await publishInstagram({ ig_user_id: 'IG1', page_token: 'T' }, { caption: 'c', videoUrl: 'https://x/v.mp4' }, { pollMs: 1 });
    assert.equal(r.id, 'M2');
    assert.equal(new URLSearchParams(m.calls[0].body).get('media_type'), 'REELS');
    assert.equal(polls, 2);
  } finally { m.restore(); }
});

test('Meta: los errores de la API se reportan legibles', async () => {
  const m = mockFetch(() => [400, { error: { message: 'Invalid OAuth access token', code: 190 } }]);
  try {
    await assert.rejects(publishFacebook({ page_id: 'P', page_token: 'T' }, { caption: 'x' }), /Invalid OAuth access token.*190/);
  } finally { m.restore(); }
});

test('LinkedIn: escapa texto y convierte hashtags', () => {
  assert.equal(toLittleText('Hola (mundo) @todos', ['#pymes']), 'Hola \\(mundo\\) \\@todos\n\n{hashtag|\\#|pymes}');
});

test('LinkedIn: sube imagen y crea el post', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'li-'));
  const img = path.join(dir, 'a.jpg');
  fs.writeFileSync(img, Buffer.from([1, 2, 3]));
  const m = mockFetch((u, opts) => {
    if (u.includes('/images?action=initializeUpload')) return [200, { value: { uploadUrl: 'https://upload.example/x', image: 'urn:li:image:1' } }];
    if (u.startsWith('https://upload.example')) return [201, ''];
    if (u.endsWith('/rest/posts')) return [201, '', { 'x-restli-id': 'urn:li:share:9' }];
    return [404, '{}'];
  });
  try {
    const r = await publishLinkedIn({ org_id: '123', access_token: 'LT' }, { copy: 'Texto', hashtags: [], imageFile: img, altText: 'alt' });
    assert.equal(r.id, 'urn:li:share:9');
    const post = JSON.parse(m.calls.at(-1).body);
    assert.equal(post.author, 'urn:li:organization:123');
    assert.equal(post.content.media.id, 'urn:li:image:1');
    assert.equal(m.calls.at(-1).headers['X-Restli-Protocol-Version'], '2.0.0');
  } finally { m.restore(); }
});

test('Instagram: historia con el video del Reel', async () => {
  const { publishInstagramStory } = await import('../src/publishers/meta.js');
  const m = mockFetch((u, o) => {
    if (u.includes('/media_publish')) return [200, { id: 'ST1' }];
    if (u.includes('/IG1/media')) return [200, { id: 'C1' }];
    if (u.includes('/C1')) return [200, { status_code: 'FINISHED' }];
    return [404, {}];
  });
  try {
    const r = await publishInstagramStory({ ig_user_id: 'IG1', page_token: 'T' }, { videoUrl: 'https://x/v.mp4' }, { pollMs: 1 });
    assert.equal(r.id, 'ST1');
    assert.equal(new URLSearchParams(m.calls[0].body).get('media_type'), 'STORIES');
  } finally { m.restore(); }
});

test('LinkedIn: puede publicar como perfil personal', async () => {
  const m = mockFetch((u) => {
    if (u.includes('/v2/userinfo')) return [200, { sub: 'abc' }];
    if (u.endsWith('/posts')) return [201, '', { 'x-restli-id': 'urn:li:share:9' }];
    return [404, {}];
  });
  try {
    const r = await publishLinkedIn({ access_token: 'T' }, { copy: 'hola', hashtags: [], as: 'perfil' });
    assert.equal(r.id, 'urn:li:share:9');
    assert.equal(JSON.parse(m.calls[1].body).author, 'urn:li:person:abc');
  } finally { m.restore(); }
});

test('LinkedIn: explica el error de permisos de organización', async () => {
  const m = mockFetch(() => [400, { message: 'Organization permissions must be used when using organization as owner' }]);
  try {
    await assert.rejects(publishLinkedIn({ org_id: '1', access_token: 'T' }, { copy: 'x', hashtags: [], imageFile: null }), /w_organization_social/);
  } finally { m.restore(); }
});
