import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as Speech from 'expo-speech';

// DeepL API 키를 앱에 두지 않기 위해, 클라이언트는 이 Vercel 프록시만 호출한다.
const TRANSLATE_API_URL = 'https://eng-study-virid.vercel.app/api/translate';

// 응답이 아예 없거나(타임아웃) 에러 상태(404/429/500 등)일 때, 흰 화면이나
// 무한 로딩 대신 보여줄 로컬 백업 명언. 원문+번역이 세트로 이미 준비되어 있어서
// 번역 API를 다시 호출할 필요가 없다.
const BACKUP_QUOTES = [
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

const REQUEST_TIMEOUT_MS = 5000;

// fetch에는 기본 타임아웃이 없어서, AbortController로 일정 시간 뒤 요청을 직접 취소한다.
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

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
  const [quote, setQuote] = useState(null); // { id, quote, author, isBackup } | null
  const [isLoading, setIsLoading] = useState(true);
  const [showRetry, setShowRetry] = useState(false);
  const [translation, setTranslation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isMemorizing, setIsMemorizing] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [result, setResult] = useState(null); // null | 'correct' | 'wrong'
  const [inputError, setInputError] = useState(null);

  // 화면이 처음 뜰 때 명언을 한 번 가져온다.
  useEffect(() => {
    loadRandomQuote();
  }, []);

  // 명언 하나를 로컬 백업 목록에서 무작위로 골라 화면에 채운다.
  // DummyJSON/번역 프록시 중 무엇이 실패하든 이 함수 하나로 흰 화면 없이 복구한다.
  function useBackupQuote() {
    const backup = BACKUP_QUOTES[Math.floor(Math.random() * BACKUP_QUOTES.length)];
    setQuote({ ...backup, isBackup: true });
    setTranslation(backup.translation);
    setIsTranslating(false);
    setIsMemorizing(false);
    setUserInput('');
    setResult(null);
    setInputError(null);
    setShowRetry(true);
  }

  // excludeId를 주면, 방금 본 명언과 같은 id가 나왔을 때 최대 2번까지
  // 다시 요청해서 되도록 다른 명언이 나오도록 한다.
  async function loadRandomQuote(excludeId) {
    setIsLoading(true);
    setShowRetry(false);

    try {
      let data = null;
      let attempts = 0;
      const maxAttempts = 3; // 최초 1회 + 중복일 때 최대 2회 재시도

      while (attempts < maxAttempts) {
        const response = await fetchWithTimeout('https://dummyjson.com/quotes/random');

        // fetch는 404/500처럼 서버가 에러를 응답해도 실패로 취급하지 않기 때문에,
        // response.ok를 직접 확인해야 진짜 성공/실패를 구분할 수 있다.
        if (!response.ok) {
          throw new Error(`요청 실패 (상태 코드: ${response.status})`);
        }

        data = await response.json();
        attempts += 1;

        if (!excludeId || data.id !== excludeId) {
          break;
        }
      }

      setQuote({ ...data, isBackup: false });
      setIsMemorizing(false);
      setUserInput('');
      setResult(null);
      setInputError(null);
      // 명언 표시는 번역을 기다리지 않고 바로 하고, 번역은 별도로 이어서 불러온다.
      fetchTranslation(data.quote);
    } catch (err) {
      console.log('명언 불러오기 실패(타임아웃 포함):', err);
      useBackupQuote();
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTranslation(text) {
    setIsTranslating(true);
    setTranslation('');

    try {
      // 영어 문장에 아포스트로피(') 같은 특수문자가 섞여 있으면 URL이 깨질 수 있어서,
      // 쿼리 파라미터에 넣기 전에 encodeURIComponent로 안전하게 인코딩한다.
      const response = await fetchWithTimeout(
        `${TRANSLATE_API_URL}?text=${encodeURIComponent(text)}`
      );

      if (!response.ok) {
        throw new Error(`번역 요청 실패 (상태 코드: ${response.status})`);
      }

      const data = await response.json();
      setTranslation(data.translated ?? '');
    } catch (err) {
      console.log('번역 불러오기 실패(타임아웃 포함):', err);
      // 원문만 있고 번역이 없는 어중간한 상태로 두지 않도록, 원문+번역이 짝지어진
      // 백업 명언으로 통째로 교체한다.
      useBackupQuote();
    } finally {
      setIsTranslating(false);
    }
  }

  function handleNextQuote() {
    loadRandomQuote(quote?.id);
  }

  function handleRetry() {
    loadRandomQuote();
  }

  async function handleListen() {
    if (!quote) {
      return;
    }

    const voices = await Speech.getAvailableVoicesAsync();

    // en-US를 가장 우선으로 찾고, 없으면 en-GB/en-AU처럼 "en"으로 시작하는
    // 아무 영어 음성이나 찾아서 대체 재생한다.
    const voice =
      voices.find((v) => v.language === 'en-US') ||
      voices.find((v) => v.language?.startsWith('en'));

    if (!voice) {
      Alert.alert('알림', '이 기기에서는 음성 재생을 지원하지 않습니다.');
      return;
    }

    Speech.speak(quote.quote, {
      voice: voice.identifier,
      language: voice.language,
    });
  }

  function handleStartMemorize() {
    setIsMemorizing(true);
    setUserInput('');
    setResult(null);
    setInputError(null);
  }

  function handleCheckAnswer() {
    if (!userInput.trim()) {
      setInputError('먼저 입력해주세요');
      setResult(null);
      return;
    }

    setInputError(null);
    const isCorrect = normalize(userInput) === normalize(quote.quote);
    setResult(isCorrect ? 'correct' : 'wrong');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>오늘의 명언</Text>

      <View style={styles.content}>
        <View style={styles.card}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#4a4a4a" />
          ) : (
            <>
              <Text style={styles.author}>- {quote.author}</Text>

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
                  {inputError ? (
                    <Text style={styles.wrong}>{inputError}</Text>
                  ) : (
                    result && (
                      <Text style={result === 'correct' ? styles.correct : styles.wrong}>
                        {result === 'correct' ? '정답!' : '다시 도전해보세요'}
                      </Text>
                    )
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.quote}>{quote.quote}</Text>
                  <Text style={styles.translation}>
                    {isTranslating ? '번역 중...' : translation}
                  </Text>
                </>
              )}

              {quote.isBackup && (
                <View style={styles.noticeBox}>
                  <Text style={styles.noticeText}>
                    네트워크 문제로 저장된 명언을 보여드리고 있어요.
                  </Text>
                  {showRetry && (
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                      <Text style={styles.retryButtonText}>다시 시도</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={handleListen}>
          <Text style={styles.buttonText}>듣기</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleStartMemorize}>
          <Text style={styles.buttonText}>외워서 써보기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleNextQuote}
          disabled={isLoading}
        >
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
  noticeBox: {
    marginTop: 20,
    alignItems: 'center',
  },
  noticeText: {
    fontSize: 12,
    color: '#c62828',
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#c62828',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
  },
});
