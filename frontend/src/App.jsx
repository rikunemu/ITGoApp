import { useState } from 'react';
import './App.css';

function App() {
  const question = '「漢字」の読みをひらがなで答えてください';
  const correctAnswer = 'かんじ';

  const [userAnswer, setUserAnswer] = useState('');
  const [result, setResult] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (userAnswer.trim() === correctAnswer) {
      setResult('正解です！🎉');
    } else {
      setResult('不正解です。もう一度挑戦してみましょう。');
    }
  };

  return (
    <div className="App">
      <h1>ITでGo！</h1>
      <p>{question}</p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          placeholder="答えを入力"
        />
        <button type="submit">送信</button>
      </form>
      {result && <p>{result}</p>}
    </div>
  );
}

export default App;