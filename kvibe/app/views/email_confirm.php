<?php /** @var string $name @var string $folio @var string $slogan @var string $announce @var string $contact */ ?>
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f1ecfb;font-family:Arial,Helvetica,sans-serif;color:#1d1433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ecfb;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;background:#ffffff;border-radius:18px;overflow:hidden">
<tr><td style="background:#6a1bd6;background-image:linear-gradient(120deg,#ff3fd2 0%,#8b3dff 50%,#4fd6ff 100%);padding:30px 24px;text-align:center">
<div style="font-size:14px;font-weight:700;font-style:italic;letter-spacing:1px;color:#ffffff;text-transform:uppercase">Muestra tu lado</div>
<div style="font-size:38px;font-weight:900;color:#ffffff;line-height:1.1">K-VIBE+</div>
<div style="display:inline-block;margin-top:8px;padding:6px 16px;border-radius:10px;border:2px solid rgba(255,255,255,.8);font-size:14px;font-weight:700;font-style:italic;color:#ffffff;text-transform:uppercase">Más creativo y gana</div>
</td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 12px;font-size:16px">Hola <?= e($name) ?>:</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">¡Gracias por participar! Tu foto y tu slogan quedaron registrados.</p>
<p style="margin:0 0 6px;font-size:13px;color:#5c5470;text-align:center;text-transform:uppercase;letter-spacing:1px">Tu folio de participación</p>
<p style="margin:0 0 20px;text-align:center;font-size:30px;font-weight:700;letter-spacing:4px;color:#5b21b6;background:#f3edff;border-radius:12px;padding:14px 0"><?= e($folio) ?></p>
<p style="margin:0 0 6px;font-size:13px;color:#5c5470">Tu slogan:</p>
<p style="margin:0 0 20px;font-size:16px;font-style:italic;line-height:1.5">“<?= e($slogan) ?>”</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.5">Los ganadores se publicarán el <strong><?= e($announce) ?></strong> en <a href="<?= e(rtrim((string) cfg('base_url'), '/')) ?>" style="color:#5b21b6"><?= e(preg_replace('#^https?://#', '', rtrim((string) cfg('base_url'), '/'))) ?></a>.</p>
<p style="margin:0 0 8px;font-size:14px;color:#5c5470;line-height:1.5">Guarda este correo: tu folio identifica tu participación.</p>
</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;color:#8a83a0;line-height:1.5">
<?php if ($contact): ?>Dudas sobre la promoción: <a href="mailto:<?= e($contact) ?>" style="color:#8a83a0"><?= e($contact) ?></a><br><?php endif; ?>
K-VIBE+ · Canal 564
</td></tr>
</table>
</td></tr></table>
</body></html>
