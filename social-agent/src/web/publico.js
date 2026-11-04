// Páginas públicas (sin sesión): inicio, aviso de privacidad y términos.
// TikTok (y Meta) piden que la app tenga una página pública que explique el servicio a sus usuarios,
// con aviso de privacidad y términos, y que se vea que la usan negocios externos, no solo la agencia.
import { html, raw, page } from './html.js';
import { config } from '../config.js';

const contacto = () => config.contactoEmail || 'contacto@kuper.mx';
const ACTUALIZADO = '4 de noviembre de 2026';

const CSS = raw(`<style>
.pub{max-width:980px;margin:0 auto}.pub nav{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0 30px;flex-wrap:wrap}
.pub nav .marca{display:flex;align-items:center;gap:10px;font-weight:600;text-decoration:none}.pub nav .marca b{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:var(--accent);color:var(--accent-ink)}
.pub nav .links{display:flex;gap:16px;flex-wrap:wrap}.pub nav .links a{color:var(--muted);text-decoration:none}.pub nav .links a:hover{color:var(--ink)}
.pub .hero{padding:30px 0 10px}.pub .hero h1{font-size:clamp(34px,6vw,58px)}.pub .hero p{font-size:18px;color:var(--muted);max-width:640px}
.pub .grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:10px}
.pub .paso{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px}.pub .paso b{display:block;font-size:17px;margin-bottom:6px}
.pub .paso p{margin:0;color:var(--muted)}.pub .legal{max-width:760px}.pub .legal h3{margin:26px 0 6px;font-size:18px;font-weight:600}
.pub .legal p,.pub .legal li{color:#d9d3c9}.pub footer{margin-top:60px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;display:flex;gap:16px;flex-wrap:wrap}
.pub .cta{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:999px;background:var(--accent);color:var(--accent-ink);font-weight:600;text-decoration:none}
.pub .en{margin-top:40px;padding:22px;border-radius:20px;background:var(--card);border:1px solid var(--line)}
</style>`);

const nav = () => html`<nav><a class="marca" href="/"><b>K</b>Kuper Publicador</a>
  <div class="links"><a href="/#como-funciona">Cómo funciona</a><a href="/privacidad">Privacidad</a><a href="/terminos">Términos</a><a href="/entrar">Entrar</a></div></nav>`;
const pie = () => html`<footer><span>© 2026 Kuper Media · Mérida, Yucatán, México</span><a href="/privacidad">Aviso de privacidad / Privacy</a><a href="/terminos">Términos / Terms</a><a href="mailto:${contacto()}">${contacto()}</a></footer>`;
const pub = (title, body) => page({ title, body: html`${CSS}<div class="pub">${nav()}${body}${pie()}</div>` });

export function inicioPage() {
  return pub('Kuper Publicador · Redes sociales para negocios', html`
  <section class="hero"><span class="mono">Kuper Publicador</span>
    <h1>Las redes de tu negocio,<br>listas para publicar.</h1>
    <p>Kuper Publicador es la plataforma de Kuper Media para negocios de México. Preparamos los videos, carruseles y textos de cada marca, el dueño del negocio los revisa y los aprueba, y la plataforma los publica en Instagram, Facebook, LinkedIn y TikTok en la cuenta que el propio negocio conectó.</p>
    <a class="cta" href="/entrar">Entrar a mi cuenta</a></section>
  <h2 id="como-funciona">Cómo funciona</h2>
  <div class="grid3">
    <div class="paso"><b>1. El negocio crea su cuenta</b><p>Cada cliente de Kuper (restaurantes, agencias, consultorios, tiendas) recibe su propio acceso a la plataforma.</p></div>
    <div class="paso"><b>2. Conecta sus redes</b><p>Desde "Mi cuenta", el negocio inicia sesión en TikTok y autoriza a Kuper Publicador a publicar en su perfil. Puede desconectarlo cuando quiera.</p></div>
    <div class="paso"><b>3. Revisa y aprueba cada post</b><p>Ve la vista previa del video, edita el texto, elige quién puede verlo y si permite comentarios, dúos o stitch. Nada se publica sin su aprobación.</p></div>
  </div>
  <h2>Qué hacemos con TikTok</h2>
  <div class="grid3">
    <div class="paso"><b>Solo publicamos lo que aprobaste</b><p>Usamos el permiso <code>video.publish</code> únicamente para subir a tu perfil los videos que tú aprobaste, con la privacidad que tú elegiste.</p></div>
    <div class="paso"><b>Mostramos tu cuenta</b><p>Con <code>user.info.basic</code> mostramos tu nombre y foto de TikTok para que sepas en qué cuenta se publicará.</p></div>
    <div class="paso"><b>Tú tienes el control</b><p>Puedes desconectar TikTok desde la plataforma o desde los ajustes de TikTok. Al hacerlo borramos tus tokens.</p></div>
  </div>
  <div class="en"><span class="mono">In English</span>
    <p><b>Kuper Publicador</b> is a social media publishing platform by Kuper Media for small and medium businesses in Mexico. Each business gets its own account, connects its own TikTok profile through Login Kit, reviews a preview of every video, chooses the privacy level and interaction settings, and approves it. Only then does Kuper Publicador upload the video to that business's TikTok profile with the Content Posting API. We never post without the account owner's approval. See our <a href="/privacidad#en">Privacy Policy</a> and <a href="/terminos#en">Terms of Service</a>. Contact: <a href="mailto:${contacto()}">${contacto()}</a>.</p></div>`);
}

export function privacidadPage() {
  return pub('Aviso de privacidad · Kuper Publicador', html`<div class="legal">
  <span class="mono">Actualizado el ${ACTUALIZADO}</span><h1>Aviso de privacidad</h1>
  <p>Kuper Media ("Kuper", "nosotros"), con domicilio en Mérida, Yucatán, México, es responsable de los datos personales que se tratan en Kuper Publicador (${config.publicBaseUrl}).</p>
  <h3>Qué datos recibimos</h3>
  <ul><li>Datos de tu cuenta en la plataforma: nombre, correo y contraseña (guardada cifrada).</li>
    <li>De las redes que tú conectas: identificadores de la cuenta y tokens de acceso. En TikTok: tu open_id, nombre visible, usuario y foto (permiso <code>user.info.basic</code>), y el permiso para publicar videos (<code>video.publish</code>).</li>
    <li>El contenido que apruebas: videos, imágenes, textos y la configuración de cada publicación.</li></ul>
  <h3>Para qué los usamos</h3>
  <ul><li>Mostrarte en qué cuenta se publicará cada post.</li><li>Publicar en tu perfil solo el contenido que aprobaste, con la privacidad y opciones que elegiste.</li><li>Mostrarte el estado de tus publicaciones y tus reportes.</li></ul>
  <p>No vendemos tus datos, no los usamos para publicidad y no publicamos nada sin tu aprobación.</p>
  <h3>Con quién los compartimos</h3>
  <p>Solo con la red social que tú conectaste (TikTok, Meta o LinkedIn), cuando publicamos lo que aprobaste, y con proveedores de infraestructura que guardan la información por nosotros. Los tokens se guardan cifrados.</p>
  <h3>Cuánto tiempo los guardamos y cómo borrarlos</h3>
  <p>Guardamos los tokens mientras la conexión esté activa. Si das "Desconectar TikTok" en Mi cuenta, revocamos el acceso en TikTok y borramos los tokens de inmediato. También puedes quitar el acceso desde la app de TikTok (Ajustes › Seguridad › Apps y servicios). Para borrar tu cuenta y todos tus datos escribe a <a href="mailto:${contacto()}">${contacto()}</a>; lo hacemos en un máximo de 30 días.</p>
  <h3>Tus derechos (ARCO)</h3>
  <p>Puedes pedir acceso, rectificación, cancelación u oposición al uso de tus datos escribiendo a <a href="mailto:${contacto()}">${contacto()}</a>.</p>

  <div class="en" id="en"><span class="mono">Privacy Policy · English</span>
    <p><b>Who we are.</b> Kuper Media (Mérida, Yucatán, Mexico) operates Kuper Publicador at ${config.publicBaseUrl}.</p>
    <p><b>Data we collect.</b> Your platform account (name, email, hashed password); for each social account you connect, its identifiers and access tokens. From TikTok we receive your open_id, display name, username and avatar (<code>user.info.basic</code>) and permission to publish videos (<code>video.publish</code>). We also store the content you approve for publishing.</p>
    <p><b>How we use it.</b> To show which account a post will go to, to publish only the content you approved with the privacy and interaction settings you selected, and to show you the status of your posts. We do not sell your data, use it for advertising, or post without your approval.</p>
    <p><b>Sharing.</b> Only with the platform you connected (TikTok, Meta, LinkedIn) when publishing approved content, and with our hosting providers. Tokens are stored encrypted.</p>
    <p><b>Retention and deletion.</b> Tokens are kept while the connection is active. "Disconnect TikTok" revokes access with TikTok and deletes the tokens immediately; you can also remove access in the TikTok app. To delete your account and all data, email <a href="mailto:${contacto()}">${contacto()}</a>; we complete deletion within 30 days.</p></div>
  </div>`);
}

export function terminosPage() {
  return pub('Términos del servicio · Kuper Publicador', html`<div class="legal">
  <span class="mono">Actualizado el ${ACTUALIZADO}</span><h1>Términos del servicio</h1>
  <h3>El servicio</h3><p>Kuper Publicador permite a los negocios clientes de Kuper Media preparar, revisar, aprobar y publicar contenido en sus propias cuentas de redes sociales. Cada negocio conecta sus cuentas con el inicio de sesión oficial de cada red.</p>
  <h3>Tu cuenta y tus redes</h3><p>Debes ser dueño de las cuentas que conectas o tener autorización para administrarlas. Eres responsable del contenido que apruebas y de cumplir las reglas de cada red, incluidas las <a href="https://www.tiktok.com/community-guidelines" target="_blank" rel="noopener">Normas de la comunidad de TikTok</a>, su <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Confirmación de uso de música</a> y, si aplica, su <a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Política de contenido de marca</a>.</p>
  <h3>Aprobación</h3><p>Nada se publica sin tu aprobación. Antes de publicar en TikTok ves la vista previa, la cuenta destino, eliges la privacidad y si permites comentarios, dúos y stitch, y si es contenido de marca.</p>
  <h3>Desconexión y baja</h3><p>Puedes desconectar tus redes en cualquier momento desde Mi cuenta. Para dar de baja tu cuenta escribe a <a href="mailto:${contacto()}">${contacto()}</a>.</p>
  <h3>Responsabilidad</h3><p>El servicio depende de las APIs de cada red social; si una red cambia o falla, la publicación puede retrasarse. Te avisamos de cualquier error en la plataforma.</p>
  <p>Ver también el <a href="/privacidad">Aviso de privacidad</a>.</p>
  <div class="en" id="en"><span class="mono">Terms of Service · English</span>
    <p>Kuper Publicador lets businesses that are clients of Kuper Media prepare, review, approve and publish content on their own social media accounts, connected through each platform's official login. You must own or be authorized to manage the accounts you connect, and you are responsible for the content you approve and for complying with each platform's rules, including TikTok's Community Guidelines, Music Usage Confirmation and Branded Content Policy. Nothing is published without your approval: before posting to TikTok you see a preview and the destination account, and you choose the privacy level, interaction settings and commercial content disclosure. You can disconnect your accounts at any time. Contact: <a href="mailto:${contacto()}">${contacto()}</a>.</p></div>
  </div>`);
}
