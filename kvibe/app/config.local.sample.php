<?php
// Copia este archivo como app/config.local.php y llena los secretos.
// config.local.php NO se sube al repositorio.
return [
    'base_url' => 'https://k-vibe.com.mx',

    'db' => [
        'host' => 'mysql.k-vibe.com.mx',   // DreamHost: el hostname MySQL del panel, NO 'localhost'
        'name' => 'kvibe',
        'user' => 'kvibe_app',
        'pass' => 'CAMBIAR',
    ],

    'mail' => [
        'driver' => 'smtp',
        'from'   => 'no-reply@k-vibe.com.mx',
        'smtp'   => [
            'host'   => 'smtp.dreamhost.com',   // DreamHost
            'port'   => 465,
            'secure' => 'ssl',          // 'ssl' (465) o 'tls' (587, STARTTLS)
            'user'   => 'no-reply@k-vibe.com.mx', // correo completo
            'pass'   => 'CAMBIAR',
        ],
    ],

    'captcha' => [
        'provider' => 'turnstile',
        'site_key' => 'CAMBIAR',
        'secret'   => 'CAMBIAR',
    ],

    // Instalación sin SSH: pon aquí una frase larga y aleatoria (mín. 16 caracteres),
    // entra a https://tudominio/setup.php y al terminar bórrala (o déjala vacía).
    'setup_token' => '',

    // Para pruebas locales:
    // 'debug' => true, 'force_https' => false,
    // 'mail' => ['driver' => 'log'], 'captcha' => ['provider' => 'none'],
];
