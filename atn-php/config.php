<?php
/**
 * Configuración del sitio.
 * Normalmente no necesitas cambiar nada: la URL del sitio se detecta sola
 * y se puede fijar desde el administrador (Configuración → SEO general).
 */
return [
    // Archivo de la base de datos SQLite (la carpeta data/ está protegida con .htaccess).
    'db_path' => __DIR__ . '/data/atn.sqlite',

    // Carpeta donde se guardan las imágenes y archivos que se suben desde el admin.
    'uploads_dir' => __DIR__ . '/uploads',

    // Tamaño máximo por archivo subido (en MB). El hosting también tiene su propio límite.
    'max_upload_mb' => 40,

    // Zona horaria.
    'timezone' => 'America/Mexico_City',

    // Muestra errores en pantalla (solo para pruebas; déjalo en false en producción).
    'debug' => false,
];
