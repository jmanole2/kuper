<?php
// Configuración del contador de visitas.

// Contraseña para ver las estadísticas (contador/estadisticas.php). CÁMBIALA.
const STATS_PASSWORD = 'cambia-esta-clave';

// Archivo de base de datos (SQLite). La carpeta data/ está bloqueada al público.
const DB_PATH = __DIR__ . '/data/visitas.sqlite';

// Nombre de la cookie que identifica al visitante y su duración (días).
const VISITOR_COOKIE = 'rm_vid';
const VISITOR_COOKIE_DAYS = 365;

// Texto secreto para cifrar las IPs (no se guardan en claro). Cámbialo por uno al azar.
const IP_SALT = 'cambia-este-texto-secreto';

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('CREATE TABLE IF NOT EXISTS visitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitante TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        pagina TEXT NOT NULL,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        referencia TEXT,
        dispositivo TEXT,
        fecha TEXT NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visitas_visitante ON visitas(visitante)');
    return $pdo;
}
