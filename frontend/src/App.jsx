import { useState, useEffect } from 'react';
import './App.css';

// バックエンドAPIのURL
const API_URL = 'http://localhost:3001/api/questions';
// ログイン画面のURL(ログインしているかどうかでクイズ画面とのだし分けを行う。今は未実装)
const LOGIN_URL = 'http://localhost:3001/api/login';
// ローカルストレージのキー
const RANKING_KEY = 'quiz_ranking_data';

// ランダム出題
// 配列のシャッフル（Fisher–Yates）
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function App() {
  // --- 状態管理 (ログイン関連) ---
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 取得した全問題リスト
  const [quizData, setQuizData] = useState([]);
  // 現在出題中の問題のインデックス
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // ユーザーの回答
  const [userAnswer, setUserAnswer] = useState('');
  // 結果メッセージ
  const [result, setResult] = useState(null);
  // データ取得中かどうか
  const [isLoading, setIsLoading] = useState(true);
  // スコア管理用
  const [score, setScore] = useState(0);
  // 残機機能（3つ間違えたら終了）
  const [lives, setLives] = useState(3);

  // ランキング関連の状態
  //const [isFinished, setIsFinished] = useState(false);
  const [ranking, setRanking] = useState([]);

  const [screenMode, setScreenMode] = useState('quiz'); // 'quiz', 'nameInput', 'ranking'
  const [inputName, setInputName] = useState('');

  // スコアを保存してランキングを表示する関数
  // const finishGame = (finalScore) => {
  //   // 1. 既存のランキングを取得
  //   const prevRanking = JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
  //   // 2. 新しいスコアを追加してソート（降順）し、上位5件を保持
  //   const newRanking = [...prevRanking, finalScore]
  //     .sort((a, b) => b - a)
  //     .slice(0, 5);

  //   // 3. ローカルストレージと状態を更新
  //   localStorage.setItem(RANKING_KEY, JSON.stringify(newRanking));
  //   setRanking(newRanking);
  //   setIsFinished(true);
  // };

  const currentQuestion = quizData[currentQuestionIndex];


  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("--- ログイン処理開始 ---");
    console.log("宛先URL:", LOGIN_URL);

    try {
      // タイムアウト（5秒待ってもダメなら諦める）を設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log("サーバー応答ステータス:", response.status);
      const data = await response.json();
      console.log("サーバーからのデータ:", data);

      if (!response.ok) {
        alert(data.error || 'ログインに失敗しました');
        return;
      }

      // ★ここが最重要
      localStorage.setItem('token', data.token);
      setToken(data.token);   // ← これで画面が切り替わる


    } catch (error) {
      console.error("❌ Fetchエラーの詳細:", error.name, error.message);
      if (error.name === 'AbortError') {
        alert("サーバーから応答がありません（タイムアウト）");
      } else {
        alert("通信エラー: " + error.message);
      }
    }
  };

  // --- ログアウト処理 ---
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // --- データ取得 ---
  useEffect(() => {
    console.log("useEffectが実行されました。現在のtoken:", token);

    const fetchQuiz = async () => {
      // 1. トークンがない場合
      if (!token) {
        console.log("トークンがないため、読み込みを終了します。");
        setIsLoading(false); // ★ここが重要！ログイン画面を出すためにfalseにする
        return;
      }

      // 2. トークンがある場合、データを取得
      try {
        console.log("APIからデータを取得します...");
        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`サーバーエラー: ${response.status}`);
        }

        const data = await response.json();
        console.log("取得データ:", data);
        console.log(data)
        setQuizData(shuffleArray(data));
      } catch (err) {
        console.error("フェッチエラー:", err);
        setResult("データの取得に失敗しました。");
      } finally {
        console.log("読み込み完了（setIsLoading(false)を実行）");
        setIsLoading(false); // 成功しても失敗しても必ず実行
      }
    };

    fetchQuiz();
  }, [token]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!currentQuestion) return;

    // 正解の判定（大文字小文字を区別しない、前後の空白を除去）
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.toLowerCase();

    let updatedLives = lives;
    //let updatedScore = score;

    if (isCorrect) {
      setResult('正解です！🎉');
      setScore((prev) => prev + 10);
    } else {
      setResult(`不正解です。正解は「${currentQuestion.correct_answer}」でした。`);
      updatedLives = lives - 1;
      setLives(updatedLives);
    }

    // ⭐ setTimeout はここだけ
    setTimeout(() => {
      // 💀 ゲームオーバー または ✨ 全問終了
      if (updatedLives <= 0 || currentQuestionIndex >= quizData.length - 1) {
        setScreenMode('nameInput'); // 名前入力画面へ
        return;
      }
      // 次の問題へ
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setResult(null);
    }, 1500);
  };

  // ランキングに登録する関数
  const registerRanking = (e) => {
    e.preventDefault();
    const finalName = inputName.trim() || "名無しさん";

    const prevRanking = JSON.parse(localStorage.getItem(RANKING_KEY)) || [];
    const newEntry = { name: finalName, score: score };
    const newRanking = [...prevRanking, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    localStorage.setItem(RANKING_KEY, JSON.stringify(newRanking));
    setRanking(newRanking);
    setScreenMode('ranking'); // ランキング表示へ
  };

  // クイズの表示

  // --- 表示の切り分け ---

  // 1. ログインしていない時
  if (!token) {
    return (
      <div className="App">
        <h1>ITでGo！ - ログイン</h1>
        <form onSubmit={handleLogin}>
          <div>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit">ログイン</button>
        </form>
        <p style={{ fontSize: '0.8rem', color: '#666' }}>
          ※テスト用: test@example.com / password123
        </p>
      </div>
    );
  }

  //2. ログインしているけれど、データを読み込み中の時
  if (isLoading) {
    return <div className="App"><h1>ITでGo！</h1><p>問題を読み込み中です...</p></div>;
  }

  // 3. ログインしていて、読み込みも終わったが、問題が0件の時
  if (quizData.length === 0) {
    return <div className="App"><h1>ITでGo！</h1><p>現在、出題できる問題がありません。</p></div>;
  }

  // 1. 名前入力画面
  if (screenMode === 'nameInput') {
    return (
      <div className="App">
        <h1>ゲーム終了！</h1>
        <p>あなたのスコア: {score} pt</p>
        <form onSubmit={registerRanking}>
          <p>ランキングに登録する名前を入力してください</p>
          <input
            type="text"
            value={inputName}
            onChange={(e) => setInputName(e.target.value)}
            placeholder="名前を入力"
            required
            autoFocus
          />
          <button type="submit">ランキングを見る</button>
        </form>
      </div>
    );
  }

  // 2. ランキング表示画面
  if (screenMode === 'ranking') {
    return (
      <div className="ranking-container">
        <h1 className="ranking-title">🏆 TOP RANKERS</h1>
        <div className="current-player-card">
          <p>YOUR SCORE: <span className="highlight">{score}</span> pt</p>
        </div>
        <div className="ranking-board">
          {ranking.map((entry, index) => (
            <div key={index} className={`ranking-item rank-${index + 1}`}>
              <span className="rank-number">{index + 1}</span>
              <span className="rank-name">{entry.name}</span>
              <span className="rank-score">{entry.score} pt</span>
            </div>
          ))}
        </div>
        <button className="retry-button" onClick={() => window.location.reload()}>
          PLAY AGAIN
        </button>
      </div>
    );
  }

  // 3. ログイン済み ＆ クイズ表示
  return (
    <div className="App">
      <div style={{ textAlign: 'right' }}>
        <button onClick={handleLogout}>ログアウト</button>
      </div>
      <h1>ITでGo！</h1>
      {/* 問題番号の表示 */}
      <p>問題 **{currentQuestionIndex + 1} / {quizData.length}**</p>
      <p>🎯 スコア: {score} pt</p> {/* ⭐ スコア表示 */}

      {/* データベースから取得した問題文を表示 */}
      <p className="question-text">{currentQuestion.question}</p>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="答えを入力"
          disabled={result !== null}
        />
        <button type="submit" disabled={result !== null}>
          {result ? '処理中...' : '送信'}
        </button>
      </form>
      {result && <p className="result-message">{result}</p>}
    </div>
  );
}

export default App;