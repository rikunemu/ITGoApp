const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 5000;

// CORSを許可（フロントエンドと連携するため）
app.use(cors());

// ルートにアクセスしたときのレスポンス
app.get('/', (req, res) => {
  res.send('こんにちは、ITでGo！');
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`サーバーが http://localhost:${PORT} で起動しました`);
});