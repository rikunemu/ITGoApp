-- Migration: 002 - Create questions table
-- Description: クイズ問題テーブルの作成
-- Created: 2026-01-29

CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_answer VARCHAR(255) NOT NULL,
  mode VARCHAR(50) NOT NULL DEFAULT 'itpassport',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_questions_mode ON questions(mode);
