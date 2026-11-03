# Importar el catálogo de YOUR HAIR

`your-hair-productos.csv` trae 17 productos: 7 shampoos, 4 acondicionadores, tónico, aceite capilar, aceite de ducha y los 3 rituales. Todos entran como **borrador**: después de revisarlos, selecciónalos y usa "Establecer como activo" y "Agregar a canales de venta → Tienda online".

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
5. Crea las colecciones `shampoo`, `acondicionador`, `tratamientos`, `rituales` y `accesorios` (colecciones automáticas por Tipo de producto: Shampoo sólido, Acondicionador sólido, Tónico/Aceite, Ritual, Accesorio).
6. `your-hair-accesorios.csv` trae 6 accesorios (masajeador, jabonera, caja de viaje, bolsa de manta y 2 cepillos). Se importa igual; ajusta nombres o borra los que no vendan.

Los textos son cosméticos: evitan prometer crecimiento, caída o anticaspa. Si el cliente quiere decirlo, necesita pruebas que lo respalden.
