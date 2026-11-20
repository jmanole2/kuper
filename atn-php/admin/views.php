<?php
/** Vistas del administrador. */
$s = doc('settings');
$flashes = $_SESSION['flash'] ?? [];
unset($_SESSION['flash']);
$cssV = @filemtime(__DIR__ . '/admin.css') ?: 1;
$jsV = @filemtime(__DIR__ . '/admin.js') ?: 1;
$titles = [
    'setup' => 'Crear usuario', 'login' => 'Entrar', 'dashboard' => 'Panel', 'edit' => 'Editar',
    'list' => 'Lista', 'media' => 'Imágenes y archivos', 'users' => 'Usuarios',
];
$navActive = function (string $match) use ($view): string {
    $a = $_GET['a'] ?? 'dashboard';
    $k = $_GET['k'] ?? '';
    $t = $_GET['t'] ?? '';
    $cur = $a . ':' . ($k ?: $t);
    return strpos($cur, $match) === 0 || ($match === 'list:programa' && strpos($k, 'programa:') === 0) || ($match === 'list:pagina' && strpos($k, 'pagina:') === 0) ? ' class="active"' : '';
};
?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title><?= e($titles[$view] ?? 'Admin') ?> · Admin <?= e($s['siteName'] ?? '') ?></title>
    <link rel="icon" href="<?= e(url('/assets/favicon.svg')) ?>" type="image/svg+xml">
    <link rel="stylesheet" href="<?= e(url('/admin/admin.css')) ?>?v=<?= $cssV ?>">
</head>
<body class="view-<?= e($view) ?>">

<?php if (in_array($view, ['setup', 'login'], true)): ?>
    <main class="auth">
        <div class="auth-card">
            <p class="brand"><?= e($s['siteName'] ?? 'Admin') ?></p>
            <?php foreach ($flashes as [$t, $m]): ?><div class="flash flash--<?= e($t) ?>"><?= e($m) ?></div><?php endforeach; ?>
            <?php if ($view === 'setup'): ?>
                <h1>Te damos la bienvenida</h1>
                <p class="muted">Crea el usuario administrador para empezar.</p>
                <form method="post" class="stack">
                    <?= csrf_field() ?>
                    <label>Nombre<input name="name" autocomplete="name"></label>
                    <label>Correo electrónico<input type="email" name="email" required autocomplete="email"></label>
                    <label>Contraseña (mín. 8 caracteres)<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
                    <label>Confirmar contraseña<input type="password" name="password2" required minlength="8" autocomplete="new-password"></label>
                    <button class="btn btn--primary btn--block">Crear usuario</button>
                </form>
            <?php else: ?>
                <h1>Entrar al administrador</h1>
                <form method="post" action="<?= e(admin_url(['a' => 'login'])) ?>" class="stack">
                    <?= csrf_field() ?>
                    <label>Correo electrónico<input type="email" name="email" required autocomplete="username" autofocus></label>
                    <label>Contraseña<input type="password" name="password" required autocomplete="current-password"></label>
                    <button class="btn btn--primary btn--block">Entrar</button>
                </form>
            <?php endif; ?>
        </div>
    </main>
<?php else: ?>
<div class="app">
    <aside class="side">
        <a class="side-brand" href="<?= e(admin_url()) ?>"><?= e($s['siteName'] ?? 'Admin') ?><small>Administrador</small></a>
        <nav>
            <p class="side-label">Páginas</p>
            <a href="<?= e(admin_url(['a' => 'edit', 'k' => 'home'])) ?>"<?= $navActive('edit:home') ?>>Inicio</a>
            <a href="<?= e(admin_url(['a' => 'edit', 'k' => 'comunidad'])) ?>"<?= $navActive('edit:comunidad') ?>>Comunidad</a>
            <a href="<?= e(admin_url(['a' => 'list', 't' => 'programa'])) ?>"<?= $navActive('list:programa') ?>>Programas</a>
            <a href="<?= e(admin_url(['a' => 'list', 't' => 'pagina'])) ?>"<?= $navActive('list:pagina') ?>>Páginas de texto</a>
            <p class="side-label">Contenido</p>
            <a href="<?= e(admin_url(['a' => 'media'])) ?>"<?= $navActive('media') ?>>Imágenes y archivos</a>
            <p class="side-label">Configuración</p>
            <a href="<?= e(admin_url(['a' => 'edit', 'k' => 'settings'])) ?>"<?= $navActive('edit:settings') ?>>Configuración del sitio</a>
            <a href="<?= e(admin_url(['a' => 'users'])) ?>"<?= $navActive('users') ?>>Usuarios</a>
        </nav>
        <div class="side-foot">
            <a href="<?= e(url('/')) ?>" target="_blank" rel="noopener">Ver sitio ↗</a>
            <a href="<?= e(admin_url(['a' => 'logout'])) ?>">Salir (<?= e($user['name'] ?: $user['email']) ?>)</a>
        </div>
    </aside>
    <main class="main">
        <?php foreach ($flashes as [$t, $m]): ?><div class="flash flash--<?= e($t) ?>"><?= e($m) ?></div><?php endforeach; ?>

<?php if ($view === 'dashboard'): ?>
        <h1>Hola<?= $user['name'] ? ', ' . e($user['name']) : '' ?></h1>
        <p class="muted">¿Qué quieres editar hoy?</p>
        <div class="cards">
            <a class="card" href="<?= e(admin_url(['a' => 'edit', 'k' => 'home'])) ?>"><strong>Inicio</strong><span>Carrusel, ¿qué es?, impacto, mapa, programas y recetario</span></a>
            <a class="card" href="<?= e(admin_url(['a' => 'edit', 'k' => 'comunidad'])) ?>"><strong>Comunidad</strong><span>Video, mapa, testimonios y recetario</span></a>
            <?php foreach (docs_of('programa') as $p): ?>
                <a class="card" href="<?= e(admin_url(['a' => 'edit', 'k' => $p['_key']])) ?>"><strong><?= e($p['name'] ?? $p['_slug']) ?></strong><span>Programa · /<?= e($p['_slug']) ?></span></a>
            <?php endforeach; ?>
            <a class="card" href="<?= e(admin_url(['a' => 'media'])) ?>"><strong>Imágenes y archivos</strong><span>Fotos, logos y PDFs</span></a>
            <a class="card" href="<?= e(admin_url(['a' => 'edit', 'k' => 'settings'])) ?>"><strong>Configuración</strong><span>Logo, menú, aliados, pie de página, WhatsApp, redes y SEO</span></a>
        </div>

<?php elseif ($view === 'edit'):
        $type = doc_type_of($key);
        $tabs = array_keys($schema['tabs']);
        $activeTab = in_array($_GET['tab'] ?? '', $tabs, true) ? $_GET['tab'] : $tabs[0];
        $publicPath = public_path_of($key);
        $docTitle = $key === 'home' ? 'Inicio' : ($key === 'comunidad' ? 'Comunidad' : ($key === 'settings' ? 'Configuración del sitio' : ($data['name'] ?? $data['title'] ?? $key)));
        ?>
        <form method="post" enctype="multipart/form-data" class="editor" data-editor>
            <?= csrf_field() ?>
            <input type="hidden" name="_tab" value="<?= e($activeTab) ?>" data-tab-input>
            <div class="editor-head">
                <div>
                    <p class="crumb"><?= $type === 'programa' ? 'Programas' : ($type === 'pagina' ? 'Páginas de texto' : ($type === 'settings' ? 'Configuración' : 'Páginas')) ?></p>
                    <h1><?= e($docTitle) ?></h1>
                </div>
                <div class="editor-actions">
                    <?php if ($publicPath): ?><a class="btn btn--ghost" href="<?= e(url($publicPath)) ?>" target="_blank" rel="noopener">Ver página ↗</a><?php endif; ?>
                    <button class="btn btn--primary" data-save>Guardar cambios</button>
                </div>
            </div>
            <?php if (in_array($type, ['programa', 'pagina'], true)): ?>
                <div class="fld slug-fld">
                    <label for="slug">Dirección (URL)</label>
                    <div class="slug-input"><span><?= e(rtrim(site_url(), '/')) ?>/</span><input id="slug" name="_slug" value="<?= e(explode(':', $key, 2)[1]) ?>" pattern="[a-z0-9\-]+"></div>
                </div>
            <?php endif; ?>
            <div class="tabs" role="tablist">
                <?php foreach ($tabs as $t): ?>
                    <button type="button" role="tab" class="tab<?= $t === $activeTab ? ' is-active' : '' ?>" data-tab="<?= e($t) ?>"><?= e($t) ?></button>
                <?php endforeach; ?>
            </div>
            <?php foreach ($schema['tabs'] as $t => $fields): ?>
                <section class="panel fields<?= $t === $activeTab ? ' is-active' : '' ?>" data-panel="<?= e($t) ?>">
                    <?php render_fields($fields, $data, 'data', ''); ?>
                </section>
            <?php endforeach; ?>
            <div class="editor-foot"><button class="btn btn--primary" data-save>Guardar cambios</button></div>
        </form>
        <?php if (in_array($type, ['programa', 'pagina'], true)): ?>
            <form method="post" action="<?= e(admin_url(['a' => 'delete'])) ?>" class="danger-zone" onsubmit="return confirm('¿Eliminar definitivamente? Esta acción no se puede deshacer.')">
                <?= csrf_field() ?><input type="hidden" name="k" value="<?= e($key) ?>">
                <button class="btn btn--danger btn--sm">Eliminar <?= $type === 'programa' ? 'programa' : 'página' ?></button>
            </form>
        <?php endif; ?>

<?php elseif ($view === 'list'): ?>
        <h1><?= $type === 'programa' ? 'Programas' : 'Páginas de texto' ?></h1>
        <p class="muted"><?= $type === 'programa' ? 'Cada programa tiene su propia página con portada, beneficios, convocatoria, proceso, etapas y testimonios.' : 'Aviso de privacidad, quejas y sugerencias y otras páginas de solo texto.' ?></p>
        <table class="table">
            <thead><tr><th>Nombre</th><th>URL</th><th>Actualizado</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($items as $it): ?>
                <tr>
                    <td><a href="<?= e(admin_url(['a' => 'edit', 'k' => $it['_key']])) ?>"><strong><?= e($it['name'] ?? $it['title'] ?? $it['_slug']) ?></strong></a></td>
                    <td><a href="<?= e(url('/' . $it['_slug'])) ?>" target="_blank" rel="noopener">/<?= e($it['_slug']) ?> ↗</a></td>
                    <td class="muted"><?= e(date('d/m/Y H:i', strtotime($it['_updated']))) ?></td>
                    <td class="right"><a class="btn btn--sm" href="<?= e(admin_url(['a' => 'edit', 'k' => $it['_key']])) ?>">Editar</a></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <form method="post" class="box inline-form">
            <?= csrf_field() ?>
            <h2>Crear <?= $type === 'programa' ? 'programa' : 'página' ?></h2>
            <div class="fields">
                <div class="fld fld--half"><label>Nombre<input name="name" required></label></div>
                <div class="fld fld--half"><label>URL (opcional)<input name="slug" placeholder="se genera del nombre"></label></div>
                <?php if ($type === 'programa'): ?>
                    <div class="fld fld--half"><label>Copiar contenido de
                        <select name="copy"><option value="">— Empezar vacío —</option>
                            <?php foreach ($items as $it): ?><option value="<?= e($it['_key']) ?>"><?= e($it['name'] ?? $it['_slug']) ?></option><?php endforeach; ?>
                        </select></label></div>
                <?php endif; ?>
            </div>
            <button class="btn btn--primary">Crear</button>
        </form>

<?php elseif ($view === 'media'): ?>
        <h1>Imágenes y archivos</h1>
        <p class="muted">Las fotos se optimizan automáticamente (WebP y varios tamaños). Formatos: JPG, PNG, WebP, GIF, PDF y MP4. Límite del hosting por archivo: <?= e(ini_get('upload_max_filesize')) ?>.</p>
        <form method="post" enctype="multipart/form-data" class="box upload-box">
            <?= csrf_field() ?><input type="hidden" name="do" value="upload">
            <input type="file" name="files[]" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,video/mp4,video/webm" required>
            <button class="btn btn--primary">Subir</button>
        </form>
        <div class="media-grid">
            <?php foreach ($media as $m): $m['variants'] = json_decode($m['variants'], true) ?: []; $isImg = strpos($m['mime'], 'image/') === 0; ?>
                <div class="media-item">
                    <a class="media-item__thumb" href="<?= e(media_url($m)) ?>" target="_blank" rel="noopener">
                        <?php if ($isImg): ?><img src="<?= e(media_url($m, isset($m['variants']['480']) ? '480' : null)) ?>" alt="" loading="lazy"><?php else: ?><span class="file-badge"><?= e(strtoupper(pathinfo($m['file'], PATHINFO_EXTENSION))) ?></span><?php endif; ?>
                    </a>
                    <p class="media-item__name" title="<?= e($m['file']) ?>"><?= e(basename($m['file'])) ?><?= $m['width'] ? ' · ' . (int) $m['width'] . '×' . (int) $m['height'] : '' ?></p>
                    <form method="post" class="media-item__alt">
                        <?= csrf_field() ?><input type="hidden" name="do" value="alt"><input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
                        <input name="alt" value="<?= e($m['alt']) ?>" placeholder="Texto alternativo"><button class="btn btn--sm">Guardar</button>
                    </form>
                    <form method="post" onsubmit="return confirm('¿Eliminar este archivo? Si se usa en alguna página, dejará de mostrarse.')">
                        <?= csrf_field() ?><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= (int) $m['id'] ?>">
                        <button class="link-danger">Eliminar</button>
                    </form>
                </div>
            <?php endforeach; ?>
        </div>

<?php elseif ($view === 'users'): ?>
        <h1>Usuarios</h1>
        <table class="table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Creado</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($users as $u): ?>
                <tr>
                    <td><?= e($u['name'] ?: '—') ?></td><td><?= e($u['email']) ?></td><td class="muted"><?= e(date('d/m/Y', strtotime($u['created_at']))) ?></td>
                    <td class="right"><?php if ((int) $u['id'] !== (int) $user['id']): ?>
                        <form method="post" onsubmit="return confirm('¿Eliminar este usuario?')"><?= csrf_field() ?><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= (int) $u['id'] ?>"><button class="link-danger">Eliminar</button></form>
                    <?php else: ?><span class="muted">(tú)</span><?php endif; ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <div class="two-col">
            <form method="post" class="box stack">
                <?= csrf_field() ?><input type="hidden" name="do" value="add">
                <h2>Agregar usuario</h2>
                <label>Nombre<input name="name"></label>
                <label>Correo<input type="email" name="email" required></label>
                <label>Contraseña (mín. 8)<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
                <button class="btn btn--primary">Agregar</button>
            </form>
            <form method="post" class="box stack">
                <?= csrf_field() ?><input type="hidden" name="do" value="password">
                <h2>Cambiar mi contraseña</h2>
                <label>Nueva contraseña<input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
                <label>Confirmar<input type="password" name="password2" required minlength="8" autocomplete="new-password"></label>
                <button class="btn btn--primary">Actualizar</button>
            </form>
        </div>
<?php endif; ?>
    </main>
</div>

<div class="modal" data-modal hidden>
    <div class="modal-card" role="dialog" aria-modal="true" aria-label="Biblioteca">
        <div class="modal-head"><strong>Elegir de la biblioteca</strong><input type="search" placeholder="Buscar…" data-modal-search><button type="button" data-modal-close aria-label="Cerrar">✕</button></div>
        <div class="modal-grid" data-modal-grid><p class="muted">Cargando…</p></div>
    </div>
</div>
<script>window.ATN_ADMIN = { mediaJson: <?= json_encode(admin_url(['a' => 'media_json'])) ?>, icons: <?= json_encode(array_combine(array_keys(icon_options()), array_map('icon', array_keys(icon_options())))) ?> };</script>
<script src="<?= e(url('/admin/admin.js')) ?>?v=<?= $jsV ?>"></script>
<?php endif; ?>
</body>
</html>
