<!doctype html>
<html lang="es-MX">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Panel · K-VIBE+</title>
<style>
:root { --bg:#f6f4fb; --card:#fff; --text:#1d1433; --muted:#6b6385; --line:#e4dff0; --pri:#6d28d9; --err:#c0264f; }
@media (prefers-color-scheme: dark) { :root { --bg:#120b24; --card:#1d1436; --text:#f1edfb; --muted:#a69cc4; --line:#2f2550; --pri:#a78bfa; --err:#ff7a9a; } }
* { box-sizing: border-box; }
body { margin:0; font:15px/1.5 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; background:var(--bg); color:var(--text); }
header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 16px; border-bottom:1px solid var(--line); background:var(--card); }
header b { font-style:italic; font-size:18px; }
main { max-width:1200px; margin:0 auto; padding:16px; }
.card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:16px; }
.stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
.stat b { display:block; font-size:28px; font-variant-numeric:tabular-nums; }
.stat span, .muted { color:var(--muted); font-size:13px; }
input, button, .btn { font:inherit; padding:9px 12px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--text); }
button, .btn { cursor:pointer; text-decoration:none; display:inline-block; }
.btn-pri { background:var(--pri); border-color:var(--pri); color:#fff; }
.toolbar { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.toolbar form { display:flex; gap:8px; flex:1; min-width:240px; }
.toolbar input { flex:1; min-width:0; }
.entries { display:grid; gap:12px; }
.entry { display:grid; grid-template-columns:110px 1fr; gap:14px; align-items:start; }
.entry img { width:110px; height:110px; object-fit:cover; border-radius:8px; background:var(--line); }
.entry h3 { margin:0; font-size:15px; }
.slogan { font-size:16px; font-weight:600; margin:6px 0; }
.tag { display:inline-block; font-size:12px; padding:2px 8px; border-radius:99px; border:1px solid var(--line); color:var(--muted); margin-right:4px; }
.login { max-width:360px; margin:10vh auto; }
.login label { display:block; margin:10px 0 4px; font-weight:600; }
.login input { width:100%; }
.err { color:var(--err); font-weight:600; }
.pager { display:flex; gap:8px; justify-content:center; margin-top:16px; }
.inline { display:inline; }
</style>
</head>
<body>
<?php if (current_user()): ?>
<header>
  <b>K-VIBE+ · Panel</b>
  <span class="muted"><?= e(current_user()['username']) ?> (<?= e(current_user()['role']) ?>)
    <form class="inline" method="post" action="<?= e(url('admin/?a=logout')) ?>"><?= csrf_field() ?><button type="submit">Salir</button></form>
  </span>
</header>
<?php endif; ?>
<main><?= $content ?></main>
</body>
</html>
