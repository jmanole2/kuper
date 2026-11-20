<?php
/**
 * Generador de formularios del administrador a partir de includes/schemas.php,
 * y limpieza de los datos al guardar.
 */

/** Todos los campos de un esquema (une las pestañas). */
function schema_fields(array $schema): array
{
    $all = [];
    foreach ($schema['tabs'] as $fields) {
        $all = array_merge($all, $fields);
    }
    return $all;
}

function field_classes(array $f): string
{
    $c = 'fld fld--' . $f['type'];
    foreach (['half', 'third', 'twothirds'] as $w) {
        if (!empty($f[$w])) {
            $c .= ' fld--' . $w;
        }
    }
    return $c;
}

/**
 * Pinta campos. $name: prefijo del atributo name (data[hero]); $path: ruta con puntos (hero).
 */
function render_fields(array $fields, array $data, string $name, string $path, int $depth = 0): void
{
    foreach ($fields as $f) {
        $n = $name . '[' . $f['name'] . ']';
        $p = ($path === '' ? '' : $path . '.') . $f['name'];
        $v = $data[$f['name']] ?? null;
        $id = 'f_' . preg_replace('/[^a-z0-9_]/i', '_', $p);
        $help = !empty($f['help']) ? '<p class="help">' . e($f['help']) . '</p>' : '';
        $label = $f['label'] ?? '';
        $req = !empty($f['required']) ? ' required' : '';
        $maxAttr = !empty($f['max']) ? ' maxlength="' . (int) $f['max'] . '" data-count' : '';
        $ph = !empty($f['placeholder']) ? ' placeholder="' . e($f['placeholder']) . '"' : '';

        switch ($f['type']) {
            case 'text':
            case 'number':
                $type = $f['type'] === 'number' ? 'number' : 'text';
                echo '<div class="' . field_classes($f) . '"><label for="' . e($id) . '">' . e($label) . '</label>'
                    . '<input type="' . $type . '" id="' . e($id) . '" name="' . e($n) . '" value="' . e($v) . '"' . $req . $maxAttr . $ph . '>' . $help . '</div>';
                break;

            case 'textarea':
                echo '<div class="' . field_classes($f) . '"><label for="' . e($id) . '">' . e($label) . '</label>'
                    . '<textarea id="' . e($id) . '" name="' . e($n) . '" rows="' . (int) ($f['rows'] ?? 4) . '"' . $maxAttr . $ph . '>' . e($v) . '</textarea>' . $help . '</div>';
                break;

            case 'richtext':
                echo '<div class="' . field_classes($f) . '" data-rte><label>' . e($label) . '</label>'
                    . '<div class="rte-bar" role="toolbar" aria-label="Formato">'
                    . '<button type="button" data-cmd="formatBlock" data-val="h2" title="Título">T</button>'
                    . '<button type="button" data-cmd="formatBlock" data-val="h3" title="Subtítulo">t</button>'
                    . '<button type="button" data-cmd="formatBlock" data-val="p" title="Párrafo">¶</button>'
                    . '<button type="button" data-cmd="bold" title="Negritas"><b>B</b></button>'
                    . '<button type="button" data-cmd="italic" title="Cursiva"><i>I</i></button>'
                    . '<button type="button" data-cmd="insertUnorderedList" title="Lista">• Lista</button>'
                    . '<button type="button" data-cmd="insertOrderedList" title="Lista numerada">1. Lista</button>'
                    . '<button type="button" data-cmd="createLink" title="Enlace">Enlace</button>'
                    . '<button type="button" data-cmd="unlink" title="Quitar enlace">Quitar enlace</button>'
                    . '</div>'
                    . '<div class="rte" contenteditable="true">' . clean_html((string) $v) . '</div>'
                    . '<textarea name="' . e($n) . '" hidden>' . e(clean_html((string) $v)) . '</textarea>' . $help . '</div>';
                break;

            case 'checkbox':
                echo '<div class="' . field_classes($f) . '"><label class="check"><input type="checkbox" name="' . e($n) . '" value="1"' . (!empty($v) ? ' checked' : '') . '> ' . e($label) . '</label>' . $help . '</div>';
                break;

            case 'select':
                echo '<div class="' . field_classes($f) . '"><label for="' . e($id) . '">' . e($label) . '</label><select id="' . e($id) . '" name="' . e($n) . '" data-icon-select>';
                foreach ($f['options'] as $ov => $ol) {
                    echo '<option value="' . e($ov) . '"' . ((string) $v === (string) $ov ? ' selected' : '') . '>' . e($ol) . '</option>';
                }
                echo '</select>';
                if ($f['name'] === 'icon') {
                    echo '<span class="icon-preview" data-icon-preview>' . icon((string) ($v ?: array_key_first($f['options']))) . '</span>';
                }
                echo $help . '</div>';
                break;

            case 'image':
            case 'file':
                $m = media_get($v);
                $isImg = $f['type'] === 'image';
                $thumb = $m && media_is_image($m)
                    ? '<img src="' . e(media_url($m, isset($m['variants']['480']) ? '480' : null)) . '" alt="">'
                    : ($m ? '<span class="file-name">' . e(basename($m['file'])) . '</span>' : '<span class="empty">Sin ' . ($isImg ? 'imagen' : 'archivo') . '</span>');
                $accept = $isImg ? 'image/jpeg,image/png,image/webp,image/gif' : 'application/pdf,video/mp4,video/webm,image/*';
                echo '<div class="' . field_classes($f) . '" data-media-field data-kind="' . ($isImg ? 'image' : 'file') . '">'
                    . '<label>' . e($label) . '</label>'
                    . '<div class="media-box">'
                    . '<div class="media-thumb" data-thumb>' . $thumb . '</div>'
                    . '<div class="media-actions">'
                    . '<input type="hidden" name="' . e($n) . '" value="' . e($m ? $m['id'] : '') . '" data-media-id>'
                    . '<label class="btn btn--sm">Subir ' . ($isImg ? 'imagen' : 'archivo') . '<input type="file" name="upload[' . e($p) . ']" accept="' . $accept . '" data-media-file hidden></label>'
                    . '<button type="button" class="btn btn--sm btn--ghost" data-media-pick>Elegir de la biblioteca</button>'
                    . '<button type="button" class="btn btn--sm btn--ghost" data-media-clear>Quitar</button>'
                    . ($isImg ? '<input type="text" class="alt-input" name="alt[' . e($p) . ']" value="' . e($m['alt'] ?? '') . '" placeholder="Texto alternativo: describe la imagen (SEO)">' : '')
                    . '</div></div>' . $help . '</div>';
                break;

            case 'group':
                $compact = !empty($f['compact']);
                if ($label !== '') {
                    echo '<fieldset class="group' . ($compact ? ' group--compact' : '') . '"><legend>' . e($label) . '</legend>';
                } else {
                    echo '<div class="group group--plain">';
                }
                echo '<div class="fields">';
                render_fields($f['fields'], is_array($v) ? $v : [], $n, $p, $depth);
                echo '</div>';
                echo $label !== '' ? '</fieldset>' : '</div>';
                break;

            case 'repeater':
                $rows = is_array($v) ? array_values($v) : [];
                $max = (int) ($f['max'] ?? 0);
                $ph = '__i' . $depth . '__';
                echo '<fieldset class="group repeater" data-repeater data-depth="' . $depth . '" data-max="' . $max . '">'
                    . '<legend>' . e($label) . ($max ? ' <small>(máx. ' . $max . ')</small>' : '') . '</legend>' . $help
                    . '<div class="rows" data-rows>';
                foreach ($rows as $i => $row) {
                    render_row($f, is_array($row) ? $row : [], $n . '[' . $i . ']', $p . '.' . $i, $depth, $i + 1);
                }
                echo '</div>';
                echo '<template data-tpl>';
                render_row($f, [], $n . '[' . $ph . ']', $p . '.' . $ph, $depth, 0);
                echo '</template>';
                echo '<button type="button" class="btn btn--sm" data-add>+ Agregar ' . e($f['singular'] ?? 'elemento') . '</button>';
                echo '</fieldset>';
                break;
        }
    }
}

function render_row(array $f, array $row, string $name, string $path, int $depth, int $num): void
{
    $title = $row['title'] ?? $row['name'] ?? $row['label'] ?? $row['question'] ?? $row['heading'] ?? $row['text'] ?? '';
    echo '<div class="row" data-row>'
        . '<div class="row-head"><span class="row-num">' . ($num ?: '') . '</span><span class="row-title">' . e(mb_strimwidth((string) $title, 0, 70, '…')) . '</span>'
        . '<span class="row-tools">'
        . '<button type="button" data-up title="Subir">↑</button>'
        . '<button type="button" data-down title="Bajar">↓</button>'
        . '<button type="button" data-toggle title="Mostrar / ocultar">▾</button>'
        . '<button type="button" data-remove title="Eliminar" class="danger">✕</button>'
        . '</span></div><div class="row-body fields">';
    render_fields($f['fields'], $row, $name, $path, $depth + 1);
    echo '</div></div>';
}

/** Limpia y ordena lo que llega del formulario según el esquema. */
function normalize_fields(array $fields, $input): array
{
    $input = is_array($input) ? $input : [];
    $out = [];
    foreach ($fields as $f) {
        $v = $input[$f['name']] ?? null;
        switch ($f['type']) {
            case 'text':
            case 'textarea':
                $v = trim(str_replace("\r\n", "\n", (string) $v));
                if (!empty($f['max'])) {
                    $v = mb_substr($v, 0, (int) $f['max']);
                }
                $out[$f['name']] = $v;
                break;
            case 'number':
                $out[$f['name']] = (int) $v;
                break;
            case 'checkbox':
                $out[$f['name']] = !empty($v);
                break;
            case 'select':
                $out[$f['name']] = array_key_exists((string) $v, $f['options']) ? (string) $v : (string) array_key_first($f['options']);
                break;
            case 'image':
            case 'file':
                $out[$f['name']] = ((int) $v) > 0 && media_get((int) $v) ? (int) $v : null;
                break;
            case 'richtext':
                $out[$f['name']] = clean_html((string) $v);
                break;
            case 'group':
                $out[$f['name']] = normalize_fields($f['fields'], $v);
                break;
            case 'repeater':
                $rows = [];
                foreach (is_array($v) ? $v : [] as $row) {
                    $rows[] = normalize_fields($f['fields'], $row);
                }
                if (!empty($f['max'])) {
                    $rows = array_slice($rows, 0, (int) $f['max']);
                }
                $out[$f['name']] = $rows;
                break;
        }
    }
    return $out;
}

/**
 * Procesa archivos subidos (upload[ruta]) y textos alternativos (alt[ruta]) sobre los datos crudos.
 * Devuelve la lista de errores.
 */
function apply_uploads(array &$input): array
{
    $errors = [];
    $files = $_FILES['upload'] ?? null;
    if ($files && is_array($files['name'])) {
        foreach ($files['name'] as $path => $origName) {
            $err = $files['error'][$path];
            if ($err === UPLOAD_ERR_NO_FILE) {
                continue;
            }
            if (strpos((string) $path, '__i') !== false) {
                continue;
            }
            if ($err !== UPLOAD_ERR_OK) {
                $errors[] = '“' . $origName . '”: ' . upload_error_text($err);
                continue;
            }
            try {
                $alt = trim((string) ($_POST['alt'][$path] ?? ''));
                $id = media_store($files['tmp_name'][$path], (string) $origName, $alt);
                set_path($input, (string) $path, $id);
            } catch (Throwable $t) {
                $errors[] = '“' . $origName . '”: ' . $t->getMessage();
            }
        }
    }
    foreach ($_POST['alt'] ?? [] as $path => $alt) {
        $id = (int) get($input, (string) $path, 0);
        if ($id > 0) {
            db()->prepare('UPDATE media SET alt = ? WHERE id = ?')->execute([trim((string) $alt), $id]);
        }
    }
    return $errors;
}

function upload_error_text(int $err): string
{
    switch ($err) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'pesa más de lo que permite el hosting (' . ini_get('upload_max_filesize') . ').';
        case UPLOAD_ERR_PARTIAL:
            return 'se subió incompleto, inténtalo de nuevo.';
        default:
            return 'no se pudo subir (error ' . $err . ').';
    }
}
