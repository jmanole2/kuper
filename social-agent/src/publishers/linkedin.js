// Publicación en Páginas de empresa de LinkedIn con la Posts API oficial (REST).
// Credenciales por cliente: { linkedin: { org_id, access_token } }
//   - Requiere una app con el producto "Community Management API" y el permiso w_organization_social.
//   - El access_token caduca a los 60 días; renovarlo desde el panel de admin (o con refresh token si la app lo tiene).
import fs from 'node:fs';
import { config } from '../config.js';

const API = 'https://api.linkedin.com/rest';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function headers(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': config.linkedinApiVersion,
    'X-Restli-Protocol-Version': '2.0.0',
    ...extra,
  };
}

async function li(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: headers(token, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return { raw: text }; } })() : {};
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${json.message || json.raw || text.slice(0, 300)}`);
  return { json, headers: res.headers };
}

async function putBinary(url, token, buf) {
  const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' }, body: buf });
  if (!res.ok) throw new Error(`LinkedIn subida ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.headers.get('etag');
}

// El texto de LinkedIn usa el formato "little": hay caracteres reservados que se escapan,
// y los hashtags se escriben como {hashtag|\#|palabra}.
export function toLittleText(copy, hashtags = []) {
  const esc = (s) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  const tags = hashtags.map((h) => `{hashtag|\\#|${h.replace(/^#/, '')}}`).join(' ');
  return esc(copy) + (tags ? `\n\n${tags}` : '');
}

async function uploadImage(owner, token, file) {
  const { json } = await li('POST', '/images?action=initializeUpload', token, { initializeUploadRequest: { owner } });
  await putBinary(json.value.uploadUrl, token, fs.readFileSync(file));
  return json.value.image;
}

async function uploadVideo(owner, token, file, { timeoutMs = 10 * 60_000, pollMs = 5000 } = {}) {
  const buf = fs.readFileSync(file);
  const { json } = await li('POST', '/videos?action=initializeUpload', token, {
    initializeUploadRequest: { owner, fileSizeBytes: buf.length, uploadCaptions: false, uploadThumbnail: false },
  });
  const { video, uploadInstructions, uploadToken = '' } = json.value;
  const etags = [];
  for (const part of uploadInstructions) {
    etags.push(await putBinary(part.uploadUrl, token, buf.subarray(part.firstByte, part.lastByte + 1)));
  }
  await li('POST', '/videos?action=finalizeUpload', token, { finalizeUploadRequest: { video, uploadToken, uploadedPartIds: etags } });
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const { json: v } = await li('GET', `/videos/${encodeURIComponent(video)}`, token);
    if (v.status === 'AVAILABLE') return video;
    if (v.status === 'PROCESSING_FAILED') throw new Error('LinkedIn no pudo procesar el video');
    await sleep(pollMs);
  }
  throw new Error('LinkedIn tardó demasiado en procesar el video');
}

/** post: { copy, hashtags, imageFile?, videoFile?, altText?, title? } */
export async function publishLinkedIn(creds, post, opts = {}) {
  if (!creds?.org_id || !creds?.access_token) throw new Error('Faltan credenciales de LinkedIn: org_id, access_token');
  const owner = `urn:li:organization:${String(creds.org_id).replace(/^urn:li:organization:/, '')}`;
  const token = creds.access_token;
  const body = {
    author: owner,
    commentary: toLittleText(post.copy, post.hashtags),
    visibility: 'PUBLIC',
    distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  };
  if (post.videoFile) {
    body.content = { media: { id: await uploadVideo(owner, token, post.videoFile, opts), title: post.title || '' } };
  } else if (post.imageFile) {
    body.content = { media: { id: await uploadImage(owner, token, post.imageFile), altText: post.altText || '' } };
  }
  const { headers: h } = await li('POST', '/posts', token, body);
  const id = h.get('x-restli-id') || h.get('x-linkedin-id');
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
}
