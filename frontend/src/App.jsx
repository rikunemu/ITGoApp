import { useState } from 'react';
import './App.css';

// 1. 問題データを配列で定義
const quizData = [
  { q: '「漢字」の読みをひらがなで答えてください', a: 'かんじ' },
  { q: '「山脈」の読みをひらがなで答えてください', a: 'さんみゃく' },
  { q: '「綻び」の読みをひらがなで答えてください', a: 'ほころび' },
  { q: '「溺愛」の読みをひらがなで答えてください', a: 'できあい' },
  { q: '「酪農」の読みをひらがなで答えてください', a: 'らくのう' },
  { q: '「憤り」の読みをひらがなで答えてください', a: 'いきどおり' },
  { q: '「頻発」の読みをひらがなで答えてください', a: 'ひんぱつ' },
  { q: '「顕著」の読みをひらがなで答えてください', a: 'けんちょ' },
  { q: '「会釈」の読みをひらがなで答えてください', a: 'えしゃく' },
  { q: '「威嚇」の読みをひらがなで答えてください', a: 'いかく' },
];

function App() {
  // 2. 現在の何問目かを管理するステートを追加
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);

  // 現在の問題と正解を取得
  const currentQuestion = quizData[currentIndex];
  // const question = '「漢字」の読みをひらがなで答えてください';
  // const correctAnswer = 'かんじ';


  const handleSubmit = (e) => {
    e.preventDefault();
    if (userAnswer.trim() === currentQuestion.a) {
      setResult('正解です！🎉');
    } else {
      setResult('不正解です。もう一度挑戦してみましょう。');
    }
  };

  // 3.次の問題へ進む処理
  const nextQuestion = () => {
    setResult(null);
    setUserAnswer('');
    setCurrentIndex((prev) => prev + 1);
  }

  // 全問終了したかチェック
  const isFinished = currentIndex >= quizData.length;

  return (
<div className="App">
      <h1>ITでGo！</h1>

      {isFinished ? (
        <div>
          <h2>全問終了！お疲れ様でした。</h2>
          <button onClick={() => setCurrentIndex(0)}>最初から解き直す</button>
        </div>
      ) : (
        <>
          <p>第 {currentIndex + 1} 問</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{currentQuestion.q}</p>
          
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="答えを入力"
              disabled={result === '正解です！🎉'} // 正解したら入力不可にする
            />
            <button type="submit">送信</button>
          </form>

          {result && (
            <div style={{ marginTop: '20px' }}>
              <p>{result}</p>
              {/* 正解した時だけ「次へ」ボタンを表示 */}
              {result === '正解です！🎉' && (
                <button onClick={nextQuestion}>次の問題へ</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;