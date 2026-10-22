<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $adminRoot = dirname(__DIR__);
    $paths = [
        $adminRoot . "/models/",
        $adminRoot . "/controllers/",
        $adminRoot . "/services/",
        $adminRoot . "/core/",
    ];

    foreach ($paths as $path) {
        $file = $path . $class . ".php";

        if (is_file($file)) {
            require_once $file;
            return;
        }
    }
});
