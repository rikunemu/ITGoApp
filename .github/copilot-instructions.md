# Copilot Instructions

## プロジェクト概要
- フロントエンド: React + Vite（[frontend/package.json](frontend/package.json)）
- バックエンド: Express + PostgreSQL（[backend/index.js](backend/index.js)）
- 開発環境: Dev Container + Docker Compose（[.devcontainer/devcontainer.json](.devcontainer/devcontainer.json), [.devcontainer/docker-compose.yml](.devcontainer/docker-compose.yml)）

## 主要機能
- クイズ出題（モード別: itpassport/basic/applied）
- ログイン/新規登録
- タイムリミット、残機、スコア、ランキング

## 実行方法
- Backend: `cd backend && npm run dev`
- Frontend: `cd frontend && npm run dev`
- ブラウザ: `"$BROWSER" http://localhost:5173`

## API
- GET `/api/questions?mode=...`（クイズ取得）: [`backend/index.js`](backend/index.js)
- POST `/api/login`（ログイン）: [`backend/index.js`](backend/index.js)
- POST `/api/register`（新規登録）: [`backend/index.js`](backend/index.js)

## データベース
- マイグレーション: [.devcontainer/migrations](.devcontainer/migrations)
- シード: [.devcontainer/migrations/900_seed_quiz_data.sql](.devcontainer/migrations/900_seed_quiz_data.sql)

## フロントエンド構成
- エントリ: [frontend/src/main.jsx](frontend/src/main.jsx)
- 画面・ロジック: [frontend/src/App.jsx](frontend/src/App.jsx)
- スタイル: [frontend/src/App.css](frontend/src/App.css), [frontend/src/index.css](frontend/src/index.css)

## コーディング規約（推奨）
- 既存の状態管理とUI構成を維持（`App.jsx`内で完結）
- API URLは `API_URL`, `LOGIN_URL` を利用
- ログは必要最小限にする

## 注意
- Dev Container環境前提（Debian 12）
- DBは `db` サービスに接続