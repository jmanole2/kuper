<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

$doc = ($_GET['doc'] ?? '') === 'privacidad' ? 'privacy' : 'terms';
$url = cfg("legal.{$doc}.url");
if ($url) {
    header('Location: ' . $url, true, 302);
    exit;
}

$file = APP_DIR . '/legal/' . ($doc === 'privacy' ? 'privacidad' : 'terminos') . '.html';
view('legal', [
    'title'   => $doc === 'privacy' ? 'Aviso de Privacidad' : 'Términos y Condiciones',
    'version' => cfg("legal.{$doc}.version"),
    'html'    => is_file($file) ? file_get_contents($file) : '<p>Documento pendiente.</p>',
]);
