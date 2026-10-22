ALTER TABLE interacciones
    ADD COLUMN token_hash CHAR(64) NULL AFTER id,
    ADD UNIQUE INDEX idx_interacciones_token_hash (token_hash);
