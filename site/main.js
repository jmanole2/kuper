/* Kuper Media — landing interactions (no dependencies) */
(() => {
  'use strict';

  // Where the contact form posts (JSON). Leave empty until you have an endpoint
  // (Formspree, your own API, etc.): the form then only validates and says so.
  const CONTACT_ENDPOINT = '';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- split text into chars (words stay unbroken) ---------- */
  function splitChars(el) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span');
            w.style.whiteSpace = 'nowrap';
            [...part].forEach(c => {
              const s = document.createElement('span');
              s.className = 'ch'; s.textContent = c; w.append(s);
            });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    el.setAttribute('aria-label', el.textContent.trim());
    walk(el);
    return $$('.ch', el);
  }
  function setChars(chars, t, tip = true) {
    const n = Math.round(clamp(t) * chars.length);
    if (chars._n === n) return;
    chars._n = n;
    chars.forEach((c, i) => {
      c.classList.toggle('on', i < n);
      c.classList.toggle('tip', tip && i === n - 1 && n < chars.length);
    });
  }

  /* ---------- header ---------- */
  const header = $('#siteHeader');
  $$('.nav-item.has-menu').forEach(item => {
    const btn = $('button', item);
    const set = open => { item.classList.toggle('open', open); btn.setAttribute('aria-expanded', open); };
    item.addEventListener('mouseenter', () => set(true));
    item.addEventListener('mouseleave', () => set(false));
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('open');
      $$('.nav-item.open').forEach(o => o.classList.remove('open'));
      set(open);
    });
    item.addEventListener('focusout', e => { if (!item.contains(e.relatedTarget)) set(false); });
  });
  const burger = $('.nav-burger');
  burger.addEventListener('click', () => {
    const open = header.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', open);
  });
  $$('.mobile-menu a, .nav-menu a').forEach(a => a.addEventListener('click', () => {
    header.classList.remove('menu-open');
    $$('.nav-item.open').forEach(o => o.classList.remove('open'));
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { header.classList.remove('menu-open'); $$('.nav-item.open').forEach(o => o.classList.remove('open')); }
  });

  /* ---------- hero: scroll-driven canvas ---------- */
  const hero = $('#hero');
  const cv = $('#heroCanvas');
  const ctx = cv.getContext('2d');
  const lines = $$('.hero-line').map(el => ({ el, chars: splitChars(el) }));
  // [start, end] of each line inside hero progress
  const windows = [[0.05, 0.3], [0.5, 0.74], [0.77, 1.01]];
  let W = 0, H = 0, DPR = 1, heroP = 0, heroVisible = true;

  // deterministic pseudo-random so the scene is stable between frames
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const buildings = Array.from({ length: 16 }, (_, i) => ({
    x: i / 16 + (rnd() - 0.5) * 0.02, w: 0.045 + rnd() * 0.05, h: 0.08 + rnd() * 0.2,
    win: Array.from({ length: 5 }, () => ({ u: rnd(), v: rnd(), lit: rnd() > 0.55 })), sign: rnd() > 0.5
  }));
  const dots = Array.from({ length: 170 }, () => ({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.7, ph: rnd() * 6.28 }));
  const streaks = Array.from({ length: 9 }, () => ({ x: rnd(), y: rnd(), a: rnd() * 6.28, l: 0.05 + rnd() * 0.1, sp: 0.2 + rnd() * 0.5 }));
  const bubbles = Array.from({ length: 7 }, (_, i) => ({ x: 0.12 + (i / 6) * 0.76 + (rnd() - 0.5) * 0.05, y: 0.2 + rnd() * 0.55, w: 0.07 + rnd() * 0.06, out: i % 2 === 1 }));

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function bubblePath(x, y, w, h, out) {
    const r = Math.min(h * 0.32, 14);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    const tx = out ? x + w - r * 1.2 : x + r * 1.2;
    ctx.moveTo(tx - 7, y + h); ctx.lineTo(tx + (out ? 9 : -9), y + h + 11); ctx.lineTo(tx + 7, y + h);
  }

  function drawHero(time) {
    const p = heroP, t = time / 1000;
    const horizon = H * 0.575;
    const dusk = smooth(clamp((p - 0.26) / 0.2));       // sunset -> night
    const gridA = smooth(clamp((p - 0.34) / 0.16));     // grid appears
    const wire = smooth(clamp((p - 0.22) / 0.16)) * (1 - smooth(clamp((p - 0.5) / 0.12))); // wireframe twin
    const pan = p * W * 0.35;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    const mix = (a, b) => `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], dusk))).join(',')})`;
    sky.addColorStop(0, mix([208, 203, 214], [0, 0, 0]));
    sky.addColorStop(0.45, mix([226, 196, 170], [0, 0, 0]));
    sky.addColorStop(1, mix([232, 172, 88], [2, 3, 3]));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // sun glow
    if (dusk < 1) {
      const sx = W * 0.82 - pan * 0.15, sy = horizon - H * 0.02;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.55);
      g.addColorStop(0, `rgba(255,214,140,${0.75 * (1 - dusk)})`);
      g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // ground
    const gr = ctx.createLinearGradient(0, horizon, 0, H);
    gr.addColorStop(0, mix([22, 12, 8], [0, 0, 0]));
    gr.addColorStop(1, mix([6, 4, 4], [0, 0, 0]));
    ctx.fillStyle = gr; ctx.fillRect(0, horizon, W, H - horizon);

    // skyline of storefronts (silhouette -> wireframe)
    const span = W * 1.5;
    buildings.forEach(b => {
      const bw = b.w * span, bh = b.h * H, bx = b.x * span - pan - W * 0.05, by = horizon - bh;
      if (bx > W || bx + bw < 0) return;
      ctx.fillStyle = `rgba(14,9,7,${1 - dusk * 0.92})`;
      ctx.fillRect(bx, by, bw, bh + 1);
      if (b.sign) { ctx.fillRect(bx + bw * 0.2, by - 7, bw * 0.6, 7); }
      // lit windows
      b.win.forEach(w => {
        if (!w.lit) return;
        const wx = bx + bw * (0.12 + w.u * 0.7), wy = by + bh * (0.15 + w.v * 0.6);
        ctx.fillStyle = `rgba(255,220,150,${(0.55 + 0.25 * Math.sin(t * 1.3 + w.u * 9)) * (1 - dusk)})`;
        ctx.fillRect(wx, wy, Math.max(4, bw * 0.1), Math.max(5, bh * 0.09));
      });
      if (wire > 0.01) {
        ctx.strokeStyle = `rgba(190,205,255,${0.55 * wire})`; ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw, bh);
        ctx.beginPath();
        for (let k = 1; k < 4; k++) { ctx.moveTo(bx, by + (bh * k) / 4); ctx.lineTo(bx + bw, by + (bh * k) / 4); }
        ctx.moveTo(bx + bw / 2, by); ctx.lineTo(bx + bw / 2, by + bh);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${0.9 * wire})`;
        [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0]].forEach(([u, v]) => ctx.fillRect(bx + bw * u - 1.5, by + bh * v - 1.5, 3, 3));
      }
    });

    // ground reflection of the sun
    if (dusk < 1) {
      const g2 = ctx.createLinearGradient(W, horizon, W * 0.72, H * 0.72);
      g2.addColorStop(0, `rgba(255,190,120,${0.45 * (1 - dusk)})`); g2.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.moveTo(W, horizon); ctx.lineTo(W, horizon + H * 0.13); ctx.lineTo(W * 0.74, horizon); ctx.fill();
    }

    // night: dashed grid, streaks, particles, wireframe chat bubbles
    if (gridA > 0.01) {
      const cell = Math.max(64, Math.round(W / 16.4)), gap = 14, drift = (t * 6) % cell;
      ctx.strokeStyle = `rgba(255,255,255,${0.13 * gridA})`; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = -cell + (W / 2 % cell); x < W + cell; x += cell) {
        for (let y = -cell + drift; y < H + cell; y += cell) {
          ctx.moveTo(x + gap, y); ctx.lineTo(x + cell - gap, y);
          ctx.moveTo(x, y + gap); ctx.lineTo(x, y + cell - gap);
        }
      }
      ctx.stroke();

      const bubA = gridA * (1 - smooth(clamp((p - 0.47) / 0.1)));
      if (bubA > 0.01) {
        bubbles.forEach((b, i) => {
          const bw = b.w * W, bh = bw * 0.36, bx = b.x * W - bw / 2, by = b.y * H + Math.sin(t * 0.8 + i) * 6;
          bubblePath(bx, by, bw, bh, b.out);
          ctx.strokeStyle = b.out ? `rgba(166,255,0,${0.8 * bubA})` : `rgba(200,212,255,${0.6 * bubA})`;
          ctx.lineWidth = 1.2; ctx.stroke();
          ctx.fillStyle = `rgba(255,255,255,${0.5 * bubA})`;
          ctx.fillRect(bx + bw * 0.14, by + bh * 0.36, bw * 0.5, 2);
          ctx.fillRect(bx + bw * 0.14, by + bh * 0.6, bw * 0.3, 2);
        });
      }

      streaks.forEach(s => {
        const cx = ((s.x + t * 0.012 * s.sp) % 1) * W, cy = s.y * H;
        const dx = Math.cos(s.a) * s.l * W, dy = Math.sin(s.a) * s.l * W;
        const g = ctx.createLinearGradient(cx, cy, cx + dx, cy + dy);
        g.addColorStop(0, `rgba(255,255,255,${0.42 * gridA})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke();
      });
      dots.forEach(d => {
        const x = ((d.x + t * 0.004 * d.z) % 1) * W, y = ((d.y - p * 0.6 * d.z + 2) % 1) * H;
        ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.55 * Math.abs(Math.sin(t * 0.9 + d.ph))) * gridA * d.z})`;
        ctx.fillRect(x, y, 1.6 * d.z, 1.6 * d.z);
      });
      // soft vignette
      const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.95);
      v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.75 * gridA})`);
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    }
  }

  function updateHeroText() {
    lines.forEach((ln, i) => {
      const [a, b] = windows[i], last = i === lines.length - 1;
      const u = (heroP - a) / (b - a);
      const reveal = clamp(u / 0.62);
      const fadeOut = last ? 0 : clamp((u - 0.86) / 0.14);
      ln.el.style.opacity = u <= 0 || u >= 1 ? 0 : 1 - fadeOut;
      ln.el.style.transform = `translateY(${(-fadeOut * 30).toFixed(1)}px)`;
      setChars(ln.chars, reduced ? (u > 0 ? 1 : 0) : reveal);
    });
    $('.hero-scroll').style.opacity = heroP > 0.03 ? 0 : 1;
  }

  /* ---------- scrubbed step text + counter ---------- */
  const scrubs = $$('.scrub').map(el => ({ el, chars: splitChars(el) }));
  const steps = $$('.step');
  const reelB = $('#reelB');
  function updateSteps() {
    const vh = innerHeight;
    scrubs.forEach(s => {
      const r = s.el.getBoundingClientRect();
      setChars(s.chars, reduced ? 1 : (vh * 0.78 - r.top) / (r.height + vh * 0.22), false);
    });
    let best = 0, bd = Infinity;
    steps.forEach((st, i) => {
      const r = st.getBoundingClientRect();
      const d = Math.abs(r.top + r.height * 0.4 - vh / 2);
      if (d < bd) { bd = d; best = i; }
    });
    reelB.style.transform = `translateY(${-best * (100 / steps.length)}%)`;
  }

  /* ---------- scroll loop ---------- */
  let ticking = false;
  function onScroll() {
    const r = hero.getBoundingClientRect();
    heroP = clamp(-r.top / (r.height - innerHeight));
    heroVisible = r.bottom > 0;
    header.classList.toggle('on-dark', r.bottom > 80 && heroP > 0.3);
    updateHeroText();
    updateSteps();
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', () => { resize(); onScroll(); layoutTrack(); });
  function frame(t) { if (heroVisible) drawHero(reduced ? 0 : t); requestAnimationFrame(frame); }

  /* ---------- in-view reveals ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
  }), { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  $$('.fade-up').forEach(el => io.observe(el));

  $$('.sweep').forEach(el => {
    const chars = splitChars(el);
    const o = new IntersectionObserver(es => {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      if (reduced) return setChars(chars, 1);
      const t0 = performance.now(), dur = 1500;
      const run = now => { const k = clamp((now - t0) / dur); setChars(chars, k); if (k < 1) requestAnimationFrame(run); };
      requestAnimationFrame(run);
    }, { threshold: 0.6 });
    o.observe(el);
  });

  /* ---------- calculator ---------- */
  const f = id => document.getElementById(id);
  const fmt = n => Math.round(n).toLocaleString('es-MX');
  const shown = {};
  function tween(id, to) {
    const el = f(id), from = shown[id] ?? 0; shown[id] = to;
    if (reduced) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const run = now => {
      const k = clamp((now - t0) / 500), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(lerp(from, to, e));
      if (k < 1 && shown[id] === to) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }
  function calc() {
    const num = id => Math.max(0, parseFloat(f(id).value) || 0);
    const msgs = num('cMsgs'), min = num('cMin'), days = clamp(num('cDays'), 0, 7), people = Math.max(1, num('cPeople')), wage = num('cWage');
    const slider = +f('cShare').value;
    f('cShare').style.setProperty('--p', ((slider - 1) / 9) * 100 + '%');
    const share = Math.min(0.9, slider / 10);            // repeated questions the agent can take
    const hours = (msgs * min / 60) * days * 4.33;        // hours per month on messages
    const cost = Math.min(hours * (wage / 173), people * wage); // never above the payroll itself
    const save = Math.max(0, cost * share - 499);         // net of monthly maintenance
    tween('rHours', hours); tween('rCost', cost); tween('rSave', save);
    tween('rTotal', save * 12); tween('rPct', share * 100);
  }
  $('#calcForm').addEventListener('input', calc);

  /* ---------- platform carousel ---------- */
  const track = $('#platTrack'), slides = $$('.slide', track), tabs = $$('#platTabs .tab');
  const prev = $('#platPrev'), next = $('#platNext');
  let cur = 0;
  function layoutTrack() {
    const wrap = track.parentElement;
    const avail = wrap.clientWidth - parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
    const max = Math.max(0, track.scrollWidth - avail);
    track.style.transform = `translateX(${-Math.min(slides[cur].offsetLeft, max)}px)`;
  }
  function go(i) {
    cur = clamp(i, 0, slides.length - 1);
    slides.forEach((s, k) => s.classList.toggle('is-on', k === cur));
    tabs.forEach((t, k) => { t.classList.toggle('is-on', k === cur); t.setAttribute('aria-selected', k === cur); });
    prev.disabled = cur === 0; next.disabled = cur === slides.length - 1;
    layoutTrack();
  }
  tabs.forEach((t, i) => t.addEventListener('click', () => go(i)));
  slides.forEach((s, i) => s.addEventListener('click', () => { if (i !== cur) go(i); }));
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  let sx = null;
  track.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  });

  /* ---------- FAQ ---------- */
  const faqTabs = $$('#faqTabs .tab'), groups = $$('.faq-group');
  faqTabs.forEach(t => t.addEventListener('click', () => {
    faqTabs.forEach(o => o.classList.toggle('is-on', o === t));
    groups.forEach(g => g.classList.toggle('is-on', g.dataset.g === t.dataset.g));
  }));
  groups.forEach(g => $$('details', g).forEach(d => d.addEventListener('toggle', () => {
    if (d.open) $$('details', g).forEach(o => { if (o !== d) o.open = false; });
  })));

  /* ---------- contact form ---------- */
  const form = $('#contactForm'), msg = $('#formMsg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    msg.className = 'form-msg';
    if (!form.checkValidity()) {
      msg.classList.add('err'); msg.textContent = 'Revisa los campos marcados con *.';
      form.querySelector(':invalid')?.focus(); return;
    }
    if (!CONTACT_ENDPOINT) {
      msg.textContent = 'Formulario de demostración: todavía no está conectado, así que no se envió nada.';
      return;
    }
    try {
      msg.textContent = 'Enviando…';
      const res = await fetch(CONTACT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      if (!res.ok) throw new Error(res.status);
      form.reset(); msg.textContent = '¡Listo! Te respondemos el mismo día.';
    } catch (err) {
      msg.classList.add('err'); msg.textContent = 'No se pudo enviar. Inténtalo de nuevo en un momento.';
    }
  });

  /* ---------- boot ---------- */
  f('year').textContent = new Date().getFullYear();
  resize(); onScroll(); calc(); go(0);
  requestAnimationFrame(frame);
})();
