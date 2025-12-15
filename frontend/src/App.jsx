import { useState, useEffect } from 'react';
import './App.css';

// バックエンドAPIのURL
const API_URL = 'http://localhost:3001/api/questions';

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

  // --- データ取得 ---
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error('APIからデータを取得できませんでした。');
        }
        const data = await response.json();
        setQuizData(data);
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