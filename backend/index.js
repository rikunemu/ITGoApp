const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001; 

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// フロントエンドのオリジンを設定 (Reactの実行ポート)
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
}));

// JSONボディパーサーを設定
app.use(express.json());

// DevContainerの環境変数からDB接続情報を取得
const pool = new Pool({
  // DATABASE_URLがあればそれを使い、なければ個別設定を使う
  connectionString: process.env.DATABASE_URL,
  // docker-compose.ymlで設定したサービス名 'db' をホスト名として使用
  host: process.env.DATABASE_HOST || 'db', 
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'dev_db',
  // Render（production）ではSSLを必須にする
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false,
});


// --- データベース初期化関数 ---
const initializeDatabase = async () => {
  let client;
  try {
    console.log('Postgres is ready. Checking migrations...');
    client = await pool.connect();

    // マイグレーションファイルが置いてあるディレクトリを指定
    // Render上のパスに合わせて __dirname を使用
    const migrationDir = path.join(__dirname, '..','.devcontainer', 'migrations');

    if (fs.existsSync(migrationDir)) {
      // ファイル一覧を取得してソート（01_init.sql, 02_data.sql などの順で実行するため）
      const files = fs.readdirSync(migrationDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const filePath = path.join(migrationDir, file);
        console.log(`Applying migration: ${file}`);
        
        const sql = fs.readFileSync(filePath, 'utf8');
        
        try {
          // SQLファイルの中身を実行
          await client.query(sql);
        } catch (err) {
          // すでにテーブルがある場合などのエラーを「警告」として処理し、停止させない
          console.warn(`⚠️ Warning while applying ${file}: ${err.message}`);
        }
      }
      console.log('✓ All migrations processed.');
    } else {
      console.warn(`⚠️ Migration directory not found at: ${migrationDir}`);
    }

  } catch (err) {
    console.error('❌ データベース初期化エラー:', err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
};


// --- APIエンドポイント ---

// 利用可能なAIモデル一覧を取得
app.get('/api/available-models', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API キーが設定されていません' });
    }
    
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1/models?key=' + apiKey
    );
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    res.json({
      success: true,
      models: data.models || []
    });
  } catch (error) {
    console.error('モデル一覧取得エラー:', error.message);
    res.status(500).json({ error: 'モデル一覧取得に失敗しました' });
  }
});

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

// --- 問題自動生成エンドポイント
app.post("/api/questions/generate", async (req, res) => {
  try {
    const { difficulty, count = 5 } = req.body; // difficulty: "easy", "normal", "hard"
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API キーが設定されていません' });
    }

    // 優先モデルを環境変数で指定可能
    const preferredModel = process.env.GENERATIVE_MODEL || 'gemini-1.5-flash';

    // 利用可能モデル一覧を取得して、利用可能なモデルを選択する
    const listResp = await fetch('https://generativelanguage.googleapis.com/v1/models?key=' + apiKey);
    if (!listResp.ok) {
      throw new Error(`ListModels returned ${listResp.status}`);
    }
    const listData = await listResp.json();
    const availableModels = listData.models || [];

    // 試行的に優先モデルを含むモデルを探す。見つからなければ最初の 'bison' か 'gemini' を使う。
    let chosenModel = availableModels.find(m => (m.name || '').includes(preferredModel));
    if (!chosenModel) {
      chosenModel = availableModels.find(m => (m.name || '').toLowerCase().includes('bison'))
        || availableModels.find(m => (m.name || '').toLowerCase().includes('gemini'))
        || availableModels[0];
    }

    if (!chosenModel || !chosenModel.name) {
      return res.status(500).json({ error: '利用可能な生成モデルが見つかりませんでした', available: availableModels.map(m => m.name) });
    }

    const model = genAI.getGenerativeModel({ model: chosenModel.name });

    const examInstructions = {
      itpassport: 'ITパスポート向けの基礎的な4択問題。用語・基本概念・業務に関する初歩的な知識を問う問題を出してください。',
      basic: '基本情報技術者試験向けの中級レベルの4択問題。アルゴリズム、データベース、ネットワーク、OSなどの基礎からやや応用まで問う問題を出してください。',
      applied: '応用情報技術者試験向けの上級レベルの4択問題。設計、運用、セキュリティ、事例に基づく応用的な問題を出してください。'
    };

    const modeNote = examInstructions[difficulty] || '一般的なIT知識を問う4択問題を出してください。';

    const prompt = `
あなたはIT試験の問題出題専門家です。以下の条件で${count}問のクイズ問題を**日本語**で作成してください。

・このセットは「${difficulty}」モード向けです。目的に応じて次の指示に従ってください：
  ${modeNote}

・出力は**JSON配列のみ**とし、余計な説明文やMarkdownを含めないこと。
・各要素はオブジェクトで、以下のフィールドを必ず含むこと。
  {
    "question": "<問題文>",
    "options": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
    "correct_answer": "選択肢2",
    "mode": "${difficulty || 'general'}"
  }

・各問題は日本語で簡潔に記述し、選択肢は必ず4つ用意すること。
  ・correct_answer は options のいずれかのテキストと完全一致させること。

例: [ { ... }, { ... } ] のような正しいJSON配列を返してください。
`;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Try to extract JSON array from the response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      // If extraction fails, return raw text so frontend can show it for debugging
      return res.status(200).json({
        success: false,
        message: 'AIの応答はJSON形式ではありません',
        raw: responseText
      });
    }

    let questions;
    try {
      questions = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(200).json({
        success: false,
        message: 'AIから抽出したJSONがパースできませんでした',
        raw: jsonMatch[0]
      });
    }

    // Normalize items to ensure required fields exist and correct types
    const normalized = questions.map((q, idx) => ({
      id: q.id || idx + 1,
      question: q.question || q.prompt || q.text || '',
      options: Array.isArray(q.options) ? q.options : (q.choices || []).slice(0,4),
      correct_answer: q.correct_answer || q.answer || (Array.isArray(q.options) ? q.options[0] : ''),
      mode: q.mode || difficulty || 'general'
    }));

    res.json({
      success: true,
      data: normalized
    });
    
  } catch (error) {
    console.error('クイズ取得エラー:', error.message);
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