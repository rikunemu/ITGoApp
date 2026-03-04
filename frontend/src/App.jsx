import { useState, useEffect } from 'react';
import './App.css';

// 1. ベースURLを取得（末尾の / は除去する）
const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, "");

// 2. 常に /api をベースにする
const API_BASE = `${cleanBaseUrl}/api`;

// 3. 各エンドポイントを組み立て
const API_URL = `${API_BASE}/questions`;
const LOGIN_URL = `${API_BASE}/login`;
const REGISTER_URL = `${API_BASE}/register`;
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
  // 登録フォーム用
  const [isRegistering, setIsRegistering] = useState(false);
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [registerMessage, setRegisterMessage] = useState(''); 

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
  // ⭐ スコア管理用
  const [score, setScore] = useState(0); 
  // 残機機能（3つ間違えたら終了）
  const [lives, setLives] = useState(3);
  // ⏱️ タイムリミット機能（残り秒数）
  const [timeLeft, setTimeLeft] = useState(10);
  // タイムアップフラグ
  const [isTimeUp, setIsTimeUp] = useState(false);
  // ゲーム開始フラグ（ホームページ → クイズへの遷移用）
  const [gameStarted, setGameStarted] = useState(false);
  // ゲームモード（itpassport, basic, applied）
  const [gameMode, setGameMode] = useState(null);

  // ランキング関連の状態
  const [ranking, setRanking] = useState([]);
  const [screenMode, setScreenMode] = useState('quiz'); // 'quiz', 'nameInput', 'ranking'
  const [inputName, setInputName] = useState('');


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

  const handleRegister = async (e) => {
    e.preventDefault();
    console.log("--- 新規登録処理開始 ---");

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(LOGIN_URL.replace('/login', '/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          password,
          passwordConfirm
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();
      console.log("サーバーからのデータ:", data);

      if (!response.ok) {
        setRegisterMessage(data.error || '登録に失敗しました');
        return;
      }

      setRegisterMessage('登録完了しました！ログイン画面に切り替わります。');
      setEmail('');
      setPassword('');
      setPasswordConfirm('');
      
      // 1秒後にログイン画面に戻す
      setTimeout(() => {
        setIsRegistering(false);
        setRegisterMessage('');
      }, 2000);

    } catch (error) {
      console.error("❌ Fetchエラーの詳細:", error.name, error.message);
      if (error.name === 'AbortError') {
        setRegisterMessage("サーバーから応答がありません（タイムアウト）");
      } else {
        setRegisterMessage("通信エラー: " + error.message);
      }
    }
  };

//   // --- ログイン処理 ---
// const handleLogin = async (e) => {
//   e.preventDefault();
//   console.log("ログインボタンが押されました"); // ← 1. これが出るか？

//   try {
//     console.log("サーバーへ通信を開始します...", { email, password }); // ← 2. これが出るか？
    
//     const response = await fetch(LOGIN_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ email, password }),
//     });

//     console.log("サーバーから応答がありました:", response.status); // ← 3. ステータスコードを確認

//     const data = await response.json();
    
//     if (response.ok) {
//       console.log("ログイン成功！トークン:", data.token);
//       localStorage.setItem('token', data.token);
//       setToken(data.token);
//     } else {
//       console.error("ログイン失敗:", data.error);
//       alert(data.error);
//     }
//   } catch (error) {
//     console.error("通信エラーが発生しました:", error); // ← 4. ネットワークエラーなど
//     alert("サーバーに接続できませんでした");
//   }
// };

  // --- ゲームリセット関数 ---
  const resetGame = () => {
    setScore(0);
    setLives(3);
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setResult(null);
    setTimeLeft(10);
    setIsTimeUp(false);
    setGameStarted(false);
    setGameMode(null);
    setQuizData([]);
    setScreenMode('quiz');
    setInputName('');
  };

  // --- ログアウト処理 ---
  const handleLogout = () => {
    resetGame();
    localStorage.removeItem('token');
    setToken(null);
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

  // --- データ取得 ---
  useEffect(() => {
  console.log("useEffectが実行されました。現在のtoken:", token, "gameMode:", gameMode);

  const fetchQuiz = async () => {
    // 1. トークンがない場合または、ゲームモードがまだ選択されていない場合
    if (!token || !gameMode) {
      console.log("トークンがないか、ゲームモードがまだ選択されていないため、読み込みを終了します。");
      setIsLoading(false);
      return;
    }

    // 2. トークンがある場合、データを取得
    try {
      console.log("APIからデータを取得します（モード: ${gameMode}）...");
      const response = await fetch(`${API_URL}?mode=${gameMode}`);
      
      if (!response.ok) {
        throw new Error(`サーバーエラー: ${response.status}`);
      }

      const data = await response.json();
      console.log("取得データ:", data);
      setQuizData(shuffleArray(data));
    } catch (err) {
      console.error("フェッチエラー:", err);
      setResult("データの取得に失敗しました。");
    } finally {
      console.log("読み込み完了（setIsLoading(false)を実行）");
      setIsLoading(false);
    }
  };

  fetchQuiz();
}, [token, gameMode]);

  // ⏱️ タイムリミット機能（10秒のカウントダウン）
  useEffect(() => {
    // ログインしていない、読み込み中、結果表示中、またはタイムアップしたらタイマーを開始しない
    if (!token || isLoading || result !== null || quizData.length === 0 || isTimeUp) {
      return;
    }

    // 残り時間が0以下になったらタイムアップ処理
    if (timeLeft <= 0) {
      setIsTimeUp(true);
      handleTimeUp();
      return;
    }

    // 1秒ごとにカウントダウン
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    // クリーンアップ：コンポーネントアンマウント時またはdependencyが変わった時にタイマー停止
    return () => clearInterval(timer);
  }, [timeLeft, token, isLoading, result, quizData.length, isTimeUp]);

  // 問題が変わったときにタイマーをリセット
  useEffect(() => {
    setTimeLeft(10);
    setIsTimeUp(false);
  }, [currentQuestionIndex, token]);

  // タイムアップ時の処理
  const handleTimeUp = () => {
    setResult('⏰ 時間切れです！不正解になりました。');
    let updatedLives = lives - 1;
    setLives(updatedLives);

    setTimeout(() => {
      // 3回間違えたら終了
      if (updatedLives <= 0) {
        setResult('💀3問間違えたので終了します💀');
        // 2秒後にランキング画面へ
        setTimeout(() => {
          setScreenMode('nameInput');
        }, 2000);
        return;
      }

      // 次の問題へ
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setUserAnswer('');
        setResult(null);
      } else {
        setResult('✨全問終了です！✨');
        // 2秒後にランキング画面へ
        setTimeout(() => {
          setScreenMode('nameInput');
        }, 2000);
      }
    }, 1500);
  };


  const handleSubmit = (e) => {
    e.preventDefault();

    if (!currentQuestion || isTimeUp) return; 

    // ⏱️ 回答時にタイマーを停止
    setTimeLeft(0);
    setIsTimeUp(true);

    // 正解の判定（大文字小文字を区別しない、前後の空白を除去）
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.toLowerCase();
  
    let updatedLives = lives;
  
    if (isCorrect) {
      setResult('正解です！🎉');
      setScore((prev) => prev + 10);
    } else {
      setResult(`不正解です。正解は「${currentQuestion.correct_answer}」でした。`);
      updatedLives = lives - 1;
      setLives(updatedLives);
    }

    // setTimeout はここだけ
    setTimeout(() => {
      // ゲームオーバーまたは全問終了
      if (updatedLives <= 0 || currentQuestionIndex >= quizData.length - 1) {
        setScreenMode('nameInput');
        return;
      }

      // 次の問題へ
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setUserAnswer('');
        setResult(null);
      } else {
        setResult('✨全問終了です！✨');
      }
    }, 1500);
  };

  const handleOptionClick = (option) => {
    setUserAnswer(option);
  };

  //   if (isCorrect) {
  //     setResult('正解です！🎉');
  //     setScore((prev) => prev + 10); // ⭐ 正解時に10pt加算
  //   } else {
  //     setResult(`不正解です。正解は「${currentQuestion.correct_answer}」でした。`);
  //     // 不正解時にLivesを減らす
  //     setLives((prev) => prev - 1);
  //   }

  //   // 1.5秒後に次の問題へ進む（または終了）
  //   setTimeout(() => {
  //     if(lives === 0){
  //       setResult('💀3問間違えたので終了します💀');
  //     }else if(currentQuestionIndex < quizData.length - 1) {
  //       setCurrentQuestionIndex(currentQuestionIndex + 1);
  //       setUserAnswer('');
  //       setResult(null);
  //     } else {
  //       // 全問終了後の処理
  //       setResult('✨全問終了です！✨');
  //       //setScore(0); // ⭐ 全問終了時にスコアリセット
  //     }
  //   }, 1500);
  // };

  // if (isLoading) {
  //   return <div className="App"><h1>ITでGo！</h1><p>問題を読み込み中です...</p></div>;
  // }

  // if (quizData.length === 0 && !isLoading) {
  //    return <div className="App"><h1>ITでGo！</h1><p>現在、出題できる問題がありません。</p></div>;
  // }
  
  // クイズの表示

  // --- 表示の切り分け ---

  // 1. ログインしていない時
if (!token) {
  if (isRegistering) {
    // 新規登録画面
    return (
      <div className="App">
        <h1>ITでGo！ - 新規登録</h1>
        <form onSubmit={handleRegister}>
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
              placeholder="パスワード（6文字以上）" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          <div>
            <input 
              type="password" 
              placeholder="パスワード確認" 
              value={passwordConfirm} 
              onChange={(e) => setPasswordConfirm(e.target.value)} 
              required 
            />
          </div>
          <button type="submit">登録する</button>
        </form>
        {registerMessage && (
          <p style={{
            marginTop: '15px',
            padding: '10px',
            borderRadius: '5px',
            backgroundColor: registerMessage.includes('完了') ? '#e8f5e9' : '#ffebee',
            color: registerMessage.includes('完了') ? '#2e7d32' : '#c62828'
          }}>
            {registerMessage}
          </p>
        )}
        <p style={{fontSize: '0.85rem', color: '#666', marginTop: '15px'}}>
          ログイン済みの方は
          <button 
            type="button"
            onClick={() => setIsRegistering(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.85rem'
            }}
          >
            こちら
          </button>
        </p>
      </div>
    );
  } else {
    // ログイン画面
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
        <p style={{fontSize: '0.85rem', color: '#666', marginTop: '15px'}}>
          新規会員登録は
          <button 
            type="button"
            onClick={() => setIsRegistering(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '0.85rem'
            }}
          >
            こちら
          </button>
        </p>
      </div>
    );
  }
}

// 2. ログイン済みだがゲームモードがまだ選択されていない時（モード選択画面）
if (!gameMode) {
  return (
    <div className="App">
      <div className="home-header">
        <h1>🎓 ITでGo！</h1>
        <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
      </div>
      <div className="home-content">
        <p>学習する試験を選択してください</p>
        <div className="modes-container">
          <button 
            className="mode-button itpassport-btn"
            onClick={() => {
              setGameMode('itpassport');
              setGameStarted(true);
            }}
          >
            <div className="mode-title">🎫 ITパスポート</div>
            <div className="mode-description">IT基礎知識試験</div>
          </button>
          <button 
            className="mode-button basic-btn"
            onClick={() => {
              setGameMode('basic');
              setGameStarted(true);
            }}
          >
            <div className="mode-title">💼 基本情報技術者試験</div>
            <div className="mode-description">IT専門知識試験</div>
          </button>
          <button 
            className="mode-button applied-btn"
            onClick={() => {
              setGameMode('applied');
              setGameStarted(true);
            }}
          >
            <div className="mode-title">🚀 応用情報技術者試験</div>
            <div className="mode-description">高度なIT技術試験</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// 3. ゲーム開始済みだが、データを読み込み中の時
if (isLoading) {
  return <div className="App"><div className="loading-message"><h1>ITでGo！</h1><p>問題を読み込み中です...</p></div></div>;
}

// 4. ゲーム開始済みで、読み込みも終わったが、問題が0件の時
if (quizData.length === 0) {
  return <div className="App"><div className="loading-message"><h1>ITでGo！</h1><p>現在、出題できる問題がありません。</p></div></div>;
}

// 5. 名前入力画面
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

// 6. ランキング表示画面
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

  // 7. ゲーム開始済み ＆ クイズ表示
  const currentQuestion = quizData[currentQuestionIndex];
  const progressPercentage = ((currentQuestionIndex + 1) / quizData.length) * 100;
  const timerColor = timeLeft <= 3 ? 'danger' : '';

  return (
    <div className="App">
      <div className="quiz-header">
        <div className="quiz-info">
          <div className="info-item">
            <div className="info-label">問題</div>
            <div className="info-value">{currentQuestionIndex + 1}/{quizData.length}</div>
          </div>
          <div className="info-item score-item">
            <div className="info-label">スコア</div>
            <div className="info-value">{score} pt</div>
          </div>
          <div className="info-item lives-item">
            <div className="info-label">残機</div>
            <div className="info-value">❤️ {lives}</div>
          </div>
          <div className="info-item timer-item">
            <div className="info-label">残り時間</div>
            <div className={`info-value ${timerColor}`}>{timeLeft}秒</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
      </div>

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progressPercentage}%` }}></div>
      </div>

      <div className="question-card">
        <p className="question-text">{currentQuestion.question}</p>
      </div>

      <div className="options-container">
        {currentQuestion.options && currentQuestion.options.map((option, index) => (
          <button
            key={index}
            className={`option-button ${userAnswer === option ? 'selected' : ''} ${result !== null ? 'disabled' : ''}`}
            onClick={() => handleOptionClick(option)}
            disabled={result !== null || isTimeUp}
          >
            {String.fromCharCode(65 + index)}. {option}
          </button>
        ))}
      </div>

      <button 
        className="submit-button" 
        onClick={handleSubmit}
        disabled={result !== null || isTimeUp || !userAnswer}
        style={{ width: '100%', marginTop: '20px' }}
      >
        {result ? '処理中...' : '回答する'}
      </button>

      {result && (
        <p className={`result-message ${result.includes('正解') ? 'correct' : result.includes('時間') || result.includes('終了') ? 'neutral' : 'incorrect'}`}>
          {result}
        </p>
      )}
    </div>
  );

  // return (
  //   <div className="App">
  //     <h1>ITでGo！</h1>
  //     {/* 問題番号の表示 */}
  //     <p>問題 **{currentQuestionIndex + 1} / {quizData.length}**</p>

  //     {/* データベースから取得した問題文を表示 */}
  //     <p className="question-text">{currentQuestion.question}</p>

  //     <form onSubmit={handleSubmit}>
  //       <input
  //         type="text"
  //         value={userAnswer}
  //         onChange={(e) => setUserAnswer(e.target.value)}
  //         placeholder="答えを入力"
  //         disabled={result !== null}
  //       />
  //       <button type="submit" disabled={result !== null}>
  //         {result ? '処理中...' : '送信'}
  //       </button>
  //     </form>
  //     {/* CSSでスタイルを適用するためのクラスを追加 */}
  //     {result && <p className={`result-message ${result.includes('正解') ? 'correct' : 'incorrect'}`}>{result}</p>}
  //   </div>
  // );
}

export default App;