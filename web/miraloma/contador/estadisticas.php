<?php
// Panel de estadísticas: /contador/estadisticas.php
require __DIR__ . '/config.php';

session_start();
if (isset($_POST['clave'])) {
    if (hash_equals(STATS_PASSWORD, (string)$_POST['clave'])) {
        $_SESSION['stats_ok'] = true;
    } else {
        $error = 'Clave incorrecta';
    }
}
if (isset($_GET['salir'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: estadisticas.php');
    exit;
}

function h($v): string
{
    return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8');
}

$logueado = !empty($_SESSION['stats_ok']);

if ($logueado) {
    $dias = (int)($_GET['dias'] ?? 30);
    if (!in_array($dias, [1, 7, 30, 90, 365, 0], true)) {
        $dias = 30;
    }
    $desde = $dias ? gmdate('Y-m-d H:i:s', time() - $dias * 86400) : '1970-01-01 00:00:00';
    $pdo = db();

    $q = function (string $sql) use ($pdo, $desde) {
        $st = $pdo->prepare($sql);
        $st->execute([':desde' => $desde]);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    };

    $totales = $q('SELECT COUNT(DISTINCT visitante) AS unicos, COUNT(DISTINCT ip_hash) AS ips,
        COUNT(*) AS vistas FROM visitas WHERE fecha >= :desde')[0];

    $leads = $q("SELECT COUNT(DISTINCT visitante) AS n FROM visitas
        WHERE fecha >= :desde AND pagina LIKE '%gracias%'")[0]['n'];

    $porCampana = $q("SELECT COALESCE(utm_source, '(directo / orgánico)') AS fuente,
        COALESCE(utm_campaign, '—') AS campana,
        COUNT(DISTINCT visitante) AS unicos,
        COUNT(DISTINCT CASE WHEN pagina LIKE '%gracias%' THEN visitante END) AS leads
        FROM visitas WHERE fecha >= :desde
        GROUP BY fuente, campana ORDER BY unicos DESC");

    $porPagina = $q('SELECT pagina, COUNT(DISTINCT visitante) AS unicos, COUNT(*) AS vistas
        FROM visitas WHERE fecha >= :desde GROUP BY pagina ORDER BY unicos DESC');

    $porReferencia = $q("SELECT COALESCE(referencia, '(sin referencia)') AS referencia,
        COUNT(DISTINCT visitante) AS unicos FROM visitas WHERE fecha >= :desde
        GROUP BY referencia ORDER BY unicos DESC LIMIT 15");

    $porDispositivo = $q('SELECT dispositivo, COUNT(DISTINCT visitante) AS unicos
        FROM visitas WHERE fecha >= :desde GROUP BY dispositivo ORDER BY unicos DESC');

    $porDia = $q("SELECT substr(fecha, 1, 10) AS dia, COUNT(DISTINCT visitante) AS unicos
        FROM visitas WHERE fecha >= :desde GROUP BY dia ORDER BY dia DESC LIMIT 60");
    $maxDia = max(array_merge([1], array_column($porDia, 'unicos')));
}
?>
<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Estadísticas de visitas</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #06100e; color: #f6f4ef; }
    .wrap { width: min(1100px, calc(100% - 32px)); margin: 32px auto; }
    h1 { font-weight: 400; margin: 0 0 6px; }
    h2 { font-weight: 400; font-size: 20px; margin: 36px 0 12px; color: #d4a85f; }
    .muted { color: rgba(246,244,239,.6); font-size: 14px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin-top: 22px; }
    .card { border: 1px solid rgba(246,244,239,.18); border-radius: 6px; padding: 18px; background: rgba(255,255,255,.03); }
    .card b { display: block; font-size: 34px; font-weight: 500; }
    .card span { color: rgba(246,244,239,.7); font-size: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid rgba(246,244,239,.12); }
    th { color: rgba(246,244,239,.6); font-weight: 400; }
    td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
    .bar { height: 8px; background: #d4a85f; border-radius: 4px; min-width: 2px; }
    .filtros a { color: #f6f4ef; margin-right: 12px; font-size: 14px; }
    .filtros a.on { color: #d4a85f; text-decoration: none; }
    .scroll { overflow-x: auto; }
    form.login { max-width: 320px; margin: 18vh auto; display: grid; gap: 12px; }
    input, button { font: inherit; padding: 12px; border-radius: 3px; border: 1px solid rgba(246,244,239,.3); background: #0b1514; color: #f6f4ef; }
    button { background: #d4a85f; color: #13100b; border: 0; cursor: pointer; }
    .error { color: #ff8a80; }
  </style>
</head>
<body>
<?php if (!$logueado): ?>
  <form class="login" method="post">
    <h1>Estadísticas</h1>
    <?php if (!empty($error)): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
    <input type="password" name="clave" placeholder="Clave" autofocus required />
    <button type="submit">Entrar</button>
  </form>
<?php else: ?>
  <div class="wrap">
    <h1>Visitas</h1>
    <p class="muted">Cada persona cuenta una sola vez aunque entre varias veces (se identifica con una cookie). Horas en UTC.
      · <a href="?salir=1" style="color:inherit">Salir</a></p>

    <p class="filtros">
      <?php foreach ([1 => 'Hoy (24 h)', 7 => '7 días', 30 => '30 días', 90 => '90 días', 365 => '1 año', 0 => 'Todo'] as $d => $txt): ?>
        <a href="?dias=<?= $d ?>" class="<?= $d === $dias ? 'on' : '' ?>"><?= $txt ?></a>
      <?php endforeach; ?>
    </p>

    <div class="cards">
      <div class="card"><b><?= number_format($totales['unicos']) ?></b><span>Visitantes únicos</span></div>
      <div class="card"><b><?= number_format($totales['ips']) ?></b><span>IPs únicas</span></div>
      <div class="card"><b><?= number_format($totales['vistas']) ?></b><span>Páginas vistas (total)</span></div>
      <div class="card"><b><?= number_format($leads) ?></b><span>Formularios enviados</span></div>
    </div>

    <h2>Por campaña</h2>
    <div class="scroll"><table>
      <tr><th>Fuente (utm_source)</th><th>Campaña (utm_campaign)</th><th class="n">Únicos</th><th class="n">Formularios</th><th class="n">Conversión</th></tr>
      <?php foreach ($porCampana as $r): ?>
        <tr><td><?= h($r['fuente']) ?></td><td><?= h($r['campana']) ?></td>
          <td class="n"><?= number_format($r['unicos']) ?></td><td class="n"><?= number_format($r['leads']) ?></td>
          <td class="n"><?= $r['unicos'] ? number_format($r['leads'] / $r['unicos'] * 100, 1) . '%' : '—' ?></td></tr>
      <?php endforeach; ?>
    </table></div>

    <h2>Por página</h2>
    <div class="scroll"><table>
      <tr><th>Página</th><th class="n">Únicos</th><th class="n">Vistas</th></tr>
      <?php foreach ($porPagina as $r): ?>
        <tr><td><?= h($r['pagina']) ?></td><td class="n"><?= number_format($r['unicos']) ?></td><td class="n"><?= number_format($r['vistas']) ?></td></tr>
      <?php endforeach; ?>
    </table></div>

    <h2>De dónde llegan (sitios)</h2>
    <div class="scroll"><table>
      <tr><th>Sitio</th><th class="n">Únicos</th></tr>
      <?php foreach ($porReferencia as $r): ?>
        <tr><td><?= h($r['referencia']) ?></td><td class="n"><?= number_format($r['unicos']) ?></td></tr>
      <?php endforeach; ?>
    </table></div>

    <h2>Dispositivo</h2>
    <div class="scroll"><table>
      <tr><th>Tipo</th><th class="n">Únicos</th></tr>
      <?php foreach ($porDispositivo as $r): ?>
        <tr><td><?= h($r['dispositivo']) ?></td><td class="n"><?= number_format($r['unicos']) ?></td></tr>
      <?php endforeach; ?>
    </table></div>

    <h2>Por día</h2>
    <div class="scroll"><table>
      <tr><th>Día</th><th style="width:55%"></th><th class="n">Únicos</th></tr>
      <?php foreach ($porDia as $r): ?>
        <tr><td><?= h($r['dia']) ?></td>
          <td><div class="bar" style="width: <?= round($r['unicos'] / $maxDia * 100) ?>%"></div></td>
          <td class="n"><?= number_format($r['unicos']) ?></td></tr>
      <?php endforeach; ?>
    </table></div>
  </div>
<?php endif; ?>
</body>
</html>
