const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');

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
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
    }

    res.json({
      token: `user-${user.id}-token`,
      email: user.email
    });
  } catch (err) {
    console.error('ログインエラー:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// 新規登録エンドポイント
app.post('/api/register', async (req, res) => {
  const { email, password, passwordConfirm } = req.body;

  if (!email || !password || !passwordConfirm) {
    return res.status(400).json({ error: '全ての項目を入力してください' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: '有効なメールアドレスを入力してください' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'パスワードは6文字以上である必要があります' });
  }

  if (password !== passwordConfirm) {
    return res.status(400).json({ error: 'パスワードが一致しません' });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    // フロントから `username` が送られていない場合は、メールアドレスの@より前を既定のユーザー名とする
    const username = req.body.username || (email.split('@')[0]);

    // 利用可能なカラムを検出して、存在するカラムへ挿入する
    const colsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const colSet = new Set(colsRes.rows.map(r => r.column_name));

    // 必要に応じてカラムを追加する（安全策）
    if (!colSet.has('password') && !colSet.has('password_hash')) {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);");
      colSet.add('password_hash');
    }
    if (!colSet.has('username')) {
      await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(255);");
      colSet.add('username');
    }

    const insertCols = ['email'];
    const values = [email];

    if (colSet.has('password')) {
      insertCols.push('password');
      values.push(hashed);
    }
    if (colSet.has('password_hash')) {
      insertCols.push('password_hash');
      values.push(hashed);
    }
    if (colSet.has('username')) {
      insertCols.push('username');
      values.push(username);
    }

    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `INSERT INTO users (${insertCols.join(',')}) VALUES (${placeholders})`;
    await pool.query(sql, values);

    res.status(201).json({ message: '登録が完了しました', email: email });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
    }
    console.error('登録エラー:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// --- サーバー起動 ---
// DB初期化が完了してからExpressサーバーを起動する
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
});