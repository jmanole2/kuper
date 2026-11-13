// Avisos que manda el agente de WhatsApp de un cliente ("pide hablar con alguien", "requiere atención",
// "sigue esperando respuesta"). Se guardan en el lead y se mandan por correo al aviso del cliente
// (Configuración → Notificaciones), con el SMTP del panel: así le llegan aunque el agente no tenga correo.
import * as db from './db.js';
import { config } from './config.js';
import { sendMail, smtpConfigured } from './notify.js';
import { asignarPorTurno } from './embudo.js';
import * as push from './push.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const hooks = { send: (m) => sendMail(m) }; // pruebas

export async function recibir(client, body = {}) {
  const titulo = String(body.titulo || 'El agente necesita que alguien atienda esta conversación').slice(0, 160);
  const texto = String(body.texto || '').slice(0, 2000);
  let lead = null;
  try {
    lead = db.upsertLead(client.id, { nombre: body.nombre || undefined, telefono: body.telefono, usuario: body.usuario, origen: body.origen || 'whatsapp', nota: `⚠️ ${titulo}` });
    lead = asignarPorTurno(client, lead); // pasa a un asesor: se le asigna por turnos si no tiene uno
    if (texto) db.getDb().prepare('UPDATE leads SET resumen = ? WHERE id = ?').run(texto.slice(0, 1500), lead.id);
  } catch { /* aviso sin teléfono ni usuario: solo se manda el correo */ }
  db.logEvent({ clientId: client.id, tipo: 'aviso_agente', detalle: `${titulo}${lead?.nombre ? ` · ${lead.nombre}` : ''}` });
  push.avisar(client, { titulo: `${body.urgente ? '🔴 ' : ''}${titulo}`, texto: `${lead?.nombre || body.nombre || ''} ${texto}`.trim(), url: lead ? `/app/leads/${lead.id}/chat` : '/app/leads', lead }).catch(() => {});

  // Si el lead tiene asesor, el correo le llega a él (y al correo de avisos del cliente).
  const asesor = lead?.asignado_id ? db.getUser(lead.asignado_id) : null;
  const para = [String(client.config.notificaciones?.email || '').trim(), asesor?.activo ? asesor.email : ''].filter(Boolean).join(', ');
  if (!body.correo || !para || !smtpConfigured()) return { ok: true, lead_id: lead?.id ?? null, correo: false, motivo: !para ? 'sin_correo_de_avisos' : !smtpConfigured() ? 'sin_smtp' : 'no_pedido' };

  const tel = String(body.telefono || '').replace(/\D/g, '');
  const mensajes = Array.isArray(body.mensajes) ? body.mensajes.slice(-8) : [];
  const burbuja = (m) => `<tr><td align="${m.rol === 'lead' ? 'left' : 'right'}" style="padding:3px 0"><div style="display:inline-block;max-width:85%;text-align:left;padding:8px 12px;border-radius:14px;font-size:14px;white-space:pre-wrap;background:${m.rol === 'lead' ? '#f1f1f1' : '#e6f4ea'}">${esc(String(m.texto || '').slice(0, 600))}</div></td></tr>`;
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6f6f6;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:18px;padding:22px"><tr><td>
<span style="background:${body.urgente ? '#ff6b6b' : '#ffd666'};font-size:12px;font-weight:700;border-radius:99px;padding:4px 10px;text-transform:uppercase">${body.urgente ? 'Atiende ya' : 'Revisa esto'}</span>
<div style="font-size:22px;font-weight:700;margin:12px 0 4px">${esc(lead?.nombre || body.nombre || 'Prospecto')}</div>
<div style="color:#444;font-size:15px;margin-bottom:12px">${esc(titulo)}</div>
${texto ? `<div style="color:#555;font-size:14px;white-space:pre-wrap;margin-bottom:12px">${esc(texto)}</div>` : ''}
<div>${tel ? `<a href="https://wa.me/${tel}" style="display:inline-block;margin:0 6px 8px 0;padding:12px 20px;border-radius:99px;font-weight:700;font-size:14px;text-decoration:none;background:#25d366;color:#111">Escribirle por WhatsApp</a>` : ''}<a href="${esc(config.publicBaseUrl)}/app/leads" style="display:inline-block;margin:0 6px 8px 0;padding:12px 20px;border-radius:99px;font-weight:700;font-size:14px;text-decoration:none;background:#eee;color:#111">Ver en el panel</a></div>
${mensajes.length ? `<div style="font-size:12px;color:#666;font-weight:700;text-transform:uppercase;margin:16px 0 6px">Últimos mensajes</div><table width="100%" cellpadding="0" cellspacing="0">${mensajes.map(burbuja).join('')}</table>` : ''}
<p style="color:#888;font-size:12px;margin-top:18px">Aviso del agente de WhatsApp de ${esc(client.nombre)}. El prospecto está esperando: escríbele desde tu WhatsApp o toma el control desde el panel.</p>
</td></tr></table></td></tr></table></body></html>`;
  await hooks.send({ to: para, subject: `${body.urgente ? '🔴' : '🙋'} ${titulo}: ${lead?.nombre || body.nombre || 'prospecto'}`.slice(0, 140), text: `${titulo}\n${texto}\n${tel ? `https://wa.me/${tel}` : ''}`, html });
  return { ok: true, lead_id: lead?.id ?? null, correo: true };
}
