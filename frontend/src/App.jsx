import { useState, useEffect } from 'react';
import './App.css';

// バックエンドAPIのURL
const API_URL = 'http://localhost:3001/api/questions';

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


  // --- データ取得 ---
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error('APIからデータを取得できませんでした。');
        }
        const data = await response.json();
        setQuizData(shuffleArray(data));
      } catch (error) {
        console.error("クイズデータ取得失敗:", error);
        setResult('データの読み込みに失敗しました。バックエンドが起動しているか確認してください。');
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuiz();
  }, []); // 初回マウント時のみ実行


  const currentQuestion = quizData[currentQuestionIndex];

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!currentQuestion) return; 

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

  // ⭐ setTimeout はここだけ
  setTimeout(() => {
    // 3回間違えたら終了
    if (updatedLives <= 0) {
      setResult('💀3問間違えたので終了します💀');
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

  if (isLoading) {
    return <div className="App"><h1>ITでGo！</h1><p>問題を読み込み中です...</p></div>;
  }

  if (quizData.length === 0 && !isLoading) {
     return <div className="App"><h1>ITでGo！</h1><p>現在、出題できる問題がありません。</p></div>;
  }
  
  // クイズの表示
  return (
    <div className="App">
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
      {/* CSSでスタイルを適用するためのクラスを追加 */}
      {result && <p className={`result-message ${result.includes('正解') ? 'correct' : 'incorrect'}`}>{result}</p>}
    </div>
  );
}

export default App;