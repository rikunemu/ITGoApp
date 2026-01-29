const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3001; 

// フロントエンドのオリジンを設定 (Reactの実行ポート)
app.use(cors({
  origin: 'http://localhost:5173'
}));

// JSONボディパーサーを設定
app.use(express.json());

// DevContainerの環境変数からDB接続情報を取得
const pool = new Pool({
  // docker-compose.ymlで設定したサービス名 'db' をホスト名として使用
  host: process.env.DATABASE_HOST || 'db', 
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'dev_db',
});


// --- データベース初期化関数 ---
const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();

    // マイグレーション実行済みか確認
    const migrationsExist = await client.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migrations');
    `);

    if (!migrationsExist.rows[0].exists) {
      console.warn('⚠️  マイグレーションテーブルが見つかりません');
      console.warn('ℹ️  コンテナ環境では: docker-compose up を実行してください');
      console.warn('ℹ️  ローカル環境では: npm run migrate を実行してください');
    } else {
      console.log('✓ データベーススキーマは準備されています');
    }

  } catch (err) {
    console.error('データベース初期化エラー:', err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
};


// --- APIエンドポイント ---

// 全クイズ問題を取得するAPI（モード指定可能）
app.get('/api/questions', async (req, res) => {
  try {
    const { mode } = req.query;
    
    let query = 'SELECT id, question, options, correct_answer, mode FROM questions';
    const params = [];
    
    // モードが指定されている場合、フィルタリング
    if (mode) {
      query += ' WHERE mode = $1';
      params.push(mode);
    }
    
    query += ' ORDER BY id';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('クイズ取得エラー:', err.message);
    res.status(500).json({ error: 'データ取得に失敗しました' });
  }
});

// ログインエンドポイント
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // 入力値の検証
  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
  }

  // 簡易的な認証（本番環境ではデータベースから取得し、パスワードハッシュで検証）
  pool.query('SELECT * FROM users WHERE email = $1', [email], (err, result) => {
    if (err) {
      console.error('ログインエラー:', err);
      return res.status(500).json({ error: 'サーバーエラー' });
    }

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }

    const user = result.rows[0];
    // 本番環境ではbcryptなどでハッシュ検証すること
    if (user.password !== password) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }

    // ログイン成功
    res.json({ 
      token: `user-${user.id}-token`,
      email: user.email
    });
  });
});

// 新規登録エンドポイント
app.post('/api/register', (req, res) => {
  const { email, password, passwordConfirm } = req.body;

  // 入力値の検証
  if (!email || !password || !passwordConfirm) {
    return res.status(400).json({ error: '全ての項目を入力してください' });
  }

  // メールアドレスの形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '有効なメールアドレスを入力してください' });
  }

  // パスワードの長さチェック
  if (password.length < 6) {
    return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
  }

  // パスワード確認
  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'パスワードが一致しません' });
  }

  // ユーザー登録
  pool.query(
    'INSERT INTO users (email, password) VALUES ($1, $2)',
    [email, password],
    (err) => {
      if (err) {
        if (err.code === '23505') { // ユニーク制約違反
          return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
        }
        console.error('登録エラー:', err);
        return res.status(500).json({ error: 'サーバーエラー' });
      }

      res.status(201).json({ 
        message: '登録が完了しました',
        email: email
      });
    }
  );
});

// --- サーバー起動 ---
// DB初期化が完了してからExpressサーバーを起動する
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
});