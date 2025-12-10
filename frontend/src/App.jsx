import { useState } from 'react';
import './App.css';

// 1. 問題データを配列として定義
// アプリケーション全体で固定なので、コンポーネントの外で定義します。
const quizData = [
  { question: '「漢字」の読みをひらがなで答えてください', answer: 'かんじ' },
  { question: '「時計」の読みをひらがなで答えてください', answer: 'とけい' },
  { question: '「経済」の読みをひらがなで答えてください', answer: 'けいざい' },
  { question: '「旅行」の読みをひらがなで答えてください', answer: 'りょこう' },
  { question: '「天気」の読みをひらがなで答えてください', answer: 'てんき' },
  { question: '「明日」の読みをひらがなで答えてください', answer: 'あした' },
  { question: '「椅子」の読みをひらがなで答えてください', answer: 'いす' },
  { question: '「鉛筆」の読みをひらがなで答えてください', answer: 'えんぴつ' },
  { question: '「果物」の読みをひらがなで答えてください', answer: 'くだもの' },
  { question: '「小説」の読みをひらがなで答えてください', answer: 'しょうせつ' },
];

function App() {
  // 以前の userAnswer と result の状態
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState(null); // feedbackに名称を変更

  // 2. 新しい状態：現在の問題番号とスコア
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0); // 0から始まるインデックス
  const [score, setScore] = useState(0); // 正解数

  // 全体の問題数
  const totalQuestions = quizData.length;
  // 現在の問題が終了したかどうか
  const isQuizFinished = currentQuestionIndex === totalQuestions;

  // 現在表示すべき問題データ
  const currentQuiz = quizData[currentQuestionIndex];
  
  // Quizがまだ続いている場合のみ、問題文と正解を取得
  const questionText = currentQuiz ? currentQuiz.question : '';
  const correctAnswer = currentQuiz ? currentQuiz.answer : '';

  const handleSubmit = (e) => {
    e.preventDefault();

    // 既にクイズが終わっていたら何もしない
    if (isQuizFinished) return;

    // 回答チェック
    if (userAnswer.trim() === correctAnswer) {
      setFeedback('正解です！🎉');
      // スコアを加算
      setScore(score + 1);
    } else {
      setFeedback('不正解です。');
    }

    // 入力欄をクリア
    setUserAnswer('');

    // 3. 次の問題へ進む処理を、フィードバック表示のため1秒後に行う
    setTimeout(() => {
      // インデックスを一つ進める
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      // フィードバックをクリア
      setFeedback(null);
    }, 1000);
  };

  // 終了画面の表示
  if (isQuizFinished) {
    return (
      <div className="App">
        <h1>クイズ終了！</h1>
        <p>全{totalQuestions}問中、あなたのスコアは **{score} 問正解** でした！</p>
        <button onClick={() => {
          // リセット処理
          setCurrentQuestionIndex(0);
          setScore(0);
          setFeedback(null);
        }}>もう一度挑戦する</button>
      </div>
    );
  }

  // クイズ中の表示
  return (
    <div className="App">
      <h1>ITでGo！ (Q.{currentQuestionIndex + 1}/{totalQuestions})</h1> {/* 現在何問目かを表示 */}
      <p>{questionText}</p>
      
      {/* フォームは以前と同じ */}
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="答えを入力"
          // フィードバック表示中は入力できないようにする
          disabled={feedback !== null}
        />
        <button type="submit" disabled={feedback !== null}>送信</button>
      </form>
      
      {/* 回答のフィードバックを表示 */}
      {feedback && <p className={feedback.includes('正解') ? 'correct' : 'incorrect'}>{feedback}</p>}
      <p>現在の正解数: {score}</p>
    </div>
  );
}

export default App;