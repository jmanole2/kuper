<?php
// Borra registros sin verificar viejos y sus fotos, y límites vencidos.
// Cron sugerido (cada hora):  0 * * * * php /ruta/kvibe/bin/cleanup.php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

$n = cleanup_pending();
db()->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([time() - 86400]);

// Fotos huérfanas en pending/ (sin registro) de más de un día
$known = array_flip(db()->query('SELECT photo_file FROM pending_entries')->fetchAll(PDO::FETCH_COLUMN));
$orphans = 0;
foreach (glob(STORAGE . '/uploads/pending/*.jpg') as $f) {
    if (!isset($known[basename($f)]) && filemtime($f) < time() - 86400) {
        unlink($f);
        $orphans++;
    }
}
echo date('c') . " pendientes borrados: {$n}, fotos huérfanas: {$orphans}\n";
