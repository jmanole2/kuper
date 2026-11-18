<?php
// Copia este archivo como app/config.local.php y llena los secretos.
// config.local.php NO se sube al repositorio.
return [
    'base_url' => 'https://kvibeplus.mx',

    'db' => [
        'host' => 'localhost',
        'name' => 'kvibe',
        'user' => 'kvibe_app',
        'pass' => 'CAMBIAR',
    ],

    'mail' => [
        'driver' => 'smtp',
        'from'   => 'no-reply@kvibeplus.mx',
        'smtp'   => [
            'host'   => 'mail.kvibeplus.mx',
            'port'   => 465,
            'secure' => 'ssl',          // 'ssl' (465) o 'tls' (587, STARTTLS)
            'user'   => 'no-reply@kvibeplus.mx',
            'pass'   => 'CAMBIAR',
        ],
    ],

    'captcha' => [
        'provider' => 'turnstile',
        'site_key' => 'CAMBIAR',
        'secret'   => 'CAMBIAR',
    ],

    // Para pruebas locales:
    // 'debug' => true, 'force_https' => false,
    // 'mail' => ['driver' => 'log'], 'captcha' => ['provider' => 'none'],
];
