# Importar el catálogo de YOUR HAIR

`your-hair-productos.csv` trae 17 productos: 7 shampoos, 4 acondicionadores, tónico, aceite capilar, aceite de ducha y los 3 rituales. Todos entran como **borrador**, así que no se publica nada solo.

1. **Primero crea los metafields** (Configuración → Datos personalizados → Productos), con estos nombres y claves exactos:
   - `custom.hair_type` — Texto de una línea
   - `custom.key_ingredients` — Texto de una línea
   - `custom.bg_color` — Color
   - `custom.net_content` — Texto de una línea
   - `custom.short_description` — Texto de varias líneas
   - `custom.how_to_use` — Texto de varias líneas
2. **Escribe los precios** en la columna `Variant Price` (están vacíos).
3. Productos → Importar → sube el CSV. Si ya tienes un producto con el mismo handle, marca "Sobrescribir productos existentes".
4. Sube las fotos a cada producto y cámbialos a **Activo** cuando estén listos.
5. Crea las colecciones `shampoo`, `acondicionador`, `tratamientos` y `rituales` (colecciones automáticas por Tipo de producto: Shampoo sólido, Acondicionador sólido, Tónico/Aceite, Ritual).

Los textos son cosméticos: evitan prometer crecimiento, caída o anticaspa. Si el cliente quiere decirlo, necesita pruebas que lo respalden.
