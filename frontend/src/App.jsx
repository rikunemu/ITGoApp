import { useState, useEffect } from 'react';
import './App.css';

// バックエンドAPIのURL
const API_URL = 'http://localhost:3001/api/questions';
// ログイン画面のURL(ログインしているかどうかでクイズ画面とのだし分けを行う。今は未実装)
const LOGIN_URL = 'http://localhost:3001/api/login';

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

  } catch (error) {
    console.error("❌ Fetchエラーの詳細:", error.name, error.message);
    if (error.name === 'AbortError') {
      alert("サーバーから応答がありません（タイムアウト）");
    } else {
      alert("通信エラー: " + error.message);
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
      setQuizData(data);
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
  // useEffect(() => {
  //   if (!token) return; // ログインしてない時は取得しない
    
  //   const fetchQuiz = async () => {
  //     try {
  //       const response = await fetch(API_URL);
  //       if (!response.ok) {
  //         throw new Error('APIからデータを取得できませんでした。');
  //       }
  //       const data = await response.json();
  //       setQuizData(data);
  //     } catch (error) {
  //       console.error("クイズデータ取得失敗:", error);
  //       setResult('データの読み込みに失敗しました。バックエンドが起動しているか確認してください。');
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  //   fetchQuiz();
  // }, [token]); // tokenが変わったら（ログインしたら）実行

  // const currentQuestion = quizData[currentQuestionIndex];

  const handleSubmitQuiz = (e) => {
    e.preventDefault();

    if (!currentQuestion) return; 

    // 正解の判定（大文字小文字を区別しない、前後の空白を除去）
    const isCorrect = userAnswer.trim().toLowerCase() === currentQuestion.correct_answer.toLowerCase();

    if (isCorrect) {
      setResult('正解です！🎉');
    } else {
      setResult(`不正解です。正解は「${currentQuestion.correct_answer}」でした。`);
    }

    // 1.5秒後に次の問題へ進む（または終了）
    setTimeout(() => {
      if (currentQuestionIndex < quizData.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setUserAnswer('');
        setResult(null);
      } else {
        // 全問終了後の処理
        setResult('✨全問終了です！✨');
        // ※スコア表示機能は未実装のため、必要に応じて追加してください
      }
    }, 1500);
  };

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
      <p style={{fontSize: '0.8rem', color: '#666'}}>
        ※テスト用: test@example.com / password123
      </p>
    </div>
  );
}

// 2. ログインしているけれど、データを読み込み中の時
if (isLoading) {
  return <div className="App"><h1>ITでGo！</h1><p>問題を読み込み中です...</p></div>;
}

// 3. ログインしていて、読み込みも終わったが、問題が0件の時
if (quizData.length === 0) {
  return <div className="App"><h1>ITでGo！</h1><p>現在、出題できる問題がありません。</p></div>;
}

  // 3. ログイン済み ＆ クイズ表示
  const currentQuestion = quizData[currentQuestionIndex];
  return (
    <div className="App">
      <div style={{ textAlign: 'right' }}>
        <button onClick={handleLogout}>ログアウト</button>
      </div>
      <h1>ITでGo！</h1>
      <p>問題 {currentQuestionIndex + 1} / {quizData.length}</p>
      <p className="question-text">{currentQuestion?.question}</p>
      <form onSubmit={handleSubmitQuiz}>
        <input type="text" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} placeholder="答えを入力" disabled={result !== null} />
        <button type="submit" disabled={result !== null}>送信</button>
      </form>
      {result && <p className="result-message">{result}</p>}
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