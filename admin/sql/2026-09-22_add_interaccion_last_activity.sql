ALTER TABLE interacciones
    ADD COLUMN ultima_actividad_at DATETIME NULL AFTER inicio_at;

UPDATE interacciones
SET ultima_actividad_at = COALESCE(fin_at, inicio_at)
WHERE ultima_actividad_at IS NULL;

ALTER TABLE interacciones
    MODIFY COLUMN ultima_actividad_at DATETIME NOT NULL,
    ADD INDEX idx_interacciones_estado_actividad (estado, ultima_actividad_at);
