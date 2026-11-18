<?php $cats = cfg('categories'); $pages = max(1, (int) ceil($total / $per)); ?>
<div class="stats">
  <div class="card stat"><b><?= $stats['total'] ?></b><span>Participaciones confirmadas</span></div>
  <div class="card stat"><b><?= $stats['today'] ?></b><span>Hoy</span></div>
  <div class="card stat"><b><?= $stats['pending'] ?></b><span>Sin verificar (pendientes)</span></div>
  <div class="card stat"><span>Por origen QR</span><br>
    <?php foreach ($stats['by_src'] as $s): ?><span class="tag"><?= e($s['src']) ?>: <?= (int) $s['n'] ?></span><?php endforeach; ?>
  </div>
  <div class="card stat"><span>Por categoría</span><br>
    <?php foreach ($stats['by_cat'] as $s): ?><span class="tag"><?= e($cats[$s['c']] ?? $s['c']) ?>: <?= (int) $s['n'] ?></span><?php endforeach; ?>
  </div>
</div>

<div class="card toolbar">
  <form method="get">
    <input type="search" name="q" value="<?= e($q) ?>" placeholder="Buscar folio, nombre, correo, celular o slogan">
    <button type="submit">Buscar</button>
  </form>
  <a class="btn btn-pri" href="<?= e(url('admin/?a=export')) ?>">Descargar Excel (CSV)</a>
</div>

<p class="muted"><?= $total ?> resultado(s)</p>
<div class="entries">
<?php foreach ($rows as $r): ?>
  <div class="card entry">
    <a href="<?= e(url('admin/?a=photo&id=' . $r['public_id'])) ?>" target="_blank" rel="noopener">
      <img src="<?= e(url('admin/?a=photo&size=thumb&id=' . $r['public_id'])) ?>" alt="Foto de <?= e($r['public_id']) ?>" loading="lazy">
    </a>
    <div>
      <h3><?= e($r['first_name'] . ' ' . $r['last_name']) ?> <span class="muted">· <?= e($r['public_id']) ?></span></h3>
      <p class="slogan">“<?= e($r['slogan']) ?>”</p>
      <span class="tag"><?= e($r['email']) ?></span>
      <span class="tag"><?= e($r['phone']) ?></span>
      <span class="tag">QR: <?= e($r['src']) ?></span>
      <?php if ($r['category']): ?><span class="tag"><?= e($cats[$r['category']] ?? $r['category']) ?></span><?php endif; ?>
      <span class="tag"><?= e($r['created_at']) ?></span>
    </div>
  </div>
<?php endforeach; ?>
</div>

<?php if ($pages > 1): ?>
<nav class="pager">
  <?php if ($page > 1): ?><a class="btn" href="?q=<?= urlencode($q) ?>&p=<?= $page - 1 ?>">← Anterior</a><?php endif; ?>
  <span class="muted" style="align-self:center">Página <?= $page ?> de <?= $pages ?></span>
  <?php if ($page < $pages): ?><a class="btn" href="?q=<?= urlencode($q) ?>&p=<?= $page + 1 ?>">Siguiente →</a><?php endif; ?>
</nav>
<?php endif; ?>
