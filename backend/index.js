const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // package.jsonで追加したCORSミドルウェアを使用

const app = express();
const port = 3001; 

// フロントエンドのオリジンを設定 (Reactの実行ポート)
app.use(cors({
  origin: 'http://localhost:5173'
}));

// DevContainerの環境変数からDB接続情報を取得
const pool = new Pool({
  // docker-compose.ymlで設定したサービス名 'db' をホスト名として使用
  host: process.env.DATABASE_HOST || 'db', 
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'dev_db',
});

// --- 投入するクイズデータの配列 (10問) ---
const initialQuizData = [
  { question: 'Webページを作成するための基本的な言語は何ですか？', answer: 'html' },
  { question: '変数や関数を定義できるプログラミング言語は何ですか？', answer: 'javascript' },
  { question: 'Webページの見た目（スタイル）を整えるための言語は何ですか？', answer: 'css' },
  { question: 'データを格納し、管理するためのシステムを何と呼びますか？', answer: 'データベース' },
  { question: 'プログラムが期待通りに動作しない原因を見つけ、修正する作業を何と呼びますか？', answer: 'デバッグ' },
  { question: 'コンピュータ同士を接続し、情報をやり取りするための仕組みを何と呼びますか？', answer: 'ネットワーク' },
  { question: 'コンピュータの頭脳にあたる部品を、アルファベット3文字で何と呼びますか？', answer: 'cpu' },
  { question: 'Webサイトの住所にあたるものを何と呼びますか？', answer: 'url' },
  { question: 'コンピュータを動かすための基本的なソフトウェアを何と呼びますか？', answer: 'os' },
  { question: 'セキュリティを破ろうとする悪意のある第三者のことを何と呼びますか？', answer: 'ハッカー' }
];


// --- データベース初期化関数 ---
const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();

    // 1. テーブル作成 (存在しない場合のみ)
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        correct_answer VARCHAR(255) NOT NULL
      );
    `);
    
    // 2. 初期データ投入 (データが空の場合のみ)
    const countResult = await client.query('SELECT COUNT(*) FROM questions;');
    if (parseInt(countResult.rows[0].count) === 0) {
      console.log("データベースに初期データを投入します...");
      
      // SQLインジェクションを防ぐため、安全にデータを整形してクエリに含めます
      const values = initialQuizData.map(q => `('${q.question.replace(/'/g, "''")}', '${q.answer.replace(/'/g, "''")}')`).join(',');

      await client.query(`
        INSERT INTO questions (question, correct_answer) 
        VALUES ${values};
      `);
      console.log(`初期データ ${initialQuizData.length} 件の投入が完了しました。`);
    } else {
      console.log(`データベースには既に ${countResult.rows[0].count} 件のデータが存在します。初期データ投入はスキップしました。`);
    }

  } catch (err) {
    console.error('致命的なデータベース初期化エラー:', err.message);
  } finally {
    if (client) {
      client.release();
    }
  }
};


// --- APIエンドポイント ---

// 全クイズ問題を取得するAPI
app.get('/api/questions', async (req, res) => {
  try {
    // DBから全問題を取得し、フロントエンドにJSON形式で返す
    const result = await pool.query('SELECT id, question, correct_answer FROM questions ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('クイズ取得エラー:', err.message);
    res.status(500).send('Internal Server Error');
  }
});


// --- サーバー起動 ---
// DB初期化が完了してからExpressサーバーを起動する
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
});