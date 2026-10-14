# your hair · secciones para Minimog (Shopify)

Secciones propias (prefijo `yh-`) que se agregan encima del tema Minimog 5.7.0. No modifican ningún archivo original de Minimog: header, footer, carrito, producto y colecciones siguen siendo los del tema.

## Qué incluye
- `sections/` — 10 secciones editables desde el personalizador:
  `YH · Hero con productos`, `YH · Datos`, `YH · Encuentra tu barra`, `YH · Productos` (tratamientos y accesorios), `YH · Nosotros`, `YH · Barra vs. botella`, `YH · Arma tu rutina`, `YH · Reseñas`, `YH · Newsletter`, `YH · Botón de WhatsApp`.
- `snippets/` — `yh-head` (fuentes y CSS), `yh-img`, `yh-icon`.
- `assets/` — `yh.css`, fuentes y las fotos recortadas de los productos (`yh-*.png`).
- `templates/index.json` — la página de inicio ya armada con todas las secciones y textos.

## Instalar (tema nuevo, recomendado)
1. Shopify → Tienda online → Temas → Agregar tema → Subir archivo zip → `minimog-your-hair.zip`.
2. Personalizar → revisar cada sección y conectar los productos reales.
3. Publicar cuando esté listo.

## Instalar sobre un Minimog que ya está en uso
Con Shopify CLI, desde esta carpeta:
```bash
shopify theme push --theme <ID-del-tema> --only "sections/yh-*" --only "snippets/yh-*" --only "assets/yh*"
```
Luego agrega las secciones `YH · …` a la página de inicio desde el personalizador. No subas `templates/index.json` si no quieres reemplazar el inicio actual.

## Conectar productos
- `YH · Productos`: en cada bloque elige el producto de Shopify; toma nombre, precio y botón de agregar al carrito. La imagen recortada se puede subir en "Imagen PNG sin fondo"; si no, usa la foto del producto.
- `YH · Encuentra tu barra`: en cada tipo de cabello elige el producto (shampoo) al que debe llevar.
- `YH · Botón de WhatsApp`: escribe el número con lada (ej. 5219991234567).

## Textos por confirmar con el cliente
Historia, frase de la fundadora, reseñas, "4.9 de 5", precios de ejemplo y el 15% de descuento son de ejemplo.
