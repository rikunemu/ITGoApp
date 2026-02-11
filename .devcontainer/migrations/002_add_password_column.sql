-- Migration: 002 - Add password column to users
-- Description: users テーブルに password カラムを追加（存在しない場合のみ）
-- Created: 2026-01-29

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password VARCHAR(255);

-- 注意: 既存のユーザー行には値が入らないため、必要に応じて初期値の設定や再設定を行ってください。
