import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const API_URL = 'http://localhost:3001/api/questions';
const LOGIN_URL = 'http://localhost:3001/api/login';
const REGISTER_URL = 'http://localhost:3001/api/register';
const RANKING_KEY = 'quiz_ranking_data';

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function App() {
  // --- ログイン関連 ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');

  // --- シングルプレイ関連 ---
  const [quizData, setQuizData] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [gameMode, setGameMode] = useState(null);
  const [screenMode, setScreenMode] = useState(null);
  const [playerName, setPlayerName] = useState('');

  // --- PvP関連 ---
  const [pvpRoomId, setPvpRoomId] = useState('');
  const [pvpName, setPvpName] = useState('');
  const [pvpMode, setPvpMode] = useState(null);
  const [pvpPlayers, setPvpPlayers] = useState([]);
  const [pvpQuestion, setPvpQuestion] = useState(null);
  const [pvpAnswer, setPvpAnswer] = useState('');
  const [pvpQuestionIndex, setPvpQuestionIndex] = useState(0);
  const [pvpTotal, setPvpTotal] = useState(0);
  const [pvpWinner, setPvpWinner] = useState(null);
  const [pvpRoundResult, setPvpRoundResult] = useState(null);
  const socketRef = useRef(null);
  const [pvpError, setPvpError] = useState(null);

  // Socket.IO 接続
  useEffect(() => {
    socketRef.current = io('http://localhost:3001');

    socketRef.current.on('room_update', (data) => {
      setPvpPlayers(data.players);
      setPvpQuestionIndex(data.index);
      setPvpTotal(data.total);
    });

    socketRef.current.on('match_start', (data) => {
      setPvpPlayers(data.players);
      setPvpQuestion(data.question);
      setPvpQuestionIndex(data.index);
      setPvpTotal(data.total);
      setPvpAnswer('');
      setScreenMode('onlinePvpMatch');
    });

    socketRef.current.on('next_question', (data) => {
      setPvpQuestion(data.question);
      setPvpQuestionIndex(data.index);
      setPvpAnswer('');
      setPvpRoundResult(null);
    });

    socketRef.current.on('round_result', (data) => {
      setPvpPlayers(data.players);
      setPvpRoundResult(data);
    });

    socketRef.current.on('match_end', (data) => {
      setPvpPlayers(data.players);
      setPvpWinner(data.winner);
      setScreenMode('onlinePvpResult');
    });

    socketRef.current.on('pvp_error', (data) => {
      setPvpError(data.message);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // ログイン処理
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setEmail('');
        setPassword('');
        setGameMode(null);
        setScreenMode(null);
      } else {
        alert('ログインに失敗しました');
      }
    } catch (err) {
      console.error('ログインエラー:', err);
      alert('ログインに失敗しました');
    }
  };

  // 登録処理
  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setRegisterMessage('パスワードが一致しません');
      return;
    }

    try {
      const response = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, passwordConfirm })
      });

      if (response.ok) {
        setRegisterMessage('登録成功！ログインしてください');
        setEmail('');
        setPassword('');
        setPasswordConfirm('');
        setIsRegistering(false);
      } else {
        const data = await response.json();
        setRegisterMessage(data.error || '登録に失敗しました');
      }
    } catch (err) {
      console.error('登録エラー:', err);
      setRegisterMessage('登録に失敗しました');
    }
  };

  // ログアウト
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setGameMode(null);
    setScreenMode(null);
  };

  // クイズデータ取得
  useEffect(() => {
    if (gameMode && token) {
      const fetchQuiz = async () => {
        try {
          const response = await fetch(`${API_URL}?mode=${gameMode}`);
          const data = await response.json();
          const shuffled = shuffleArray(data);
          setQuizData(shuffled);
          setCurrentQuestionIndex(0);
          setScore(0);
          setLives(3);
          setUserAnswer('');
          setResult(null);
          setIsTimeUp(false);
          setTimeLeft(10);
          setIsLoading(false);
        } catch (err) {
          console.error('問題取得エラー:', err);
          setIsLoading(false);
        }
      };
      fetchQuiz();
    }
  }, [gameMode, token]);

  // タイマー
  useEffect(() => {
    if (!gameMode || isTimeUp || currentQuestionIndex >= quizData.length || screenMode !== null) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameMode, isTimeUp, currentQuestionIndex, quizData.length, screenMode]);

  // タイムアップ時
  useEffect(() => {
    if (isTimeUp && gameMode && screenMode === null) {
      handleTimeUp();
    }
  }, [isTimeUp]);

  const handleTimeUp = () => {
    const currentQ = quizData[currentQuestionIndex];
    setResult({
      isCorrect: false,
      correctAnswer: currentQ.correct_answer,
      userAnswer: 'タイムアップ'
    });
    setLives((prev) => prev - 1);
    setTimeLeft(10);
    setIsTimeUp(false);
  };

  const handleSubmit = (answer) => {
    if (screenMode !== null || gameMode === null) return;

    const currentQ = quizData[currentQuestionIndex];
    const isCorrect = answer.trim().toLowerCase() === currentQ.correct_answer.toLowerCase();

    setResult({
      isCorrect,
      correctAnswer: currentQ.correct_answer,
      userAnswer: answer
    });

    if (isCorrect) {
      setScore((prev) => prev + 10);
    } else {
      setLives((prev) => prev - 1);
    }

    setUserAnswer('');
    setTimeLeft(10);
    setIsTimeUp(false);
  };

  const handleNext = () => {
    if (currentQuestionIndex + 1 >= quizData.length || lives <= 0) {
      setScreenMode('nameInput');
    } else {
      setCurrentQuestionIndex((prev) => prev + 1);
      setResult(null);
    }
  };

  const handleRankingSubmit = () => {
    const ranking = JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
    ranking.push({
      name: playerName,
      score,
      mode: gameMode,
      date: new Date().toLocaleDateString('ja-JP')
    });
    ranking.sort((a, b) => b.score - a.score);
    localStorage.setItem(RANKING_KEY, JSON.stringify(ranking.slice(0, 10)));

    setScreenMode('ranking');
    setPlayerName('');
    setGameMode(null);
    setCurrentQuestionIndex(0);
    setScore(0);
    setLives(3);
    setQuizData([]);
  };

  const getRanking = () => {
    return JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  };

  // PvP: ルームID生成
  const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // PvP: ルーム作成
  const handleCreateRoom = (mode) => {
    const roomId = generateRoomId();
    const name = prompt('プレイヤー名を入力してください:');
    if (!name) return;

    setPvpRoomId(roomId);
    setPvpName(name);
    setPvpMode(mode);
    setPvpAnswer('');
    setPvpError(null);

    socketRef.current.emit('join_room', { roomId, name, mode });
    setScreenMode('onlinePvpLobby');
  };

  // PvP: ルーム参加
  const handleJoinRoom = () => {
    if (!pvpRoomId || !pvpName || !pvpMode) {
      setPvpError('ルームID、名前、モードを入力してください');
      return;
    }

    setPvpError(null);
    socketRef.current.emit('join_room', { roomId: pvpRoomId, name: pvpName, mode: pvpMode });
  };

  // PvP: 回答送信
  const handlePvpSubmit = (answer) => {
    if (!pvpRoomId) return;
    socketRef.current.emit('submit_answer', { roomId: pvpRoomId, answer });
    setPvpAnswer('');
  };

  // ========== UI ===========

  // ログイン画面
  if (!token) {
    return (
      <div className="app">
        <div className="login-container">
          <div className="login-header">
            <h1>🎓 ITでGo!</h1>
          </div>

          {isRegistering ? (
            <form onSubmit={handleRegister}>
              <h2>新規登録</h2>
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="パスワード（6文字以上）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="パスワード（確認）"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
              />
              <button type="submit" className="submit-button">
                登録する
              </button>
              {registerMessage && (
                <div style={{ color: 'red', marginTop: '10px' }}>
                  {registerMessage}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(false);
                  setRegisterMessage('');
                }}
                style={{ marginTop: '10px' }}
              >
                ログイン画面に戻る
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <h2>ログイン</h2>
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="submit" className="submit-button">
                ログイン
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(true);
                  setRegisterMessage('');
                }}
                style={{ marginTop: '10px' }}
              >
                新規登録
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // モード選択画面
  if (!gameMode && screenMode === null) {
    return (
      <div className="app">
        <div className="quiz-container">
          <div className="quiz-header">
            <h1>🎓 ITでGo!</h1>
            <button className="logout-button" onClick={handleLogout}>
              ログアウト
            </button>
          </div>

          <div className="mode-selector">
            <h2>学習する試験を選択してください</h2>

            <button className="mode-button itpassport" onClick={() => setGameMode('itpassport')}>
              📘 ITパスポート
              <br />
              <small>IT基礎知識試験</small>
            </button>

            <button className="mode-button basic" onClick={() => setGameMode('basic')}>
              🏠 基本情報技術者試験
              <br />
              <small>IT専門知識試験</small>
            </button>

            <button className="mode-button applied" onClick={() => setGameMode('applied')}>
              🚀 応用情報技術者試験
              <br />
              <small>高度なIT技術試験</small>
            </button>

            <div style={{ marginTop: '20px' }}>
              <button className="submit-button" onClick={() => setScreenMode('onlinePvpLobby')}>
                ⚔️ オンラインPvPを開始
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PvP ロビー画面
  if (screenMode === 'onlinePvpLobby') {
    return (
      <div className="app">
        <div className="quiz-container">
          <h1>⚔️ オンラインPvP</h1>
          <button onClick={() => setScreenMode(null)}>← 戻る</button>

          <div style={{ marginTop: '20px' }}>
            <h2>新しいルームを作成</h2>
            <button onClick={() => handleCreateRoom('itpassport')} className="mode-button itpassport">
              📘 ITパスポート
            </button>
            <button onClick={() => handleCreateRoom('basic')} className="mode-button basic">
              🏠 基本情報
            </button>
            <button onClick={() => handleCreateRoom('applied')} className="mode-button applied">
              🚀 応用情報
            </button>
          </div>

          <div style={{ marginTop: '30px', borderTop: '2px solid #ddd', paddingTop: '20px' }}>
            <h2>既存のルームに参加</h2>
            <input
              type="text"
              placeholder="ルームID（例：A1B2C3）"
              value={pvpRoomId}
              onChange={(e) => setPvpRoomId(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <input
              type="text"
              placeholder="プレイヤー名"
              value={pvpName}
              onChange={(e) => setPvpName(e.target.value)}
              style={{ marginBottom: '10px' }}
            />
            <select
              value={pvpMode || ''}
              onChange={(e) => setPvpMode(e.target.value)}
              style={{ marginBottom: '10px' }}
            >
              <option value="">モードを選択</option>
              <option value="itpassport">ITパスポート</option>
              <option value="basic">基本情報</option>
              <option value="applied">応用情報</option>
            </select>
            <button onClick={handleJoinRoom} className="submit-button">
              参加する
            </button>
            {pvpError && <div style={{ color: 'red', marginTop: '10px' }}>{pvpError}</div>}
          </div>
        </div>
      </div>
    );
  }

  // PvP マッチ中画面
  if (screenMode === 'onlinePvpMatch' && pvpQuestion) {
    return (
      <div className="app">
        <div className="quiz-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h3>ルームID: {pvpRoomId}</h3>
              <p>
                {pvpQuestionIndex + 1} / {pvpTotal}
              </p>
            </div>
            <div>
              <h3>プレイヤー</h3>
              {pvpPlayers.map((p) => (
                <div key={p.id}>
                  {p.name}: {p.score}点
                </div>
              ))}
            </div>
          </div>

          <h2>{pvpQuestion.question}</h2>

          <div className="options">
            {Array.isArray(pvpQuestion.options)
              ? pvpQuestion.options.map((opt, i) => (
                  <button key={i} onClick={() => handlePvpSubmit(opt)} className="option-button">
                    {opt}
                  </button>
                ))
              : JSON.parse(pvpQuestion.options || '[]').map((opt, i) => (
                  <button key={i} onClick={() => handlePvpSubmit(opt)} className="option-button">
                    {opt}
                  </button>
                ))}
          </div>

          {pvpRoundResult && (
            <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
              <p>正解: {pvpRoundResult.correctAnswer}</p>
              {pvpRoundResult.answers.map((ans) => (
                <div key={ans.id}>
                  {ans.id}: {ans.isCorrect ? '✓ 正解' : '✗ 不正解'}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // PvP 結果画面
  if (screenMode === 'onlinePvpResult') {
    return (
      <div className="app">
        <div className="quiz-container">
          <h1>⚔️ ゲーム終了</h1>
          <h2>
            {pvpWinner === 'DRAW'
              ? '引き分け！'
              : pvpWinner === 'OPPONENT_DISCONNECTED'
              ? '相手が切断しました'
              : `${pvpWinner} の勝利！`}
          </h2>

          <div style={{ marginTop: '20px' }}>
            {pvpPlayers.map((p) => (
              <div key={p.id} style={{ marginBottom: '10px' }}>
                <strong>{p.name}</strong>: {p.score}点
              </div>
            ))}
          </div>

          <button onClick={() => setScreenMode(null)} className="submit-button" style={{ marginTop: '20px' }}>
            モード選択に戻る
          </button>
        </div>
      </div>
    );
  }

  // シングルプレイ: ローディング
  if (isLoading) {
    return (
      <div className="app">
        <div className="quiz-container">
          <p>ローディング中...</p>
        </div>
      </div>
    );
  }

  // シングルプレイ: クイズ画面
  if (gameMode && screenMode === null && quizData.length > 0 && lives > 0) {
    const currentQuestion = quizData[currentQuestionIndex];
    const options = Array.isArray(currentQuestion.options)
      ? currentQuestion.options
      : JSON.parse(currentQuestion.options || '[]');

    return (
      <div className="app">
        <div className="quiz-container">
          <div className="quiz-stats">
            <div>スコア: {score}点</div>
            <div>残り: {lives}❤️</div>
            <div>タイマー: {timeLeft}秒</div>
          </div>

          <h2>{currentQuestion.question}</h2>

          <div className="options">
            {options.map((option, index) => (
              <button key={index} onClick={() => handleSubmit(option)} className="option-button">
                {option}
              </button>
            ))}
          </div>

          {result && (
            <div style={{ marginTop: '20px' }}>
              <p style={{ color: result.isCorrect ? 'green' : 'red' }}>
                {result.isCorrect ? '✓ 正解！' : '✗ 不正解'}
              </p>
              <p>正解: {result.correctAnswer}</p>
              <button onClick={handleNext} className="submit-button">
                次へ
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // シングルプレイ: ゲームオーバー or クイズ完了
  if (screenMode === 'nameInput') {
    return (
      <div className="app">
        <div className="quiz-container">
          <h1>クイズ完了！</h1>
          <p>最終スコア: {score}点</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleRankingSubmit();
            }}
          >
            <input
              type="text"
              placeholder="名前を入力"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              required
            />
            <button type="submit" className="submit-button">
              ランキングに登録
            </button>
          </form>
        </div>
      </div>
    );
  }

  // シングルプレイ: ランキング画面
  if (screenMode === 'ranking') {
    const ranking = getRanking();

    return (
      <div className="app">
        <div className="quiz-container">
          <h1>🏆 ランキング</h1>

          <div className="ranking-list">
            {ranking.length === 0 ? (
              <p>ランキングデータがありません</p>
            ) : (
              ranking.map((entry, index) => (
                <div key={index} className="ranking-item">
                  <span>{index + 1}位</span>
                  <span>{entry.name}</span>
                  <span>{entry.score}点</span>
                  <span style={{ fontSize: '0.8em' }}>{entry.date}</span>
                </div>
              ))
            )}
          </div>

          <button onClick={() => setScreenMode(null)} className="submit-button">
            モード選択に戻る
          </button>
        </div>
      </div>
    );
  }

  return <div className="app">エラー: 不明な状態です</div>;
}

export default App;
