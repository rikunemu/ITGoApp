-- Migration: 003 - Create migrations history table
-- Description: マイグレーション履歴テーブルの作成
-- Created: 2026-01-29

CREATE TABLE IF NOT EXISTS migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
