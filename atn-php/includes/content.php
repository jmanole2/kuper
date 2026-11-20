<?php
/**
 * Contenido editable. Cada página se guarda como un documento JSON:
 *   settings, home, comunidad, programa:<slug>, pagina:<slug>
 */

function doc(string $key): array
{
    static $cache = [];
    if (!array_key_exists($key, $cache) || isset($GLOBALS['__doc_dirty'][$key])) {
        $st = db()->prepare('SELECT data FROM docs WHERE key = ?');
        $st->execute([$key]);
        $row = $st->fetchColumn();
        $cache[$key] = $row ? (json_decode($row, true) ?: []) : [];
        unset($GLOBALS['__doc_dirty'][$key]);
    }
    return $cache[$key];
}

function doc_exists(string $key): bool
{
    $st = db()->prepare('SELECT 1 FROM docs WHERE key = ?');
    $st->execute([$key]);
    return (bool) $st->fetchColumn();
}

function doc_updated(string $key): ?string
{
    $st = db()->prepare('SELECT updated_at FROM docs WHERE key = ?');
    $st->execute([$key]);
    return $st->fetchColumn() ?: null;
}

function doc_save(string $key, string $type, array $data, ?int $sort = null): void
{
    $now = date('c');
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $st = db()->prepare('INSERT INTO docs (key, type, data, sort, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at'
        . ($sort !== null ? ', sort = excluded.sort' : ''));
    $st->execute([$key, $type, $json, $sort ?? 0, $now]);
    $GLOBALS['__doc_dirty'][$key] = true;
}

function doc_delete(string $key): void
{
    db()->prepare('DELETE FROM docs WHERE key = ?')->execute([$key]);
}

function doc_rename(string $old, string $new): void
{
    db()->prepare('UPDATE docs SET key = ? WHERE key = ?')->execute([$new, $old]);
}

/** Lista documentos de un tipo (programa / pagina), ordenados. */
function docs_of(string $type): array
{
    $st = db()->prepare('SELECT key, data, sort, updated_at FROM docs WHERE type = ? ORDER BY sort, key');
    $st->execute([$type]);
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $d = json_decode($r['data'], true) ?: [];
        $d['_key'] = $r['key'];
        $d['_slug'] = substr($r['key'], strlen($type) + 1);
        $d['_updated'] = $r['updated_at'];
        $d['_sort'] = (int) $r['sort'];
        $out[] = $d;
    }
    return $out;
}
