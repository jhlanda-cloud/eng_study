// RN 앱은 DeepL을 직접 호출하지 않는다. 이 서버리스 함수가 대신 호출해주고
// DeepL API 키는 여기(서버, Vercel 환경변수)에만 존재한다 — 클라이언트 코드에는 절대 노출되지 않는다.
// (Root Directory=server 설정이 확실히 반영된 새 배포를 트리거하기 위한 변경)
module.exports = async function handler(req, res) {
  // RN 앱(다른 origin)에서 이 API를 호출할 수 있도록 CORS 헤더를 열어준다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 브라우저/일부 클라이언트가 본 요청 전에 보내는 예비 요청(preflight)에는
  // 헤더만 응답하고 바로 끝낸다.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'GET 요청만 지원합니다.' });
    return;
  }

  const { text } = req.query;
  if (!text) {
    res.status(400).json({ error: 'text 쿼리 파라미터가 필요합니다. 예: /api/translate?text=Hello' });
    return;
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: '서버에 DEEPL_API_KEY 환경변수가 설정되어 있지 않습니다.' });
    return;
  }

  // DeepL 무료 플랜 키는 ":fx"로 끝난다는 규칙이 있어서, 키 형태만 보고
  // 무료/유료 엔드포인트를 자동으로 선택한다(사용자가 따로 설정할 필요 없음).
  const deeplUrl = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  try {
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', 'KO');

    const deeplResponse = await fetch(deeplUrl, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!deeplResponse.ok) {
      const detail = await deeplResponse.text();
      res.status(deeplResponse.status).json({ error: 'DeepL 번역 요청이 실패했습니다.', detail });
      return;
    }

    const data = await deeplResponse.json();
    const translated = data.translations?.[0]?.text ?? '';

    res.status(200).json({ original: text, translated });
  } catch (error) {
    res.status(500).json({ error: '번역 처리 중 서버 오류가 발생했습니다.', detail: error.message });
  }
};
