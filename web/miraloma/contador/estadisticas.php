<?php
// Panel de estadísticas: /contador/estadisticas.php
require __DIR__ . '/config.php';

session_start();
if (isset($_POST['clave'])) {
    if (hash_equals(STATS_PASSWORD, (string)$_POST['clave'])) {
        session_regenerate_id(true);
        $_SESSION['stats_ok'] = true;
        header('Location: estadisticas.php');
        exit;
    }
    $error = 'Clave incorrecta';
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

function n($v): string
{
    return number_format((float)$v, 0, '.', ',');
}

$logueado = !empty($_SESSION['stats_ok']);

// ---------------------------------------------------------------- Login
if (!$logueado): ?>
<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Estadísticas · Reserva Miraloma</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
      font-family: "Aeonik", Inter, system-ui, -apple-system, "Segoe UI", sans-serif; color: #f6f4ef;
      background: radial-gradient(circle at 50% 20%, rgba(34,72,57,.45), transparent 50%), #06100e; }
    form { width: min(360px, 100%); padding: 40px 32px; border: 1px solid rgba(246,244,239,.16); border-radius: 10px;
      background: rgba(255,255,255,.03); display: grid; gap: 14px; }
    .eyebrow { margin: 0; color: #d4a85f; letter-spacing: .22em; text-transform: uppercase; font-size: 12px; }
    h1 { margin: 0 0 10px; font-weight: 400; font-size: 30px; letter-spacing: -.02em; }
    input, button { font: inherit; padding: 14px 16px; border-radius: 4px; }
    input { border: 1px solid rgba(246,244,239,.24); background: rgba(3,8,8,.5); color: #f6f4ef; outline: none; }
    input:focus { border-color: #d4a85f; box-shadow: 0 0 0 3px rgba(212,168,95,.15); }
    button { border: 0; cursor: pointer; color: #13100b; background: linear-gradient(135deg, #e0b66d, #c9974d); }
    .error { margin: 0; color: #ff9d8f; font-size: 14px; }
  </style>
</head>
<body>
  <form method="post">
    <p class="eyebrow">Reserva Miraloma</p>
    <h1>Estadísticas</h1>
    <?php if (!empty($error)): ?><p class="error"><?= h($error) ?></p><?php endif; ?>
    <input type="password" name="clave" placeholder="Clave de acceso" autofocus required />
    <button type="submit">Entrar →</button>
  </form>
</body>
</html>
<?php exit; endif;

// ---------------------------------------------------------------- Datos
$periodos = [1 => 'Últimas 24 h', 7 => '7 días', 30 => '30 días', 90 => '90 días', 365 => '1 año', 0 => 'Todo'];
$dias = (int)($_GET['dias'] ?? 30);
if (!array_key_exists($dias, $periodos)) {
    $dias = 30;
}
$ahora = time();
$desde = $dias ? gmdate('Y-m-d H:i:s', $ahora - $dias * 86400) : '1970-01-01 00:00:00';
$pdo = db();

$q = function (string $sql, array $params = []) use ($pdo, $desde) {
    $st = $pdo->prepare($sql);
    $st->execute($params + [':desde' => $desde]);
    return $st->fetchAll(PDO::FETCH_ASSOC);
};

const ES_LEAD = "pagina LIKE '%gracias%'";

// ---------------------------------------------------------------- CSV
if (isset($_GET['csv'])) {
    $tipo = $_GET['csv'];
    $nombre = 'miraloma-' . $tipo . '-' . ($dias ? $dias . 'd' : 'todo') . '-' . gmdate('Y-m-d') . '.csv';

    if ($tipo === 'visitas') {
        $cols = ['Fecha (UTC)', 'Visitante', 'Página', 'Fuente', 'Medio', 'Campaña', 'Sitio de origen', 'Dispositivo', 'Formulario enviado'];
        $rows = $q('SELECT fecha, substr(visitante, 1, 10), pagina, utm_source, utm_medium, utm_campaign, referencia, dispositivo,
            CASE WHEN ' . ES_LEAD . " THEN 'Sí' ELSE 'No' END
            FROM visitas WHERE fecha >= :desde ORDER BY fecha DESC");
    } elseif ($tipo === 'campanas') {
        $cols = ['Fuente', 'Medio', 'Campaña', 'Visitantes únicos', 'Páginas vistas', 'Formularios', 'Conversión %'];
        $rows = $q("SELECT COALESCE(utm_source, '(directo / orgánico)'), COALESCE(utm_medium, ''), COALESCE(utm_campaign, ''),
            COUNT(DISTINCT visitante) u, COUNT(*),
            COUNT(DISTINCT CASE WHEN " . ES_LEAD . " THEN visitante END) l,
            ROUND(COUNT(DISTINCT CASE WHEN " . ES_LEAD . " THEN visitante END) * 100.0 / COUNT(DISTINCT visitante), 1)
            FROM visitas WHERE fecha >= :desde GROUP BY 1, 2, 3 ORDER BY u DESC");
    } elseif ($tipo === 'diario') {
        $cols = ['Día (UTC)', 'Visitantes únicos', 'Páginas vistas', 'Formularios'];
        $rows = $q('SELECT substr(fecha, 1, 10) d, COUNT(DISTINCT visitante), COUNT(*),
            COUNT(DISTINCT CASE WHEN ' . ES_LEAD . ' THEN visitante END)
            FROM visitas WHERE fecha >= :desde GROUP BY d ORDER BY d');
    } else {
        http_response_code(400);
        exit('Tipo de CSV no válido');
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $nombre . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // para que Excel lea bien los acentos
    fputcsv($out, $cols);
    foreach ($rows as $r) {
        fputcsv($out, array_values($r));
    }
    fclose($out);
    exit;
}

// ---------------------------------------------------------------- Resumen
$resumen = function (string $de, string $hasta) use ($pdo) {
    $st = $pdo->prepare('SELECT COUNT(DISTINCT visitante) unicos, COUNT(DISTINCT ip_hash) ips, COUNT(*) vistas,
        COUNT(DISTINCT CASE WHEN ' . ES_LEAD . ' THEN visitante END) leads
        FROM visitas WHERE fecha >= ? AND fecha < ?');
    $st->execute([$de, $hasta]);
    return $st->fetch(PDO::FETCH_ASSOC);
};
$tot = $resumen($desde, '9999-12-31');
$prev = $dias ? $resumen(gmdate('Y-m-d H:i:s', $ahora - 2 * $dias * 86400), $desde) : null;
$tot['conv'] = $tot['unicos'] ? $tot['leads'] / $tot['unicos'] * 100 : 0;
if ($prev) {
    $prev['conv'] = $prev['unicos'] ? $prev['leads'] / $prev['unicos'] * 100 : 0;
}

function delta(?array $prev, array $tot, string $k, bool $puntos = false): string
{
    if (!$prev) {
        return '';
    }
    if ($puntos) {
        $d = $tot[$k] - $prev[$k];
        $txt = ($d >= 0 ? '+' : '') . number_format($d, 1) . ' pts';
    } elseif ((float)$prev[$k] == 0) {
        if ((float)$tot[$k] == 0) {
            return '<span class="delta">Sin cambio</span>';
        }
        return '<span class="delta up">Nuevo</span>';
    } else {
        $d = ($tot[$k] - $prev[$k]) / $prev[$k] * 100;
        $txt = ($d >= 0 ? '+' : '') . number_format($d, 0) . '%';
    }
    $cls = $d > 0 ? 'up' : ($d < 0 ? 'down' : '');
    return '<span class="delta ' . $cls . '">' . $txt . ' <small>vs periodo anterior</small></span>';
}

// Serie de tiempo (por hora si es 24 h, si no por día), rellenando huecos con 0.
$porHora = $dias === 1;
$len = $porHora ? 13 : 10;
$serieRaw = $q("SELECT substr(fecha, 1, $len) k, COUNT(DISTINCT visitante) u,
    COUNT(DISTINCT CASE WHEN " . ES_LEAD . " THEN visitante END) l
    FROM visitas WHERE fecha >= :desde GROUP BY k ORDER BY k");
$map = array_column($serieRaw, null, 'k');
$labels = $serieU = $serieL = [];
if ($porHora) {
    for ($t = $ahora - 23 * 3600; $t <= $ahora; $t += 3600) {
        $k = gmdate('Y-m-d H', $t);
        $labels[] = gmdate('H:00', $t);
        $serieU[] = (int)($map[$k]['u'] ?? 0);
        $serieL[] = (int)($map[$k]['l'] ?? 0);
    }
} else {
    $inicio = $dias ? $ahora - ($dias - 1) * 86400 : ($serieRaw ? strtotime($serieRaw[0]['k'] . ' UTC') : $ahora);
    $meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    for ($t = $inicio; gmdate('Y-m-d', $t) <= gmdate('Y-m-d', $ahora); $t += 86400) {
        $k = gmdate('Y-m-d', $t);
        $labels[] = gmdate('j', $t) . ' ' . $meses[(int)gmdate('n', $t) - 1];
        $serieU[] = (int)($map[$k]['u'] ?? 0);
        $serieL[] = (int)($map[$k]['l'] ?? 0);
    }
}

$campanas = $q("SELECT COALESCE(utm_source, '(directo / orgánico)') fuente, COALESCE(utm_campaign, '—') campana,
    COUNT(DISTINCT visitante) unicos, COUNT(DISTINCT CASE WHEN " . ES_LEAD . " THEN visitante END) leads
    FROM visitas WHERE fecha >= :desde GROUP BY fuente, campana ORDER BY unicos DESC");

$fuentes = $q("SELECT COALESCE(utm_source, referencia, 'Directo') fuente, COUNT(DISTINCT visitante) unicos
    FROM visitas WHERE fecha >= :desde GROUP BY fuente ORDER BY unicos DESC LIMIT 6");

$dispositivos = $q('SELECT dispositivo, COUNT(DISTINCT visitante) unicos
    FROM visitas WHERE fecha >= :desde GROUP BY dispositivo ORDER BY unicos DESC');

$paginas = $q('SELECT pagina, COUNT(DISTINCT visitante) unicos, COUNT(*) vistas
    FROM visitas WHERE fecha >= :desde GROUP BY pagina ORDER BY unicos DESC LIMIT 12');

$referencias = $q("SELECT referencia, COUNT(DISTINCT visitante) unicos FROM visitas
    WHERE fecha >= :desde AND referencia IS NOT NULL GROUP BY referencia ORDER BY unicos DESC LIMIT 12");

$maxCamp = max(array_merge([1], array_column($campanas, 'unicos')));
$maxPag = max(array_merge([1], array_column($paginas, 'unicos')));
$maxRef = max(array_merge([1], array_column($referencias, 'unicos')));

$chartData = [
    'labels' => $labels,
    'unicos' => $serieU,
    'leads' => $serieL,
    'fuentes' => ['labels' => array_column($fuentes, 'fuente'), 'data' => array_map('intval', array_column($fuentes, 'unicos'))],
    'dispositivos' => ['labels' => array_column($dispositivos, 'dispositivo'), 'data' => array_map('intval', array_column($dispositivos, 'unicos'))],
];
$csvBase = '?dias=' . $dias . '&csv=';
?>
<!DOCTYPE html>
<html lang="es-MX">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Estadísticas · Reserva Miraloma</title>
  <style>
    :root {
      --bg: #06100e; --panel: rgba(255,255,255,.035); --line: rgba(246,244,239,.12);
      --white: #f6f4ef; --muted: rgba(246,244,239,.62); --gold: #d4a85f; --green: #6fbf9a; --red: #ff9d8f;
    }
    * { box-sizing: border-box; }
    body { margin: 0; color: var(--white); line-height: 1.45;
      font-family: "Aeonik", Inter, system-ui, -apple-system, "Segoe UI", sans-serif;
      background: radial-gradient(circle at 15% 0%, rgba(34,72,57,.40), transparent 40%), var(--bg); min-height: 100vh; }
    a { color: inherit; }
    .wrap { width: min(1200px, calc(100% - 32px)); margin: 0 auto; padding: 34px 0 60px; }

    header { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 26px; }
    .eyebrow { margin: 0 0 6px; color: var(--gold); letter-spacing: .22em; text-transform: uppercase; font-size: 12px; }
    h1 { margin: 0; font-weight: 400; font-size: clamp(28px, 4vw, 40px); letter-spacing: -.025em; }
    .header-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 6px; font-size: 14px;
      text-decoration: none; border: 1px solid var(--line); background: var(--panel); cursor: pointer; color: var(--white); font-family: inherit; white-space: nowrap; }
    .btn:hover { border-color: rgba(212,168,95,.6); }
    .btn.gold { background: linear-gradient(135deg, #e0b66d, #c9974d); color: #13100b; border: 0; }

    .dropdown { position: relative; }
    .dropdown-menu { display: none; position: absolute; right: 0; top: calc(100% + 6px); z-index: 10; min-width: 240px;
      padding: 6px; border: 1px solid var(--line); border-radius: 8px; background: #0b1514; box-shadow: 0 20px 50px rgba(0,0,0,.45); }
    .dropdown.open .dropdown-menu { display: block; }
    .dropdown-menu a { display: block; padding: 10px 12px; border-radius: 5px; text-decoration: none; font-size: 14px; }
    .dropdown-menu a:hover { background: rgba(212,168,95,.12); }
    .dropdown-menu small { display: block; color: var(--muted); font-size: 12px; }

    .periodos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 22px; }
    .periodos a { padding: 8px 14px; border-radius: 999px; font-size: 13px; text-decoration: none; color: var(--muted); border: 1px solid var(--line); }
    .periodos a:hover { color: var(--white); }
    .periodos a.on { color: #13100b; background: var(--gold); border-color: var(--gold); }

    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 14px; }
    .card { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 20px; min-width: 0; }
    .kpi .label { color: var(--muted); font-size: 13px; }
    .kpi .value { font-size: 36px; letter-spacing: -.02em; margin: 4px 0 6px; font-variant-numeric: tabular-nums; }
    .kpi.main { border-color: rgba(212,168,95,.5); background: linear-gradient(135deg, rgba(212,168,95,.10), rgba(212,168,95,.02)); }
    .delta { font-size: 13px; color: var(--muted); }
    .delta.up { color: var(--green); }
    .delta.down { color: var(--red); }
    .delta small { color: var(--muted); font-size: 12px; }

    .grid { display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px; }
    .grid.half { grid-template-columns: 1fr 1fr; }
    .card h2 { margin: 0 0 4px; font-size: 17px; font-weight: 500; }
    .card .sub { margin: 0 0 16px; color: var(--muted); font-size: 13px; }
    .card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .chart { position: relative; height: 300px; }
    .chart.small { height: 230px; }

    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--line); white-space: nowrap; }
    th { color: var(--muted); font-weight: 400; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
    tr:last-child td { border-bottom: 0; }
    td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
    .bar-cell { width: 100%; min-width: 120px; }
    .bar { position: relative; height: 26px; border-radius: 4px; overflow: hidden; background: rgba(246,244,239,.04); }
    .bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, rgba(212,168,95,.45), rgba(212,168,95,.18)); border-radius: 4px; }
    .bar span { position: relative; display: block; padding: 4px 10px; overflow: hidden; text-overflow: ellipsis; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; background: rgba(111,191,154,.15); color: var(--green); }
    .pill.zero { background: rgba(246,244,239,.06); color: var(--muted); }
    .empty { color: var(--muted); font-size: 14px; padding: 24px 0; text-align: center; }
    .nota { color: var(--muted); font-size: 12px; margin-top: 22px; }

    @media (max-width: 900px) {
      .grid, .grid.half { grid-template-columns: 1fr; }
      .chart { height: 240px; }
    }
    @media (max-width: 620px) {
      .kpis { grid-template-columns: 1fr 1fr; gap: 10px; }
      .card { padding: 16px; }
      .kpi .value { font-size: 28px; }
      .delta small { display: block; }
      .dropdown-menu { left: 0; right: auto; }
      .periodos a { padding: 7px 12px; }
    }
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <p class="eyebrow">Reserva Miraloma</p>
      <h1>Estadísticas de visitas</h1>
    </div>
    <div class="header-actions">
      <div class="dropdown" id="csvMenu">
        <button class="btn gold" type="button" aria-haspopup="true" aria-expanded="false">⭳ Descargar CSV</button>
        <div class="dropdown-menu" role="menu">
          <a href="<?= h($csvBase) ?>campanas" role="menuitem">Resumen por campaña<small>Únicos, formularios y conversión</small></a>
          <a href="<?= h($csvBase) ?>diario" role="menuitem">Resumen por día<small>Únicos, vistas y formularios por día</small></a>
          <a href="<?= h($csvBase) ?>visitas" role="menuitem">Todas las visitas<small>Una fila por cada visita registrada</small></a>
        </div>
      </div>
      <a class="btn" href="?salir=1">Salir</a>
    </div>
  </header>

  <nav class="periodos" aria-label="Periodo">
    <?php foreach ($periodos as $d => $txt): ?>
      <a href="?dias=<?= $d ?>" class="<?= $d === $dias ? 'on' : '' ?>"><?= $txt ?></a>
    <?php endforeach; ?>
  </nav>

  <section class="kpis">
    <div class="card kpi main">
      <div class="label">Visitantes únicos</div>
      <div class="value"><?= n($tot['unicos']) ?></div>
      <?= delta($prev, $tot, 'unicos') ?>
    </div>
    <div class="card kpi">
      <div class="label">Formularios enviados</div>
      <div class="value"><?= n($tot['leads']) ?></div>
      <?= delta($prev, $tot, 'leads') ?>
    </div>
    <div class="card kpi">
      <div class="label">Tasa de conversión</div>
      <div class="value"><?= number_format($tot['conv'], 1) ?>%</div>
      <?= delta($prev, $tot, 'conv', true) ?>
    </div>
    <div class="card kpi">
      <div class="label">Páginas vistas</div>
      <div class="value"><?= n($tot['vistas']) ?></div>
      <span class="delta"><?= n($tot['ips']) ?> IPs únicas</span>
    </div>
  </section>

  <section class="grid">
    <div class="card">
      <h2>Visitantes en el tiempo</h2>
      <p class="sub"><?= $porHora ? 'Por hora (UTC)' : 'Por día (UTC)' ?> · cada persona cuenta una vez por <?= $porHora ? 'hora' : 'día' ?></p>
      <div class="chart"><canvas id="chartTiempo"></canvas></div>
    </div>
    <div class="card">
      <h2>Dispositivo</h2>
      <p class="sub">Visitantes únicos</p>
      <div class="chart small"><canvas id="chartDispositivo"></canvas></div>
    </div>
  </section>

  <section class="grid half">
    <div class="card">
      <h2>Principales fuentes</h2>
      <p class="sub">Campaña (UTM) o sitio de origen</p>
      <div class="chart small"><canvas id="chartFuentes"></canvas></div>
    </div>
    <div class="card">
      <h2>Páginas</h2>
      <p class="sub">Visitantes únicos por página</p>
      <?php if (!$paginas): ?><p class="empty">Aún no hay visitas en este periodo.</p><?php else: ?>
      <div class="scroll"><table>
        <tr><th>Página</th><th class="n">Únicos</th><th class="n">Vistas</th></tr>
        <?php foreach ($paginas as $r): ?>
          <tr>
            <td class="bar-cell"><div class="bar"><i style="width: <?= round($r['unicos'] / $maxPag * 100) ?>%"></i><span><?= h($r['pagina']) ?></span></div></td>
            <td class="n"><?= n($r['unicos']) ?></td>
            <td class="n"><?= n($r['vistas']) ?></td>
          </tr>
        <?php endforeach; ?>
      </table></div>
      <?php endif; ?>
    </div>
  </section>

  <section class="card" style="margin-bottom: 14px">
    <div class="card-head">
      <div>
        <h2>Campañas</h2>
        <p class="sub">Visitantes únicos, formularios y conversión por campaña</p>
      </div>
      <a class="btn" href="<?= h($csvBase) ?>campanas">⭳ CSV</a>
    </div>
    <?php if (!$campanas): ?><p class="empty">Aún no hay visitas en este periodo.</p><?php else: ?>
    <div class="scroll"><table>
      <tr><th>Fuente · Campaña</th><th class="n">Únicos</th><th class="n">Formularios</th><th class="n">Conversión</th></tr>
      <?php foreach ($campanas as $r): $conv = $r['unicos'] ? $r['leads'] / $r['unicos'] * 100 : 0; ?>
        <tr>
          <td class="bar-cell"><div class="bar"><i style="width: <?= round($r['unicos'] / $maxCamp * 100) ?>%"></i>
            <span><?= h($r['fuente']) ?><?= $r['campana'] !== '—' ? ' · ' . h($r['campana']) : '' ?></span></div></td>
          <td class="n"><?= n($r['unicos']) ?></td>
          <td class="n"><?= n($r['leads']) ?></td>
          <td class="n"><span class="pill <?= $r['leads'] ? '' : 'zero' ?>"><?= number_format($conv, 1) ?>%</span></td>
        </tr>
      <?php endforeach; ?>
    </table></div>
    <?php endif; ?>
  </section>

  <section class="card">
    <h2>Sitios de origen</h2>
    <p class="sub">De qué sitios llegan (Google, Facebook, Instagram, etc.)</p>
    <?php if (!$referencias): ?><p class="empty">Sin visitas desde otros sitios en este periodo.</p><?php else: ?>
    <div class="scroll"><table>
      <tr><th>Sitio</th><th class="n">Únicos</th></tr>
      <?php foreach ($referencias as $r): ?>
        <tr>
          <td class="bar-cell"><div class="bar"><i style="width: <?= round($r['unicos'] / $maxRef * 100) ?>%"></i><span><?= h($r['referencia']) ?></span></div></td>
          <td class="n"><?= n($r['unicos']) ?></td>
        </tr>
      <?php endforeach; ?>
    </table></div>
    <?php endif; ?>
  </section>

  <p class="nota">Cada persona se identifica con una cookie: si entra varias veces, cuenta como 1 visitante. Se ignoran robots y vistas previas de enlaces. Horas en UTC.</p>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<script>
  // Menú de descarga CSV
  (function () {
    var dd = document.getElementById('csvMenu');
    var btn = dd.querySelector('button');
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
    });
    document.addEventListener('click', function () { dd.classList.remove('open'); btn.setAttribute('aria-expanded', false); });
  })();

  (function () {
    if (!window.Chart) return;
    var D = <?= json_encode($chartData, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) ?>;
    var gold = '#d4a85f', green = '#6fbf9a', muted = 'rgba(246,244,239,0.62)', grid = 'rgba(246,244,239,0.08)';
    var palette = ['#d4a85f', '#6fbf9a', '#8fb3e0', '#e08f8f', '#b49be0', '#c9c27a'];

    Chart.defaults.color = muted;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0b1514';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(212,168,95,0.5)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;

    var ctx = document.getElementById('chartTiempo').getContext('2d');
    var fill = ctx.createLinearGradient(0, 0, 0, 300);
    fill.addColorStop(0, 'rgba(212,168,95,0.35)');
    fill.addColorStop(1, 'rgba(212,168,95,0)');

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: D.labels,
        datasets: [
          { label: 'Visitantes únicos', data: D.unicos, borderColor: gold, backgroundColor: fill, fill: true,
            tension: 0.35, borderWidth: 2, pointRadius: D.labels.length > 40 ? 0 : 3, pointBackgroundColor: gold },
          { label: 'Formularios', data: D.leads, borderColor: green, backgroundColor: green,
            tension: 0.35, borderWidth: 2, pointRadius: D.labels.length > 40 ? 0 : 3 }
        ]
      },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 10, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }
        }
      }
    });

    function vacio(id) {
      var c = document.getElementById(id);
      c.parentNode.innerHTML = '<p class="empty">Aún no hay datos en este periodo.</p>';
    }

    if (D.dispositivos.data.length) {
      new Chart(document.getElementById('chartDispositivo'), {
        type: 'doughnut',
        data: { labels: D.dispositivos.labels, datasets: [{ data: D.dispositivos.data, backgroundColor: palette, borderColor: '#06100e', borderWidth: 3 }] },
        options: { maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } } }
      });
    } else { vacio('chartDispositivo'); }

    if (D.fuentes.data.length) {
      new Chart(document.getElementById('chartFuentes'), {
        type: 'bar',
        data: { labels: D.fuentes.labels, datasets: [{ label: 'Visitantes únicos', data: D.fuentes.data, backgroundColor: palette, borderRadius: 4, maxBarThickness: 26 }] },
        options: {
          indexAxis: 'y', maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, grid: { color: grid }, ticks: { precision: 0 } }, y: { grid: { display: false } } }
        }
      });
    } else { vacio('chartFuentes'); }
  })();
</script>
</body>
</html>
