<?php /** @var string $name @var string $code @var int $ttl */ ?>
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f3f0fa;font-family:Arial,Helvetica,sans-serif;color:#1d1433">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f0fa;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="background:#1d0b4a;background-image:linear-gradient(135deg,#3b0f7a,#1d0b4a 60%,#0b3a6b);padding:28px;text-align:center">
<span style="font-size:30px;font-weight:900;font-style:italic;color:#ffffff;letter-spacing:1px">K-VIBE<span style="color:#22d3ee">+</span></span>
</td></tr>
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 12px;font-size:16px">Hola <?= e($name) ?>:</p>
<p style="margin:0 0 20px;font-size:16px;line-height:1.5">Tu código para confirmar tu participación en el concurso <strong>K-VIBE+</strong> es:</p>
<p style="margin:0 0 20px;text-align:center;font-size:36px;font-weight:700;letter-spacing:10px;color:#5b21b6;background:#f3edff;border-radius:12px;padding:16px 0"><?= e($code) ?></p>
<p style="margin:0 0 8px;font-size:14px;color:#5c5470">Vence en <?= (int) $ttl ?> minutos. Si no fuiste tú, ignora este correo.</p>
</td></tr>
<tr><td style="padding:16px 28px 28px;font-size:12px;color:#8a83a0">K-VIBE+ · Canal 564 de LG Channels</td></tr>
</table>
</td></tr></table>
</body></html>
