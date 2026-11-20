<?php
/** Base de datos SQLite (un solo archivo en data/). */

function db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $path = cfg('db_path');
        if (!is_dir(dirname($path))) {
            mkdir(dirname($path), 0755, true);
        }
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    }
    return $pdo;
}

function db_migrate(): void
{
    db()->exec("
        CREATE TABLE IF NOT EXISTS docs (
            key TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            data TEXT NOT NULL,
            sort INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS media (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file TEXT NOT NULL,
            original_name TEXT,
            alt TEXT NOT NULL DEFAULT '',
            mime TEXT NOT NULL,
            width INTEGER,
            height INTEGER,
            variants TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    ");
}
