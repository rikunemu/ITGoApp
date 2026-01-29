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

// --- 投入するクイズデータの配列 (各モード別) ---
// ITパスポート試験用
const itPassportData = [
  { 
    question: 'Webページを作成するための基本的な言語は何ですか？', 
    options: ['HTML', 'Python', 'Java', 'CSS'],
    correct_answer: 'HTML',
    mode: 'itpassport'
  },
  { 
    question: '変数や関数を定義できるプログラミング言語は何ですか？', 
    options: ['JavaScript', 'HTML', 'CSS', 'SQL'],
    correct_answer: 'JavaScript',
    mode: 'itpassport'
  },
  { 
    question: 'Webページの見た目（スタイル）を整えるための言語は何ですか？', 
    options: ['CSS', 'JavaScript', 'Python', 'Java'],
    correct_answer: 'CSS',
    mode: 'itpassport'
  },
  { 
    question: 'データを格納し、管理するためのシステムを何と呼びますか？', 
    options: ['データベース', 'キャッシュ', 'メモリ', 'クラウド'],
    correct_answer: 'データベース',
    mode: 'itpassport'
  },
  { 
    question: 'セキュリティを破ろうとする悪意のある第三者のことを何と呼びますか？', 
    options: ['ハッカー', 'エンジニア', 'プログラマー', 'デザイナー'],
    correct_answer: 'ハッカー',
    mode: 'itpassport'
  }
];

// 基本情報技術者試験用
const basicInformationData = [
  { 
    question: 'プログラムが期待通りに動作しない原因を見つけ、修正する作業を何と呼びますか？', 
    options: ['デバッグ', 'コンパイル', 'テスト', 'デプロイ'],
    correct_answer: 'デバッグ',
    mode: 'basic'
  },
  { 
    question: 'コンピュータ同士を接続し、情報をやり取りするための仕組みを何と呼びますか？', 
    options: ['ネットワーク', 'インターネット', 'サーバー', 'クライアント'],
    correct_answer: 'ネットワーク',
    mode: 'basic'
  },
  { 
    question: 'コンピュータの頭脳にあたる部品を、アルファベット3文字で何と呼びますか？', 
    options: ['CPU', 'GPU', 'RAM', 'SSD'],
    correct_answer: 'CPU',
    mode: 'basic'
  },
  { 
    question: 'Webサイトの住所にあたるものを何と呼びますか？', 
    options: ['URL', 'IP', 'DNS', 'HTTP'],
    correct_answer: 'URL',
    mode: 'basic'
  },
  { 
    question: 'コンピュータを動かすための基本的なソフトウェアを何と呼びますか？', 
    options: ['OS', 'アプリ', 'ドライバ', 'ファームウェア'],
    correct_answer: 'OS',
    mode: 'basic'
  }
];

// 応用情報技術者試験用
const appliedInformationData = [
  { 
    question: 'クラウドコンピューティングの利点として適切なものは次のうちどれですか？', 
    options: ['資本投下を削減できる', 'インターネット接続が不要', '処理速度が向上する', 'ハッカーの被害を完全に防ぐ'],
    correct_answer: '資本投下を削減できる',
    mode: 'applied'
  },
  { 
    question: 'ビッグデータを分析する際に使用される技術は次のうちどれですか？', 
    options: ['機械学習', 'VR', '3Dプリンタ', 'ブロックチェーン'],
    correct_answer: '機械学習',
    mode: 'applied'
  },
  { 
    question: 'APIの利点として適切なものは次のうちどれですか？', 
    options: ['異なるシステム間のデータ連携が容易になる', '処理速度が必ず向上する', 'セキュリティが完全に保証される', 'データベースが不要になる'],
    correct_answer: '異なるシステム間のデータ連携が容易になる',
    mode: 'applied'
  },
  { 
    question: 'マイクロサービスアーキテクチャの特徴として適切なものは次のうちどれですか？', 
    options: ['小さなサービスを独立して開発・デプロイできる', '大規模なデータベースが必須である', 'セキュリティ対策が不要になる', 'ユーザーインターフェースの開発が不要になる'],
    correct_answer: '小さなサービスを独立して開発・デプロイできる',
    mode: 'applied'
  },
  { 
    question: 'DevOpsの目的として適切なものは次のうちどれですか？', 
    options: ['開発とITオペレーションの連携を強化し、デリバリー速度を向上させること', 'プログラマーの数を減らすこと', 'ハードウェアの導入コストを削減すること', 'テストを完全に廃止すること'],
    correct_answer: '開発とITオペレーションの連携を強化し、デリバリー速度を向上させること',
    mode: 'applied'
  }
];

const initialQuizData = [...itPassportData, ...basicInformationData, ...appliedInformationData];


// --- データベース初期化関数 ---
const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();

    // 1. 既存テーブルを削除（開発環境での初期化用）
    await client.query(`DROP TABLE IF EXISTS questions;`);
    
    // 2. テーブル作成
    await client.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        options TEXT[] NOT NULL,
        correct_answer VARCHAR(255) NOT NULL,
        mode VARCHAR(50) NOT NULL DEFAULT 'itpassport'
      );
    `);
    
    // 3. 初期データ投入
    console.log("データベースに初期データを投入します...");
    
    for (const q of initialQuizData) {
      const optionsArray = `{${q.options.map(o => `"${o}"`).join(',')}}`;
      await client.query(
        'INSERT INTO questions (question, options, correct_answer, mode) VALUES ($1, $2, $3, $4)',
        [q.question, optionsArray, q.correct_answer, q.mode]
      );
    }
    console.log(`初期データ ${initialQuizData.length} 件の投入が完了しました。`);

  } catch (err) {
    console.error('致命的なデータベース初期化エラー:', err.message);
    console.error('詳細:', err);
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

app.post('/api/login', express.json(), (req, res) => {
  const { email, password } = req.body;

  if (email === 'test@example.com' && password === 'password123') {
    res.json({ token: 'dummy-token-123' });
  } else {
    res.status(401).json({ error: 'メールアドレスまたはパスワードが違います' });
  }
});

// --- サーバー起動 ---
// DB初期化が完了してからExpressサーバーを起動する
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
});