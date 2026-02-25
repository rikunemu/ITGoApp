const express = require('express');
const http = require('http');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const port = 3001;

app.use(cors({
  origin: 'http://localhost:5173'
}));

app.use(express.json());

const pool = new Pool({
  host: process.env.DATABASE_HOST || 'db',
  port: process.env.DATABASE_PORT || 5432,
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'dev_db',
});

const initializeDatabase = async () => {
  let client;
  try {
    client = await pool.connect();

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

app.get('/api/questions', async (req, res) => {
  try {
    const { mode } = req.query;

    let query = 'SELECT id, question, options, correct_answer, mode FROM questions';
    const params = [];

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
    const passwordHash = user.password || user.password_hash;
    const match = await bcrypt.compare(password, passwordHash);

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
    const username = req.body.username || email.split('@')[0];

    const colsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
    const colSet = new Set(colsRes.rows.map((r) => r.column_name));

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

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const buildRoomState = (room) => ({
  players: room.players.map((p) => ({ id: p.id, name: p.name, score: p.score })),
  index: room.index,
  total: room.questions.length
});

io.on('connection', (socket) => {
  socket.on('join_room', async ({ roomId, name, mode }) => {
    if (!roomId || !name || !mode) {
      socket.emit('pvp_error', { message: 'ルームID、名前、モードを入力してください' });
      return;
    }

    const normalizedRoomId = String(roomId).trim().toUpperCase();
    const normalizedName = String(name).trim();
    const normalizedMode = String(mode).trim();

    const room = rooms.get(normalizedRoomId) || {
      id: normalizedRoomId,
      mode: normalizedMode,
      players: [],
      questions: [],
      index: 0,
      answers: new Map(),
      started: false
    };

    if (room.mode !== normalizedMode) {
      socket.emit('pvp_error', { message: 'ルームのモードが一致しません' });
      return;
    }

    if (room.started) {
      socket.emit('pvp_error', { message: 'このルームはすでに開始されています' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('pvp_error', { message: 'このルームは満員です' });
      return;
    }

    room.players.push({ id: socket.id, name: normalizedName, score: 0 });
    rooms.set(normalizedRoomId, room);
    socket.join(normalizedRoomId);

    io.to(normalizedRoomId).emit('room_update', buildRoomState(room));

    if (room.players.length === 2) {
      try {
        const result = await pool.query(
          'SELECT id, question, options, correct_answer, mode FROM questions WHERE mode = $1 ORDER BY id',
          [room.mode]
        );

        if (result.rows.length === 0) {
          io.to(normalizedRoomId).emit('pvp_error', { message: 'このモードの問題がありません' });
          rooms.delete(normalizedRoomId);
          return;
        }

        room.questions = shuffleArray(result.rows);
        room.index = 0;
        room.answers = new Map();
        room.started = true;

        io.to(normalizedRoomId).emit('match_start', {
          ...buildRoomState(room),
          question: room.questions[room.index]
        });
      } catch (err) {
        io.to(normalizedRoomId).emit('pvp_error', { message: '問題の取得に失敗しました' });
        rooms.delete(normalizedRoomId);
      }
    }
  });

  socket.on('submit_answer', ({ roomId, answer }) => {
    const normalizedRoomId = String(roomId || '').trim().toUpperCase();
    const room = rooms.get(normalizedRoomId);
    if (!room || !room.started) return;

    if (!room.answers.has(room.index)) {
      room.answers.set(room.index, new Map());
    }

    const answerMap = room.answers.get(room.index);
    if (answerMap.has(socket.id)) return;

    const currentQuestion = room.questions[room.index];
    const isCorrect =
      typeof answer === 'string' &&
      answer.trim().toLowerCase() === String(currentQuestion.correct_answer).toLowerCase();

    if (isCorrect) {
      const player = room.players.find((p) => p.id === socket.id);
      if (player) player.score += 10;
    }

    answerMap.set(socket.id, { answer, isCorrect });

    if (answerMap.size === room.players.length) {
      io.to(normalizedRoomId).emit('round_result', {
        correctAnswer: currentQuestion.correct_answer,
        players: buildRoomState(room).players,
        answers: Array.from(answerMap.entries()).map(([id, value]) => ({ id, ...value }))
      });

      setTimeout(() => {
        room.index += 1;

        if (room.index >= room.questions.length) {
          const players = buildRoomState(room).players;
          const [p1, p2] = players;
          let winner = 'DRAW';

          if (p1 && p2) {
            if (p1.score > p2.score) winner = p1.name;
            else if (p2.score > p1.score) winner = p2.name;
          }

          io.to(normalizedRoomId).emit('match_end', { players, winner });
          rooms.delete(normalizedRoomId);
          return;
        }

        io.to(normalizedRoomId).emit('next_question', {
          ...buildRoomState(room),
          question: room.questions[room.index]
        });
      }, 1500);
    }
  });

  socket.on('disconnect', () => {
    for (const [roomId, room] of rooms.entries()) {
      const previousCount = room.players.length;
      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length === previousCount) {
        continue;
      }

      io.to(roomId).emit('room_update', buildRoomState(room));

      if (room.players.length === 0) {
        rooms.delete(roomId);
      } else if (room.started) {
        io.to(roomId).emit('match_end', {
          players: buildRoomState(room).players,
          winner: 'OPPONENT_DISCONNECTED'
        });
        rooms.delete(roomId);
      }

      break;
    }
  });
});

initializeDatabase().then(() => {
  server.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
  });
});
