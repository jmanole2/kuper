-- Dispositivos (computadoras del kiosco), formularios y sincronización offline.
-- Ejecutar una sola vez, después de las migraciones de 2026-09.

-- 1. Computadoras del kiosco.
--    El admin crea el dispositivo y obtiene un código de activación de un solo uso.
--    El programa local lo canjea y recibe un token secreto (aquí solo se guarda su hash).
CREATE TABLE IF NOT EXISTS dispositivos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    uuid CHAR(36) NULL,
    nombre VARCHAR(120) NOT NULL,
    ubicacion VARCHAR(160) NULL,
    estado ENUM('pendiente', 'activo', 'revocado') NOT NULL DEFAULT 'pendiente',
    token_hash CHAR(64) NULL,
    codigo_hash CHAR(64) NULL,
    codigo_expira_at DATETIME NULL,
    equipo VARCHAR(120) NULL,
    version_app VARCHAR(40) NULL,
    ultima_ip VARCHAR(45) NULL,
    ultima_conexion_at DATETIME NULL,
    activado_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_dispositivos_uuid (uuid),
    UNIQUE INDEX idx_dispositivos_token_hash (token_hash),
    UNIQUE INDEX idx_dispositivos_codigo_hash (codigo_hash),
    INDEX idx_dispositivos_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Interacciones: computadora de origen y UUID generado localmente
--    (permite registrar visitas aunque no haya internet en ese momento).
ALTER TABLE interacciones
    ADD COLUMN dispositivo_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN interaction_uuid CHAR(36) NULL AFTER dispositivo_id,
    ADD UNIQUE INDEX idx_interacciones_uuid (interaction_uuid),
    ADD INDEX idx_interacciones_dispositivo (dispositivo_id, inicio_at),
    ADD CONSTRAINT fk_interacciones_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id)
        ON DELETE SET NULL;

-- 3. Registros: recorridos elegidos, computadora y protección contra duplicados.
ALTER TABLE registros
    ADD COLUMN dispositivo_id BIGINT UNSIGNED NULL AFTER id,
    ADD COLUMN event_uuid CHAR(36) NULL AFTER dispositivo_id,
    ADD COLUMN recorridos VARCHAR(100) NOT NULL DEFAULT '' AFTER correo,
    ADD COLUMN capturado_at DATETIME NULL AFTER recorridos,
    ADD UNIQUE INDEX idx_registros_event_uuid (event_uuid),
    ADD INDEX idx_registros_dispositivo (dispositivo_id),
    ADD CONSTRAINT fk_registros_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id)
        ON DELETE SET NULL;

-- 4. Opiniones (felicitaciones, solicitudes y quejas).
CREATE TABLE IF NOT EXISTS opiniones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    dispositivo_id BIGINT UNSIGNED NULL,
    event_uuid CHAR(36) NOT NULL,
    tipo ENUM('felicitacion', 'solicitud', 'queja') NOT NULL,
    nombre VARCHAR(80) NOT NULL,
    apellido_paterno VARCHAR(80) NOT NULL,
    apellido_materno VARCHAR(80) NULL,
    pais VARCHAR(80) NOT NULL,
    correo VARCHAR(254) NOT NULL,
    edad TINYINT UNSIGNED NOT NULL,
    genero ENUM('masculino', 'femenino', 'no-binario', 'otro', 'prefiero-no-contestar') NOT NULL,
    comentario TEXT NOT NULL,
    acepta_privacidad TINYINT(1) NOT NULL DEFAULT 1,
    capturado_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_opiniones_event_uuid (event_uuid),
    INDEX idx_opiniones_tipo (tipo),
    INDEX idx_opiniones_created_at (created_at),
    INDEX idx_opiniones_dispositivo (dispositivo_id),
    CONSTRAINT fk_opiniones_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos (id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
