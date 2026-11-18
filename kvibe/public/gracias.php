<?php
declare(strict_types=1);
require __DIR__ . '/../app/bootstrap.php';

$folio = $_SESSION['done'] ?? null;
if (!$folio) redirect('');

view('thanks', ['folio' => $folio]);
