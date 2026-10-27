<?php
// Configuración del contador de visitas.
// Esta misma carpeta sirve para cualquier sitio: cada sitio guarda sus propios datos.

// Contraseña para ver las estadísticas (contador/estadisticas.php). CÁMBIALA.
const STATS_PASSWORD = 'cambia-esta-clave';

// Texto secreto para cifrar las IPs (no se guardan en claro). Cámbialo por uno al azar.
const IP_SALT = 'cambia-este-texto-secreto';

// Nombre que aparece en el panel según el dominio.
const SITE_NAMES = [
    'reservamiraloma.com' => 'Reserva Miraloma',
    'angulardesarrollos.com' => 'Angular Desarrollos',
];

// Archivo de base de datos (SQLite). La carpeta data/ está bloqueada al público.
const DB_PATH = __DIR__ . '/data/visitas.sqlite';

// Nombre de la cookie que identifica al visitante y su duración (días).
const VISITOR_COOKIE = 'rm_vid';
const VISITOR_COOKIE_DAYS = 365;

// Tipos de registro. "visita" = página vista; los demás son clics.
const EVENTOS = [
    'visita' => 'Visita',
    'whatsapp' => 'WhatsApp',
    'correo' => 'Correo',
    'telefono' => 'Teléfono',
    'pdf' => 'Descarga PDF',
    'enlace' => 'Enlace a otro sitio',
];

// Qué cuenta como conversión: llegar a la página de gracias (formulario enviado)
// o hacer clic en WhatsApp, correo o teléfono.
const SQL_VISITA = "evento = 'visita'";
const SQL_CONVERSION = "((evento = 'visita' AND pagina LIKE '%gracias%') OR evento IN ('whatsapp', 'correo', 'telefono'))";

function site_name(): string
{
    $host = strtolower(preg_replace('/^www\./', '', $_SERVER['HTTP_HOST'] ?? ''));
    $host = preg_replace('/:\d+$/', '', $host);
    return SITE_NAMES[$host] ?? ($host ?: 'Mi sitio');
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $pdo = new PDO('sqlite:' . DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec("CREATE TABLE IF NOT EXISTS visitas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitante TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        pagina TEXT NOT NULL,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        referencia TEXT,
        dispositivo TEXT,
        fecha TEXT NOT NULL,
        evento TEXT NOT NULL DEFAULT 'visita',
        detalle TEXT
    )");
    // Actualizar bases creadas con la versión anterior.
    $cols = array_column($pdo->query('PRAGMA table_info(visitas)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('evento', $cols, true)) {
        $pdo->exec("ALTER TABLE visitas ADD COLUMN evento TEXT NOT NULL DEFAULT 'visita'");
        $pdo->exec('ALTER TABLE visitas ADD COLUMN detalle TEXT');
    }
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visitas_fecha ON visitas(fecha)');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_visitas_visitante ON visitas(visitante)');
    return $pdo;
}
