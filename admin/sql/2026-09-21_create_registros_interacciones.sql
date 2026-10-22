CREATE TABLE IF NOT EXISTS registros (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(254) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_registros_correo (correo),
    INDEX idx_registros_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS interacciones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    token_hash CHAR(64) NULL,
    inicio_at DATETIME NOT NULL,
    ultima_actividad_at DATETIME NOT NULL,
    fin_at DATETIME NULL,
    duracion_segundos INT UNSIGNED NULL,
    estado ENUM('activa', 'finalizada') NOT NULL DEFAULT 'activa',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE INDEX idx_interacciones_token_hash (token_hash),
    INDEX idx_interacciones_inicio_at (inicio_at),
    INDEX idx_interacciones_estado (estado),
    INDEX idx_interacciones_estado_actividad (estado, ultima_actividad_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
