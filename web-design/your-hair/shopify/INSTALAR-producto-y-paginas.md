# your hair · página de producto y páginas

## Qué trae
| Archivo | Para qué |
|---|---|
| `sections/yh-main-product.liquid` | Página de producto en 3 columnas + barra flotante "Agregar al carrito" |
| `sections/yh-how-to.liquid` | "Así se usa" (video o foto + pasos con íconos) |
| `sections/yh-related.liquid` | "Te puede interesar" (recomendaciones automáticas de Shopify) |
| `sections/yh-page-hero.liquid` | Encabezado para páginas (Nosotros) |
| `sections/yh-contact.liquid` | Contacto con formulario |
| `sections/yh-faq.liquid` | Preguntas frecuentes |
| `sections/yh-page-content.liquid` | Páginas de texto (aviso de privacidad, términos, envíos) |
| `snippets/yh-section-style.liquid`, `snippets/yh-icon.liquid`, `assets/yh.css` | Estilos, íconos y controles de color/tipografía |
| `templates/product.json` | La página de producto ya armada |
| `templates/page.nosotros.json`, `page.contacto.json`, `page.faq.json`, `page.legal.json` | Plantillas de páginas |
| `paginas/*.html` | Borradores de aviso de privacidad, términos y envíos/devoluciones |

## Opción A · Shopify CLI (la más rápida)
Desde la carpeta descomprimida:
```bash
shopify theme push --store TU-TIENDA.myshopify.com --theme ID-DEL-TEMA --nodelete
```
`--nodelete` solo agrega o reemplaza estos archivos; no borra nada más.

## Opción B · Editor de código (sin instalar nada)
Temas → … → Editar código. Para cada archivo:
- Si **ya existe** (`assets/yh.css`, `snippets/yh-icon.liquid`, `templates/product.json`): ábrelo, borra todo y pega el nuevo.
- Si **no existe**: en su carpeta da clic en "Agregar nuevo archivo", escribe el nombre exacto (por ejemplo `yh-main-product.liquid` en sections, o `page.nosotros.json` en templates) y pega el contenido.

## Crear las páginas
Tienda online → Páginas → Agregar página, y en "Plantilla" (columna derecha) elige:
| Página | Plantilla | Contenido |
|---|---|---|
| Nosotros | `page.nosotros` | vacío |
| Contacto | `page.contacto` | vacío |
| Preguntas frecuentes | `page.faq` | vacío |
| Aviso de privacidad | `page.legal` | pega `paginas/aviso-de-privacidad.html` (botón `<>` del editor) |
| Términos y condiciones | `page.legal` | pega `paginas/terminos-y-condiciones.html` |
| Envíos y devoluciones | `page.legal` | pega `paginas/envios-y-devoluciones.html` (que la URL quede `/pages/envios-y-devoluciones`) |

Los textos legales son un borrador: completa lo que está entre [CORCHETES] y que los revise un abogado o contador.

## Metafields del producto (opcional, recomendado)
Configuración → Datos personalizados → Productos → Agregar definición:
| Nombre | Clave | Tipo | Para qué |
|---|---|---|---|
| Color de fondo | `custom.bg_color` | Color | Fondo de la foto en la página de producto y en "Te puede interesar" |
| Descripción corta | `custom.short_description` | Texto de varias líneas | Texto bajo el nombre |
| Tipo de cabello | `custom.hair_type` | Texto de una línea | Fila "Para" |
| Ingredientes clave | `custom.key_ingredients` | Texto de una línea | Fila "Ingredientes" |
| Contenido | `custom.net_content` | Texto de una línea | Fila "Contenido" |
| Rendimiento | `custom.duration` | Texto de una línea | Fila "Rinde" |
| Modo de uso | `custom.how_to_use` | Texto enriquecido | Desplegable "Modo de uso" |
| Ingredientes INCI | `custom.ingredients` | Texto enriquecido | Desplegable "Ingredientes" |

Si un producto no tiene el metafield, se usa el texto que pongas en el personalizador.
