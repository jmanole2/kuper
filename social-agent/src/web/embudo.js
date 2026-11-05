// Vistas del embudo de ventas (tablero), la ficha del lead y la analítica.
import { html, raw } from './html.js';
import { config } from '../config.js';
import { embudos, embudoDe, etapaDe, tagsDe, TIPOS, RESULTADOS, PRIORIDADES, colorTipo, embudosTexto } from '../embudo.js';

const ORIGEN = { manual: ['Agregado a mano', '#c9c3b8'], whatsapp: ['WhatsApp', '#25d366'], instagram: ['Instagram', '#e1306c'], facebook: ['Messenger', '#4f7cff'], llamada: ['Llamada', '#c9f53a'], web: ['Página de citas', '#93b4ff'], chat_web: ['Chat web', '#fbbf24'] };
const origen = (o) => ORIGEN[o] || [o || 'Otro', '#93b4ff'];
const mxn = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-MX')}`;
const nombreDe = (l) => l.nombre || (l.usuario ? `@${l.usuario}` : l.telefono || l.email || 'Lead');
const iniciales = (s) => String(s).replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).slice(0, 2).map((x) => x[0] || '').join('').toUpperCase() || 'L';
const utc = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
function cuando(s) {
  const d = utc(s), hoy = new Date();
  const f = (o) => new Intl.DateTimeFormat('es-MX', { timeZone: config.timezone, ...o }).format(d);
  const dia = (x) => new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(x);
  if (dia(d) === dia(hoy)) return f({ hour: 'numeric', minute: '2-digit' });
  if (dia(d) === dia(new Date(hoy - 86400000))) return 'Ayer';
  return f({ day: 'numeric', month: 'short' });
}
const minTxt = (m) => (m == null ? '—' : m < 1 ? `${Math.max(1, Math.round(m * 60))} s` : m < 90 ? `${Math.round(m)} min` : m < 48 * 60 ? `${(m / 60).toFixed(m < 600 ? 1 : 0)} h` : `${Math.round(m / 1440)} días`);

const CSS = `
.emb-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 16px}.emb-bar input,.emb-bar select{width:auto;min-width:180px;padding:9px 14px;border-radius:99px}
.emb{display:flex;gap:14px;overflow-x:auto;padding-bottom:16px;scroll-snap-type:x proximity;min-height:62vh}
.emb-col{flex:0 0 280px;scroll-snap-align:start;background:linear-gradient(180deg,rgba(255,246,232,.06),rgba(255,246,232,.025));border:1px solid var(--line);border-radius:22px;display:flex;flex-direction:column;max-height:76vh}
.emb-col.over{outline:2px dashed var(--accent);outline-offset:-4px}
.emb-h{padding:14px 16px 10px;border-bottom:2px solid var(--c,#93b4ff);display:flex;justify-content:space-between;align-items:center;gap:8px}
.emb-h b{font-size:13px;letter-spacing:.06em;text-transform:uppercase;font-weight:600}.emb-h em{font-style:normal;font-size:12px;color:var(--muted);background:rgba(0,0,0,.3);padding:2px 9px;border-radius:99px}
.emb-list{padding:10px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;flex:1}
.emb-card{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:11px 12px;border-radius:16px;background:rgba(18,17,16,.75);border:1px solid var(--line);text-decoration:none;color:inherit;cursor:grab;transition:transform .15s,border-color .15s}
.emb-card:hover{border-color:rgba(255,255,255,.22);transform:translateY(-1px)}.emb-card.drag{opacity:.45}
.emb-av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-weight:600;font-size:14px;color:#0b0d06;position:relative}
.emb-av i{position:absolute;right:-2px;bottom:-2px;width:14px;height:14px;border-radius:50%;border:2px solid #121110}
.emb-card strong{display:block;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.emb-card small{color:var(--muted);font-size:12px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.emb-card time{font-size:11px;color:var(--muted);align-self:start}.emb-v{font-size:11px;color:#4ade80}
.emb-f{padding:10px 16px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);display:flex;justify-content:space-between}
.emb-ia{display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(215,255,63,.12);color:#d7ff3f;margin-left:4px}
.emb-yo{display:inline-block;font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(147,180,255,.14);color:#93b4ff;margin-left:4px}
details.emb-cfg{margin-top:18px}details.emb-cfg textarea{min-height:190px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
`;

const TCSS = `
.emb-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 16px}.emb-tools input[type=search]{width:auto;min-width:220px;padding:9px 14px;border-radius:99px}
.pop{position:relative}.pop>summary{list-style:none;cursor:pointer;display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:99px;background:var(--card2);border:1px solid var(--line);font-size:14px;user-select:none}
.pop>summary::-webkit-details-marker{display:none}.pop[open]>summary,.pop>summary:hover{background:rgba(255,255,255,.12)}.pop>summary .dot{width:7px;height:7px;border-radius:50%;background:#f87171}
.pop .pnl{position:absolute;z-index:30;top:calc(100% + 8px);left:0;min-width:300px;background:#1c1a18;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:16px;box-shadow:0 24px 60px rgba(0,0,0,.55)}
.pop.der .pnl{left:auto;right:0}.pop .pnl label{font-size:12px;margin-top:10px}.pop .pnl h4{margin:0 0 4px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.pop .rad{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}.pop .rad label{margin:0}.pop .rad input{display:none}.pop .rad span{display:block;padding:6px 11px;border-radius:99px;border:1px solid var(--line);font-size:13px;cursor:pointer}
.pop .rad input:checked+span{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
.pop .opc a{display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;text-decoration:none}.pop .opc a:hover,.pop .opc a.on{background:rgba(255,255,255,.08)}
.btn-add{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:99px;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:14px;border:0}
.pop.add>summary{background:var(--accent);color:var(--accent-ink);font-weight:600;border-color:var(--accent)}
.emb-card .ext{grid-column:1/-1;font-size:12px;color:#cfc9bf;border-top:1px solid var(--line);padding-top:8px;margin-top:2px;line-height:1.4}
.emb-card .ext i{font-style:normal;display:inline-block;font-size:10.5px;padding:1px 7px;border-radius:99px;background:rgba(147,180,255,.14);color:#93b4ff;margin:0 4px 4px 0}
.emb-card .pri{margin-left:4px}
.emb-res{position:fixed;left:50%;bottom:22px;transform:translate(-50%,140%);transition:transform .2s;z-index:50;background:#1c1a18;border:1px solid rgba(255,255,255,.14);border-radius:24px;padding:12px 14px 14px;box-shadow:0 24px 70px rgba(0,0,0,.6);text-align:center}
.emb-res.on{transform:translate(-50%,0)}.emb-res p{margin:0 0 10px;font-size:13px;color:#cfc9bf}.emb-res div{display:flex;gap:10px}
.emb-res section{width:150px;padding:16px 10px;border-radius:18px;border:2px dashed var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);font-weight:600;font-size:14px;transition:.15s}
.emb-res section span{display:block;font-size:24px;margin-bottom:4px}.emb-res section.over{background:color-mix(in srgb,var(--c) 30%,transparent);transform:scale(1.04)}`;

const LADAS = [['52', '🇲🇽 +52'], ['1', '🇺🇸 +1'], ['34', '🇪🇸 +34'], ['57', '🇨🇴 +57'], ['54', '🇦🇷 +54'], ['56', '🇨🇱 +56'], ['51', '🇵🇪 +51'], ['593', '🇪🇨 +593'], ['502', '🇬🇹 +502'], ['506', '🇨🇷 +506'], ['58', '🇻🇪 +58'], ['55', '🇧🇷 +55']];

function filtrarLeads(client, leads, f, ultimos) {
  const t = (f.q || '').toLowerCase().trim();
  const desde = /^\d{4}-\d\d-\d\d$/.test(f.desde || '') ? f.desde : '', hasta = /^\d{4}-\d\d-\d\d$/.test(f.hasta || '') ? f.hasta : '';
  return leads.filter((l) => {
    if (t && !`${nombreDe(l)} ${l.telefono || ''} ${l.email || ''} ${l.empresa || ''} ${tagsDe(l).join(' ')}`.toLowerCase().includes(t)) return false;
    if (f.asesor && (f.asesor === '-' ? l.asignado_id : String(l.asignado_id) !== f.asesor)) return false;
    if (f.canal && l.origen !== f.canal) return false;
    if (f.estatus && (l.prioridad || 'neutral') !== f.estatus) return false;
    const u = ultimos[l.id];
    if (f.mensajes === 'esperando' && !(u && u.rol === 'lead')) return false;
    if (f.mensajes === 'respondidos' && !(u && u.rol !== 'lead')) return false;
    if (desde || hasta) {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(utc(f.fecha === 'actividad' ? l.updated_at : l.created_at));
      if ((desde && d < desde) || (hasta && d > hasta)) return false;
    }
    return true;
  });
}

export function embudoSection(client, leads, { base, asesores = [], aviso = '', error = '', embudo = '', importar = false, filtros = {}, vista = 'compacta', ultimos = {} } = {}) {
  const todos = embudos(client);
  const emb = todos.find((x) => x.id === embudo) || todos[0];
  const cuenta = Object.fromEntries(todos.map((x) => [x.id, 0]));
  for (const l of leads) cuenta[embudoDe(client, l).id] += 1;
  const origenes = [...new Set(leads.map((l) => l.origen))];
  leads = filtrarLeads(client, leads.filter((l) => embudoDe(client, l).id === emb.id), filtros, ultimos);
  const activos = ['asesor', 'canal', 'estatus', 'mensajes', 'desde', 'hasta'].filter((k) => filtros[k]).length;
  const lista = emb.etapas;
  const nombreAsesor = Object.fromEntries(asesores.map((a) => [a.id, a.nombre]));
  const cols = lista.map((e) => ({ e, leads: leads.filter((l) => etapaDe(client, l).id === e.id) }));
  // Enlaces que conservan embudo, filtros y vista.
  const qs = (extra = {}) => { const p = new URLSearchParams(Object.entries({ e: emb.id, ...filtros, vista, ...extra }).filter(([, v]) => v)); return `${base}/embudo?${p}`; };
  const card = (l) => {
    const [oTxt, oCol] = origen(l.origen);
    const n = nombreDe(l), a = nombreAsesor[l.asignado_id], pri = PRIORIDADES[l.prioridad];
    const u = ultimos[l.id];
    return html`<a class="emb-card" draggable="true" data-id="${l.id}" data-q="${`${n} ${l.telefono || ''} ${l.email || ''} ${l.empresa || ''} ${tagsDe(l).join(' ')}`.toLowerCase()}" href="${base}/leads/${l.id}/chat">
      <span class="emb-av" style="background:${oCol}">${iniciales(n)}<i style="background:${oCol}" title="${oTxt}"></i></span>
      <span style="min-width:0"><strong>${n}${pri && pri[1] ? html`<span class="pri" title="${pri[0]}">${pri[1]}</span>` : ''}</strong><small>${a ? `👤 ${a}` : 'No asignado'}${l.empresa ? ` · ${l.empresa}` : ''}</small>
        <small>${l.control === 'humano' ? raw('<span class="emb-yo">Equipo</span>') : raw('<span class="emb-ia">IA</span>')}${u && u.rol === 'lead' ? raw(' <span class="emb-yo" style="background:rgba(248,113,113,.15);color:#f87171">Espera respuesta</span>') : ''}${l.valor ? html` <span class="emb-v">${mxn(l.valor)}</span>` : ''}</small></span>
      <time>${cuando(l.updated_at)}</time>
      ${vista === 'extendida' ? html`<span class="ext">${tagsDe(l).map((t) => html`<i>${t}</i>`)}${tagsDe(l).length ? html`<br>` : ''}${u ? html`<b>${u.rol === 'lead' ? 'Lead' : u.rol === 'humano' ? 'Equipo' : 'IA'}:</b> ${u.texto}` : l.nota ? String(l.nota).slice(0, 160) : html`<span class="muted">${l.telefono || l.email || ''}</span>`}</span>` : ''}</a>`;
  };
  const radio = (name, opciones, actual) => html`<div class="rad">${opciones.map(([v, t]) => html`<label><input type="radio" name="${name}" value="${v}" ${raw((actual || '') === v ? 'checked' : '')}><span>${t}</span></label>`)}</div>`;
  return html`<style>${raw(CSS)}${raw(TCSS)}</style>
  ${aviso ? html`<div class="okmsg">${aviso}</div>` : ''}${error ? html`<div class="err">${error}</div>` : ''}
  ${todos.length > 1 ? html`<div class="pills" style="margin-bottom:12px">${todos.map((x) => html`<a class="${x.id === emb.id ? 'on' : ''}" href="${base}/embudo?e=${encodeURIComponent(x.id)}&vista=${vista}">${x.nombre} <em>${cuenta[x.id].toLocaleString('es-MX')}</em></a>`)}</div>` : ''}
  <div class="emb-tools">
    <input type="search" id="emb-q" placeholder="Buscar nombre, teléfono, empresa…" value="${filtros.q || ''}">
    <details class="pop"><summary>⏷ Filtros${activos ? html` <span class="dot"></span> ${activos}` : ''}</summary><form class="pnl" method="get" action="${base}/embudo" style="width:340px">
      <input type="hidden" name="e" value="${emb.id}"><input type="hidden" name="vista" value="${vista}">
      <h4>Mensajes</h4>${radio('mensajes', [['', 'Todos'], ['esperando', 'Esperan respuesta'], ['respondidos', 'Respondidos']], filtros.mensajes)}
      <h4 style="margin-top:12px">Fecha</h4>
      <select name="fecha"><option value="">Fecha en que llegó</option><option value="actividad" ${raw(filtros.fecha === 'actividad' ? 'selected' : '')}>Última actividad</option></select>
      <div class="row" style="gap:8px;margin-top:6px"><input type="date" name="desde" value="${filtros.desde || ''}"><input type="date" name="hasta" value="${filtros.hasta || ''}"></div>
      <h4 style="margin-top:12px">Estatus</h4>${radio('estatus', [['', 'Todos'], ...Object.entries(PRIORIDADES).map(([k, [t, e]]) => [k, `${e} ${t}`.trim()])], filtros.estatus)}
      <h4 style="margin-top:12px">Canal</h4>${radio('canal', [['', 'Todos'], ...origenes.map((o) => [o, origen(o)[0]])], filtros.canal)}
      ${asesores.length ? html`<h4 style="margin-top:12px">Asesor</h4><select name="asesor"><option value="">Todos</option><option value="-" ${raw(filtros.asesor === '-' ? 'selected' : '')}>No asignados</option>${asesores.map((a) => html`<option value="${a.id}" ${raw(String(a.id) === filtros.asesor ? 'selected' : '')}>${a.nombre}</option>`)}</select>` : ''}
      <p class="row" style="gap:8px;margin-top:14px"><button class="btn-accent">Aplicar</button><a class="btn btn-ghost" href="${base}/embudo?e=${emb.id}&vista=${vista}">Limpiar filtros</a></p></form></details>
    <details class="pop"><summary>👁 Vista</summary><div class="pnl opc" style="min-width:220px">
      <a class="${vista === 'compacta' ? 'on' : ''}" href="${qs({ vista: 'compacta' })}">Vista compacta ${vista === 'compacta' ? '✓' : ''}</a>
      <a class="${vista === 'extendida' ? 'on' : ''}" href="${qs({ vista: 'extendida' })}">Vista extendida ${vista === 'extendida' ? '✓' : ''}</a>
      <p class="muted small" style="margin:6px 12px 2px">La extendida muestra etiquetas y el último mensaje.</p></div></details>
    <details class="pop add der" style="margin-left:auto"><summary>＋ Agregar lead</summary><form class="pnl" method="post" action="${base}/embudo/nuevo" style="width:340px">
      <label style="margin-top:0">Nombre</label><input name="nombre" maxlength="80" placeholder="Ingresar nombre">
      <label>Teléfono</label><div style="display:flex;gap:8px"><select name="lada" style="width:120px;flex:none">${LADAS.map(([v, t]) => html`<option value="${v}">${t}</option>`)}</select><input name="telefono" inputmode="tel" placeholder="55 1234 5678" style="flex:1;min-width:0"></div>
      <label>Correo (opcional)</label><input name="email" type="email" placeholder="correo@empresa.com">
      <label>¿A dónde mandamos tu nuevo lead?</label><select name="destino">${todos.map((x) => html`<optgroup label="${x.nombre}">${x.etapas.map((et) => html`<option value="${x.id}/${et.id}" ${raw(x.id === emb.id && et === x.etapas[0] ? 'selected' : '')}>${et.nombre}</option>`)}</optgroup>`)}</select>
      <p><button class="btn-accent" style="width:100%;justify-content:center">Crear lead</button></p></form></details>
    ${importar ? html`<a class="btn btn-warn" href="${base}/importar">Importar contactos</a>` : ''}
  </div>
  <div class="emb" id="emb" data-embudo="${emb.id}">
    ${cols.map(({ e, leads: ls }) => html`<section class="emb-col" data-etapa="${e.id}" style="--c:${colorTipo(e.tipo)}">
      <div class="emb-h"><b>${e.nombre}</b><em data-n>${ls.length}</em></div>
      <div class="emb-list">${ls.slice(0, 150).map(card)}${ls.length > 150 ? html`<p class="muted small" style="text-align:center">y ${ls.length - 150} más (usa el buscador o los filtros)</p>` : ''}</div>
      <div class="emb-f"><span>Valor</span><b data-v>${mxn(ls.reduce((s, l) => s + (Number(l.valor) || 0), 0))}</b></div>
    </section>`)}
  </div>
  <div class="emb-res" id="emb-res"><p>Suelta el lead aquí y suma su resultado a tus números</p><div>
    <section data-r="vendido" style="--c:#4ade80"><span>💰</span>Vendido</section><section data-r="perdido" style="--c:#f87171"><span>✖</span>Perdido</section><section data-r="resuelto" style="--c:#93b4ff"><span>✔</span>Resuelto</section></div></div>
  <details class="emb-cfg card"><summary><b>Ajustar embudos y etapas</b> <span class="muted small">(nombre = tipo, una por línea)</span></summary>
    <form method="post" action="${base}/embudo/etapas">
      <p class="muted small">Cada embudo empieza con una línea <b># Nombre del embudo</b> y debajo sus etapas. El tipo dice qué significa la etapa: <b>nuevo</b>, <b>conversacion</b>, <b>cita</b> (visita), <b>cliente</b>, <b>perdido</b> o <b>archivo</b> (base de datos). Los leads nuevos entran al primer embudo.</p>
      <textarea name="etapas" style="min-height:260px">${embudosTexto(client)}</textarea><p><button class="btn-accent">Guardar</button></p></form></details>
  ${raw(`<script>(()=>{const B=${JSON.stringify(base)};const emb=document.getElementById('emb');let arr=null;
  const contar=()=>emb.querySelectorAll('.emb-col').forEach(c=>{c.querySelector('[data-n]').textContent=[...c.querySelectorAll('.emb-card')].filter(x=>x.style.display!=='none').length;});
  const res=document.getElementById('emb-res');document.body.appendChild(res); // fuera del contenedor para que quede fija abajo
  emb.addEventListener('dragstart',e=>{const c=e.target.closest('.emb-card');if(!c)return;arr=c;c.classList.add('drag');e.dataTransfer.effectAllowed='move';res.classList.add('on');});
  emb.addEventListener('dragend',()=>{arr&&arr.classList.remove('drag');document.querySelectorAll('.over').forEach(x=>x.classList.remove('over'));setTimeout(()=>res.classList.remove('on'),150);});
  // Barra de resultados: Vendido (pide el valor), Perdido, Resuelto.
  res.querySelectorAll('section').forEach(z=>{z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('over');});z.addEventListener('dragleave',()=>z.classList.remove('over'));
    z.addEventListener('drop',async e=>{e.preventDefault();z.classList.remove('over');res.classList.remove('on');if(!arr)return;const c=arr;let valor='';
      if(z.dataset.r==='vendido'){valor=prompt('¿De cuánto fue la venta? (opcional, en pesos)','');if(valor===null)return;}
      const r=await fetch(B+'/embudo/resultado',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({lead:c.dataset.id,resultado:z.dataset.r,valor})}).catch(()=>null);
      if(!r||!r.ok){alert('No se pudo guardar. Intenta de nuevo.');return;}location.reload();});});
  emb.querySelectorAll('.emb-col').forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('over');});col.addEventListener('dragleave',()=>col.classList.remove('over'));
    col.addEventListener('drop',async e=>{e.preventDefault();col.classList.remove('over');if(!arr)return;const antes=arr.parentNode;const lista=col.querySelector('.emb-list');if(antes===lista)return;
      lista.prepend(arr);contar();const r=await fetch(B+'/embudo/mover',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({lead:arr.dataset.id,etapa:col.dataset.etapa,embudo:emb.dataset.embudo})}).catch(()=>null);
      if(!r||!r.ok){antes.prepend(arr);contar();alert('No se pudo mover. Intenta de nuevo.');}});});
  // Buscador: filtra al momento lo que se ve; con Enter busca en todo el embudo.
  const q=document.getElementById('emb-q');
  q.addEventListener('input',()=>{const t=q.value.toLowerCase().trim();emb.querySelectorAll('.emb-card').forEach(c=>{c.style.display=!t||c.dataset.q.includes(t)?'':'none';});contar();});
  q.addEventListener('keydown',e=>{if(e.key==='Enter'){const u=new URL(location.href);u.searchParams.set('q',q.value);location.href=u;}});
  document.addEventListener('click',e=>{document.querySelectorAll('details.pop[open]').forEach(d=>{if(!d.contains(e.target))d.removeAttribute('open');});});})();</script>`)}`;
}

// ------------------------------------------------------------ ficha del lead (columna del chat)
export const FICHA_CSS = `.chat-wrap .chat,.chat-wrap .resp,.chat-wrap .ctl,.chat-wrap p{max-width:none!important}.chat-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}@media(max-width:980px){.chat-wrap{grid-template-columns:1fr}}
.ficha{position:sticky;top:16px}.ficha h3{margin:0 0 4px;font-size:15px}.ficha label{font-size:12px;margin-top:10px}.ficha input,.ficha select,.ficha textarea{padding:8px 12px;font-size:14px}
.ficha .res{display:flex;gap:6px;margin-top:6px}.ficha .res label{margin:0;flex:1}.ficha .res input{display:none}.ficha .res span{display:block;text-align:center;padding:7px 4px;border-radius:12px;border:1px solid var(--line);font-size:12.5px;cursor:pointer}
.ficha .res input:checked+span{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:600}
.ficha .resu{font-size:13px;color:#d9d3c9;background:rgba(215,255,63,.06);border:1px solid rgba(215,255,63,.18);border-radius:14px;padding:10px 12px;margin-top:10px;white-space:pre-wrap}
.ficha .tagl{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}.ficha .tagl span{font-size:11px;padding:2px 9px;border-radius:99px;background:rgba(147,180,255,.14);color:#93b4ff}`;

export function fichaLead(client, lead, { base, asesores = [] }) {
  const e = etapaDe(client, lead), tags = tagsDe(lead);
  return html`<form class="card ficha" method="post" action="${base}/ficha">
    <div class="row spread"><h3>Datos del lead</h3><span class="badge" style="color:${colorTipo(e.tipo)}">${e.nombre}</span></div>
    ${lead.resumen ? html`<div class="resu"><span class="mono" style="color:#d7ff3f">Resumen IA</span><br>${lead.resumen}</div>` : ''}
    <label>Nombre</label><input name="nombre" value="${lead.nombre || ''}" maxlength="80">
    <label>Teléfono / usuario</label><input value="${[lead.telefono, lead.usuario ? '@' + lead.usuario : ''].filter(Boolean).join(' · ') || '—'}" disabled>
    <label>Correo</label><input name="email" type="email" value="${lead.email || ''}" placeholder="correo@empresa.com">
    <label>Empresa</label><input name="empresa" value="${lead.empresa || ''}" maxlength="120">
    <label>Etapa</label><select name="etapa">${(() => { const todos = embudos(client), mio = embudoDe(client, lead);
      const op = (emb) => emb.etapas.map((x) => html`<option value="${emb.id}/${x.id}" ${raw(emb.id === mio.id && x.id === e.id ? 'selected' : '')}>${x.nombre}</option>`);
      return todos.length > 1 ? todos.map((emb) => html`<optgroup label="${emb.nombre}">${op(emb)}</optgroup>`) : op(todos[0]); })()}</select>
    <label>Asesor</label><select name="asignado_id"><option value="">No asignado</option>${asesores.map((a) => html`<option value="${a.id}" ${raw(a.id === lead.asignado_id ? 'selected' : '')}>${a.nombre}</option>`)}</select>
    ${!asesores.length ? html`<span class="muted small">Da de alta a tus asesores como usuarios del panel para asignarles leads.</span>` : ''}
    <label>Estatus</label><select name="prioridad">${Object.entries(PRIORIDADES).map(([k, [t, e]]) => html`<option value="${k}" ${raw((lead.prioridad || 'neutral') === k ? 'selected' : '')}>${`${e} ${t}`.trim()}</option>`)}</select>
    <label>Valor (MXN)</label><input name="valor" inputmode="decimal" value="${lead.valor ?? ''}" placeholder="0">
    <label>Resultado</label><div class="res">${[['', 'Abierto'], ...Object.entries(RESULTADOS)].map(([k, t]) => html`<label><input type="radio" name="resultado" value="${k}" ${raw((lead.resultado || '') === k ? 'checked' : '')}><span>${t}</span></label>`)}</div>
    <label>Etiquetas (separadas por coma)</label><input name="tags" value="${tags.join(', ')}" placeholder="oficina, polanco, 6 personas">
    ${tags.length ? html`<div class="tagl">${tags.map((t) => html`<span>${t}</span>`)}</div>` : ''}
    <label>Notas</label><textarea name="nota" rows="3" maxlength="1000">${lead.nota || ''}</textarea>
    <p class="muted small" style="margin:8px 0 0">Canal: ${origen(lead.origen)[0]} · Llegó ${cuando(lead.created_at)}</p>
    <p><button class="btn-accent" style="width:100%;justify-content:center">Guardar</button></p></form>`;
}

// ------------------------------------------------------------ analítica
const ACSS = `.an-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px}
.an-k div{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:16px}.an-k b{display:block;font-size:34px;font-weight:300;letter-spacing:-.03em;line-height:1.1;margin:6px 0 2px}.an-k small{color:var(--muted);font-size:12px}
.an-g{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.an-g .card{margin:0}
.an-bars{display:flex;flex-direction:column;gap:8px;margin-top:10px}.an-bars div{display:grid;grid-template-columns:150px 1fr 48px;gap:10px;align-items:center;font-size:13px}
.an-bars i{display:block;height:10px;border-radius:99px;background:var(--c,#93b4ff);min-width:2px}.an-bars em{font-style:normal;color:var(--muted);text-align:right}
svg.an-h{width:100%;height:190px;display:block}svg.an-h text{fill:#a39d93;font-size:10px;font-family:ui-monospace,Menlo,monospace}`;

function barrasHora(horas, h) {
  const max = Math.max(1, ...horas), W = 24 * 22, H = 150;
  const banda = `<rect x="${h.de * 22}" y="0" width="${(h.a - h.de) * 22}" height="${H}" fill="rgba(147,180,255,.08)" rx="6"/><text x="${h.de * 22 + 4}" y="12">Horario del equipo</text>`;
  const bars = horas.map((n, i) => { const bh = Math.round((n / max) * (H - 24)); return `<rect x="${i * 22 + 4}" y="${H - bh}" width="14" height="${bh}" rx="3" fill="${i >= h.de && i < h.a ? '#93b4ff' : '#d7ff3f'}"><title>${i}:00 · ${n}</title></rect>`; }).join('');
  const ejes = [0, 6, 12, 18].map((i) => `<text x="${i * 22 + 2}" y="${H + 16}">${i}:00</text>`).join('') + `<text x="${23 * 22 - 14}" y="${H + 16}">23:00</text>`;
  return `<svg class="an-h" viewBox="0 0 ${W} ${H + 22}" preserveAspectRatio="none">${banda}${bars}${ejes}</svg>`;
}
const barras = (items, col) => { const max = Math.max(1e-9, ...items.map((x) => x[1])); return html`<div class="an-bars">${items.map(([t, n, c, etiqueta]) => html`<div><span>${t}</span><i style="width:${Math.max(1, Math.round((n / max) * 100))}%;--c:${c || col}"></i><em>${etiqueta ?? n}</em></div>`)}</div>`; };

export function analiticaSection(client, a, { base }) {
  const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
  const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return html`<style>${raw(ACSS)}</style>
  <div class="pills" style="margin-bottom:14px">${[7, 30, 90].map((d) => html`<a class="${a.dias === d ? 'on' : ''}" href="${base}/analitica?dias=${d}">${d} días</a>`)}</div>
  <div class="an-k">
    <div><span class="mono">Mensajes de leads</span><b>${a.mensajesLead.toLocaleString('es-MX')}</b><small>${Math.round(a.mensajesLead / a.dias)} al día</small></div>
    <div><span class="mono">Leads nuevos</span><b>${a.nuevos}</b><small>${a.clientes} ya son clientes</small></div>
    <div><span class="mono">Primera respuesta</span><b>${minTxt(a.primeraMediana)}</b><small>${pct(a.rapidos)} en 15 min o menos</small></div>
    <div><span class="mono">Fuera de horario</span><b>${a.nuevos ? Math.round((a.fuera / a.nuevos) * 100) : 0}%</b><small>${a.fuera} de ${a.nuevos}: noches y fin de semana</small></div>
    <div><span class="mono">Vendido</span><b>${mxn(a.vendido)}</b><small>leads con resultado "Vendido"</small></div>
    <div><span class="mono">Sin seguimiento</span><b>${a.sinSeguimiento}</b><small>no contestan hace más de 3 días</small></div>
  </div>
  <div class="an-g">
    <div class="card"><span class="mono">Cuándo llegan</span><h3 style="margin:6px 0 0">Leads nuevos por hora</h3>${raw(barrasHora(a.horas, a.horario))}
      <p class="muted small">En azul, el horario del equipo (${a.horario.de}:00 a ${a.horario.a}:00). En verde, lo que atiende solo el agente de IA.</p></div>
    <div class="card"><span class="mono">Qué tan rápido</span><h3 style="margin:6px 0 0">Tiempo de respuesta</h3>
      ${barras([['Agente de IA', a.respAgente ?? 0, '#d7ff3f', minTxt(a.respAgente)], ['Equipo', a.respEquipo ?? 0, '#93b4ff', minTxt(a.respEquipo)]], '#93b4ff')}
      <p class="muted small">Tiempo típico (mediana) en contestar cada mensaje. Agente: ${a.respondidosAgente} respuestas · Equipo: ${a.respondidosEquipo} respuestas. Primera respuesta a un lead nuevo: agente ${minTxt(a.primeraAgente)}, equipo ${minTxt(a.primeraEquipo)}.</p></div>
    <div class="card"><span class="mono">Qué preguntan</span><h3 style="margin:6px 0 0">Temas del primer mensaje</h3>${barras(a.temas.map(([t, n]) => [t, n]), '#c9f53a')}
      <p class="muted small">De ${a.conPrimerMsg} conversaciones nuevas; un mensaje puede tocar varios temas.</p></div>
    ${(a.porEmbudo || [{ nombre: 'Leads por etapa', etapas: a.porEtapa }]).filter((emb, i) => i === 0 || emb.etapas.some((e) => e.n)).map((emb) => html`<div class="card"><span class="mono">Embudo</span><h3 style="margin:6px 0 0">${(a.porEmbudo || []).length > 1 ? emb.nombre : 'Leads por etapa'}</h3>${barras(emb.etapas.map((e) => [e.nombre, e.n, colorTipo(e.tipo)]))}</div>`)}
    <div class="card"><span class="mono">Canales</span><h3 style="margin:6px 0 0">De dónde llegan</h3>${a.canales.length ? barras(a.canales.map(([o, n]) => [origen(o)[0], n, origen(o)[1]])) : html`<p class="muted">Sin leads nuevos en el periodo.</p>`}</div>
    <div class="card"><span class="mono">Días</span><h3 style="margin:6px 0 0">Leads nuevos por día</h3>${barras(a.semana.map((n, i) => [DIAS[i], n]).slice(1).concat([[DIAS[0], a.semana[0]]]), '#93b4ff')}</div>
    <div class="card"><span class="mono">Equipo</span><h3 style="margin:6px 0 0">Asesores</h3>
      <p class="muted small">${a.sinAsignar} de ${a.conversaciones} conversaciones del periodo no tienen asesor asignado.</p>
      ${a.asesores.length ? html`<table><tr><th class="small muted">Asesor</th><th class="small muted">Leads</th><th class="small muted">Respuestas</th></tr>${a.asesores.map((x) => html`<tr><td>${x.nombre}</td><td>${x.leads}</td><td>${x.respuestas}</td></tr>`)}</table>`
        : html`<p class="muted small">Da de alta a tus asesores como usuarios del panel para ver su desempeño.</p>`}</div>
  </div>`;
}

export { TIPOS };
