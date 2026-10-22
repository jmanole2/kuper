<?php
function kioscoPageStart(string $title): void
{
    ?>
<!doctype html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($title, ENT_QUOTES, "UTF-8") ?> · Kiosco SM Kaluz</title>
    <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 16px;
               font-family: "Segoe UI", system-ui, sans-serif; color: #111; background: #f1f1f1; }
        .card { width: min(560px, 100%); padding: 40px; background: #fff; border-radius: 24px;
                box-shadow: 0 20px 50px rgba(0,0,0,.08); }
        .eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: #666; }
        h1 { margin: 8px 0 12px; font-size: 32px; letter-spacing: -.03em; }
        p { color: #555; line-height: 1.5; }
        input { width: 100%; height: 64px; padding: 0 18px; border: 1px solid #ccc; border-radius: 14px;
                font: 700 28px/1 "Consolas", monospace; letter-spacing: .15em; text-transform: uppercase; text-align: center; }
        input:focus { outline: 3px solid #111; border-color: #111; }
        button, .button { display: inline-block; width: 100%; margin-top: 16px; padding: 18px; border: 0; border-radius: 14px;
                 color: #fff; background: #111; font-size: 16px; font-weight: 700; text-align: center; text-decoration: none; cursor: pointer; }
        .error { padding: 14px 16px; border-left: 3px solid #111; background: #f1f1f1; border-radius: 8px; color: #111; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 18px; margin: 24px 0 0; }
        dt { color: #666; } dd { margin: 0; font-weight: 600; word-break: break-all; }
        .ok { color: #0a7a2f; } .bad { color: #b00020; }
        small { color: #777; }
    </style>
</head>
<body>
<main class="card">
    <?php
}

function kioscoPageEnd(): void
{
    ?>
</main>
</body>
</html>
    <?php
}
