<?php
/**
 * Imágenes y archivos: subida, redimensionado (GD) y etiquetas <img> optimizadas.
 */

const MEDIA_WIDTHS = [480, 960, 1600];

/** Tipos permitidos (se verifica el contenido real del archivo, no solo la extensión). */
function media_allowed(): array
{
    return [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
    ];
}

function media_get($id): ?array
{
    static $cache = [];
    $id = (int) $id;
    if ($id <= 0) {
        return null;
    }
    if (!array_key_exists($id, $cache)) {
        $st = db()->prepare('SELECT * FROM media WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch() ?: null;
        if ($row) {
            $row['variants'] = json_decode($row['variants'], true) ?: [];
        }
        $cache[$id] = $row;
    }
    return $cache[$id];
}

function media_url(?array $m, ?string $variant = null): ?string
{
    if (!$m) {
        return null;
    }
    $file = $variant && !empty($m['variants'][$variant]) ? $m['variants'][$variant] : $m['file'];
    return url('/uploads/' . $file);
}

function media_is_image(?array $m): bool
{
    return $m && strpos($m['mime'], 'image/') === 0;
}

/**
 * Guarda un archivo (subido o local) en uploads/AAAA/MM/ y crea versiones optimizadas.
 * Devuelve el id del registro o lanza RuntimeException con un mensaje en español.
 */
function media_store(string $tmpPath, string $originalName, string $alt = '', bool $isUpload = true): int
{
    if (!is_file($tmpPath)) {
        throw new RuntimeException('No se recibió el archivo.');
    }
    $max = (int) cfg('max_upload_mb', 40) * 1024 * 1024;
    if (filesize($tmpPath) > $max) {
        throw new RuntimeException('El archivo pesa más de ' . cfg('max_upload_mb', 40) . ' MB.');
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($tmpPath) ?: '';
    $allowed = media_allowed();
    if (!isset($allowed[$mime])) {
        throw new RuntimeException('Tipo de archivo no permitido (' . $mime . '). Usa JPG, PNG, WebP, GIF, PDF o MP4.');
    }
    $ext = $allowed[$mime];

    $sub = date('Y/m');
    $dir = cfg('uploads_dir') . '/' . $sub;
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear la carpeta uploads/' . $sub . '. Revisa los permisos.');
    }
    $base = slugify(pathinfo($originalName, PATHINFO_FILENAME)) ?: 'archivo';
    $base = substr($base, 0, 60);
    $name = $base . '.' . $ext;
    $i = 1;
    while (file_exists("$dir/$name")) {
        $name = $base . '-' . (++$i) . '.' . $ext;
    }
    $dest = "$dir/$name";

    $width = $height = null;
    $variants = [];
    $stored = false;

    if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) && function_exists('imagecreatefromstring')) {
        $img = @imagecreatefromstring((string) file_get_contents($tmpPath));
        if ($img) {
            if ($mime === 'image/jpeg') {
                $img = media_fix_orientation($img, $tmpPath);
            }
            $w = imagesx($img);
            $h = imagesy($img);
            // Original limitado a 2400 px para no guardar fotos gigantes.
            if ($w > 2400) {
                $img = media_resize($img, 2400);
                $w = imagesx($img);
                $h = imagesy($img);
            }
            media_write($img, $dest, $ext);
            $stored = true;
            $width = $w;
            $height = $h;
            $webp = function_exists('imagewebp');
            $vext = $webp ? 'webp' : $ext;
            foreach (MEDIA_WIDTHS as $vw) {
                if ($vw >= $w) {
                    continue;
                }
                $vname = pathinfo($name, PATHINFO_FILENAME) . "-{$vw}.{$vext}";
                $res = media_resize($img, $vw);
                media_write($res, "$dir/$vname", $vext);
                imagedestroy($res);
                $variants[(string) $vw] = "$sub/$vname";
            }
            if ($webp && $ext !== 'webp') {
                $vname = pathinfo($name, PATHINFO_FILENAME) . '-full.webp';
                media_write($img, "$dir/$vname", 'webp');
                $variants['full'] = "$sub/$vname";
            }
            // Imagen para compartir en redes (1200×630, recorte centrado).
            $og = media_cover($img, 1200, 630);
            $oname = pathinfo($name, PATHINFO_FILENAME) . '-og.jpg';
            media_write($og, "$dir/$oname", 'jpg');
            imagedestroy($og);
            $variants['og'] = "$sub/$oname";
            imagedestroy($img);
        }
    }

    if (!$stored) {
        $ok = $isUpload ? move_uploaded_file($tmpPath, $dest) : copy($tmpPath, $dest);
        if (!$ok) {
            throw new RuntimeException('No se pudo guardar el archivo. Revisa los permisos de uploads/.');
        }
        if (strpos($mime, 'image/') === 0 && ($info = @getimagesize($dest))) {
            [$width, $height] = $info;
        }
    } elseif ($isUpload) {
        @unlink($tmpPath);
    }
    @chmod($dest, 0644);

    $st = db()->prepare('INSERT INTO media (file, original_name, alt, mime, width, height, variants, created_at) VALUES (?,?,?,?,?,?,?,?)');
    $st->execute(["$sub/$name", $originalName, $alt, $mime, $width, $height, json_encode($variants), date('c')]);
    return (int) db()->lastInsertId();
}

function media_delete(int $id): void
{
    $m = media_get($id);
    if (!$m) {
        return;
    }
    $dir = cfg('uploads_dir');
    foreach (array_merge([$m['file']], array_values($m['variants'])) as $f) {
        $p = realpath($dir . '/' . $f);
        if ($p && strpos($p, realpath($dir)) === 0 && is_file($p)) {
            @unlink($p);
        }
    }
    db()->prepare('DELETE FROM media WHERE id = ?')->execute([$id]);
}

function media_resize($img, int $w)
{
    $ow = imagesx($img);
    $oh = imagesy($img);
    $h = (int) round($oh * $w / $ow);
    $dst = imagecreatetruecolor($w, $h);
    imagealphablending($dst, false);
    imagesavealpha($dst, true);
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $w, $h, $ow, $oh);
    return $dst;
}

function media_cover($img, int $w, int $h)
{
    $ow = imagesx($img);
    $oh = imagesy($img);
    $scale = max($w / $ow, $h / $oh);
    $sw = (int) round($w / $scale);
    $sh = (int) round($h / $scale);
    $sx = (int) round(($ow - $sw) / 2);
    $sy = (int) round(($oh - $sh) / 2);
    $dst = imagecreatetruecolor($w, $h);
    $white = imagecolorallocate($dst, 255, 255, 255);
    imagefill($dst, 0, 0, $white);
    imagecopyresampled($dst, $img, 0, 0, $sx, $sy, $w, $h, $sw, $sh);
    return $dst;
}

function media_write($img, string $path, string $ext): void
{
    switch ($ext) {
        case 'png':
            imagepng($img, $path, 8);
            break;
        case 'webp':
            imagewebp($img, $path, 80);
            break;
        default:
            imageinterlace($img, true);
            imagejpeg($img, $path, 82);
    }
    @chmod($path, 0644);
}

function media_fix_orientation($img, string $path)
{
    if (!function_exists('exif_read_data')) {
        return $img;
    }
    $exif = @exif_read_data($path);
    $o = $exif['Orientation'] ?? 1;
    $map = [3 => 180, 6 => -90, 8 => 90];
    if (isset($map[$o])) {
        $r = imagerotate($img, $map[$o], 0);
        if ($r) {
            imagedestroy($img);
            return $r;
        }
    }
    return $img;
}

/** srcset con las versiones disponibles. */
function media_srcset(array $m): string
{
    $set = [];
    foreach (MEDIA_WIDTHS as $w) {
        if (!empty($m['variants'][(string) $w])) {
            $set[] = url('/uploads/' . $m['variants'][(string) $w]) . " {$w}w";
        }
    }
    $full = $m['variants']['full'] ?? $m['file'];
    if ($m['width']) {
        $set[] = url('/uploads/' . $full) . ' ' . $m['width'] . 'w';
    }
    return implode(', ', $set);
}

/**
 * <img> que llena su contenedor (object-fit: cover).
 * $opts: sizes, class, alt, eager (bool)
 */
function img_fill($id, array $opts = []): string
{
    $m = media_get($id);
    if (!$m || !media_is_image($m)) {
        return '';
    }
    $alt = $opts['alt'] ?? $m['alt'];
    $eager = !empty($opts['eager']);
    $src = url('/uploads/' . ($m['variants']['960'] ?? $m['variants']['full'] ?? $m['file']));
    return '<img class="fill-img ' . e($opts['class'] ?? '') . '" src="' . e($src) . '" srcset="' . e(media_srcset($m)) . '"'
        . ' sizes="' . e($opts['sizes'] ?? '100vw') . '" alt="' . e($alt) . '"'
        . ($m['width'] ? ' width="' . (int) $m['width'] . '" height="' . (int) $m['height'] . '"' : '')
        . ($eager ? ' fetchpriority="high"' : ' loading="lazy"') . ' decoding="async">';
}

/** Logo a tamaño natural (contain). */
function img_logo($id, array $opts = []): string
{
    $m = media_get($id);
    if (!$m || !media_is_image($m)) {
        return '';
    }
    $alt = $opts['alt'] ?? $m['alt'];
    $src = url('/uploads/' . ($m['variants']['960'] ?? $m['variants']['full'] ?? $m['file']));
    return '<img class="' . e($opts['class'] ?? '') . '" src="' . e($src) . '" alt="' . e($alt) . '"'
        . ($m['width'] ? ' width="' . (int) $m['width'] . '" height="' . (int) $m['height'] . '"' : '')
        . (!empty($opts['eager']) ? '' : ' loading="lazy"') . ' decoding="async">';
}
