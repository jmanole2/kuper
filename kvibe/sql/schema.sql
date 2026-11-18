-- K-VIBE+ · Esquema MySQL 5.7+ / MariaDB 10.3+
SET NAMES utf8mb4;

-- Participaciones confirmadas (correo verificado)
CREATE TABLE IF NOT EXISTS entries (
  id                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id           CHAR(10)     NOT NULL,              -- folio no secuencial (vista anónima)
  first_name          VARCHAR(80)  NOT NULL,
  last_name           VARCHAR(80)  NOT NULL,
  email               VARCHAR(190) NOT NULL,
  phone               CHAR(10)     NOT NULL,
  category            VARCHAR(30)  NULL,                  -- opcional, solo referencia interna
  slogan              VARCHAR(500) NOT NULL,
  photo_file          VARCHAR(80)  NOT NULL,              -- nombre aleatorio, fuera del webroot
  src                 VARCHAR(40)  NOT NULL,              -- origen del QR
  terms_version       VARCHAR(30)  NOT NULL,
  terms_accepted_at   DATETIME     NOT NULL,
  privacy_version     VARCHAR(30)  NOT NULL,
  privacy_accepted_at DATETIME     NOT NULL,
  email_verified_at   DATETIME     NOT NULL,
  ip                  VARCHAR(45)  NOT NULL,
  user_agent          VARCHAR(255) NOT NULL DEFAULT '',
  created_at          DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_public_id (public_id),
  UNIQUE KEY uq_email (email),
  UNIQUE KEY uq_phone (phone),
  KEY ix_created (created_at),
  KEY ix_src (src)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registros esperando el código de verificación
CREATE TABLE IF NOT EXISTS pending_entries (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  token             CHAR(64)     NOT NULL,
  first_name        VARCHAR(80)  NOT NULL,
  last_name         VARCHAR(80)  NOT NULL,
  email             VARCHAR(190) NOT NULL,
  phone             CHAR(10)     NOT NULL,
  category          VARCHAR(30)  NULL,
  slogan            VARCHAR(500) NOT NULL,
  photo_file        VARCHAR(80)  NOT NULL,
  src               VARCHAR(40)  NOT NULL,
  terms_version     VARCHAR(30)  NOT NULL,
  privacy_version   VARCHAR(30)  NOT NULL,
  accepted_at       DATETIME     NOT NULL,
  code_hash         VARCHAR(255) NOT NULL,
  code_expires_at   DATETIME     NOT NULL,
  attempts          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  sends             TINYINT UNSIGNED NOT NULL DEFAULT 1,
  last_sent_at      DATETIME     NOT NULL,
  ip                VARCHAR(45)  NOT NULL,
  user_agent        VARCHAR(255) NOT NULL DEFAULT '',
  created_at        DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token),
  KEY ix_email (email),
  KEY ix_phone (phone),
  KEY ix_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Límite de envíos por IP / dispositivo
CREATE TABLE IF NOT EXISTS rate_limits (
  k             CHAR(64)     NOT NULL,
  hits          INT UNSIGNED NOT NULL,
  window_start  INT UNSIGNED NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=ascii;

-- Usuarios del panel (admin / jurado)
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username       VARCHAR(60)  NOT NULL,
  name           VARCHAR(120) NOT NULL DEFAULT '',
  email          VARCHAR(190) NOT NULL DEFAULT '',
  password_hash  VARCHAR(255) NOT NULL,
  role           ENUM('admin','jurado') NOT NULL DEFAULT 'jurado',
  active         TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
