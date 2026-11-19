# Chill Pill Design — sitio estático

Réplica de https://www.chillpilldesign.com/ fuera de Wix: HTML + CSS + JS plano, sin dependencias ni build.

```
index.html            Inicio (hero con video, Nosotros, Servicios, cita, Contacto)
portafolio/index.html Galería de 18 proyectos con lightbox
nece/index.html       ¿Necesito diseño?
assets/               css, js, imágenes, portafolio, video, iconos sociales
```

Las URLs se conservan (`/`, `/portafolio`, `/nece`), así no se pierde SEO al cambiar el dominio.

## Ver en local

    cd chillpill-site && python3 -m http.server 8000

## Publicar
Sube la carpeta tal cual a cualquier hosting estático (Netlify, Vercel, Cloudflare Pages, GitHub Pages, cPanel…)
y apunta el dominio `chillpilldesign.com` ahí (después de cancelar/desconectar el dominio en Wix).

## Formulario de contacto
Usa FormSubmit (`https://formsubmit.co/ajax/info@chillpilldesign.com`), gratis y sin cuenta.
**El primer envío manda un correo de activación a info@chillpilldesign.com que hay que confirmar.**
Para usar otro servicio (Formspree, Netlify Forms…) cambia `data-endpoint` del `<form>` en `index.html`.

## Diferencias con Wix
- El chat de Wix se reemplazó por un botón "¡Vamos a chatear!" que abre WhatsApp (55 4145 8618).
- Los correos del sitio original apuntaban por error a `info@mysite.com`; aquí apuntan a `info@chillpilldesign.com`.
- Se agregó versión móvil (menú hamburguesa) y el año del copyright se actualiza solo.
