import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity } from 'react-native';

// 아직 실제 API를 연결하지 않았으므로, 화면부터 먼저 완성하기 위해
// 명언 3개를 하드코딩된 배열로 만들어둔다. (PRD 개발 순서 1단계)
const QUOTES = [
  {
    author: 'Abdul Kalam',
    quote: 'We must think and act like a nation of a billion people and not like that of a million people. Dream, dream, dream!',
    translation: '우리는 백만 명의 국민이 아니라 십억 명의 국민처럼 생각하고 행동해야 한다. 꿈꾸고, 꿈꾸고, 또 꿈꿔라!',
  },
  {
    author: 'Rumi',
    quote: 'Your heart is the size of an ocean. Go find yourself in its hidden depths.',
    translation: '당신의 마음은 바다만큼 넓다. 그 숨겨진 깊은 곳에서 자신을 찾아라.',
  },
  {
    author: 'Albert Einstein',
    quote: 'Life is like riding a bicycle. To keep your balance, you must keep moving.',
    translation: '삶은 자전거를 타는 것과 같다. 균형을 유지하려면 계속 움직여야 한다.',
  },
];

// 대소문자, 앞뒤 공백, 연속 공백, 문장부호 차이는 오타로 보지 않고 정답으로 인정하기 위해
// 비교 전에 문장을 같은 규칙으로 "다듬는다"(정규화).
function normalize(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:'"()]/g, '')
    .replace(/\s+/g, ' ');
}

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMemorizing, setIsMemorizing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'

  const currentQuote = QUOTES[currentIndex];

  function handleNextQuote() {
    // 명언이 바뀌면 이전 명언에서 외우던 입력값/결과는 의미가 없으니 함께 초기화한다.
    setCurrentIndex((prev) => (prev + 1) % QUOTES.length);
    setIsMemorizing(false);
    setUserInput('');
    setResult(null);
  }

  function handleStartMemorize() {
    setIsMemorizing(true);
    setUserInput('');
    setResult(null);
  }

  function handleCheckAnswer() {
    const isCorrect = normalize(userInput) === normalize(currentQuote.quote);
    setResult(isCorrect ? 'correct' : 'wrong');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>오늘의 명언</Text>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.author}>- {currentQuote.author}</Text>

          {isMemorizing ? (
            // 외워서 써보기 중: 원문은 숨기고 입력창 + 확인 버튼만 보여준다.
            <>
              <TextInput
                style={styles.input}
                placeholder="명언을 입력해보세요"
                value={userInput}
                onChangeText={setUserInput}
                multiline
              />
              <TouchableOpacity style={styles.checkButton} onPress={handleCheckAnswer}>
                <Text style={styles.checkButtonText}>확인</Text>
              </TouchableOpacity>
              {result && (
                <Text style={result === 'correct' ? styles.correct : styles.wrong}>
                  {result === 'correct' ? '정답!' : '다시 도전해보세요'}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.quote}>{currentQuote.quote}</Text>
              <Text style={styles.translation}>{currentQuote.translation}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={() => {}}>
          <Text style={styles.buttonText}>듣기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleStartMemorize}>
          <Text style={styles.buttonText}>외워서 써보기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleNextQuote}>
          <Text style={styles.buttonText}>다른 명언 보기</Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  card: {
    alignItems: 'center',
    width: '100%',
  },
  author: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
  },
  quote: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  translation: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  input: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  checkButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#2e7d32',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  correct: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  wrong: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#c62828',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4a4a4a',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
  },
});
