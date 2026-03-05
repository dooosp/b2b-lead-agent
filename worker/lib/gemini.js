export async function callGemini(prompt, env, options = {}) {
  if (!env || !env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');
  }

  const generationConfig = {};
  if (typeof options.temperature === 'number') generationConfig.temperature = options.temperature;
  if (typeof options.topP === 'number') generationConfig.topP = options.topP;
  if (typeof options.maxOutputTokens === 'number') generationConfig.maxOutputTokens = options.maxOutputTokens;

  const requestBody = {
    contents: [{ parts: [{ text: String(prompt || '') }] }]
  };
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(requestBody)
      }
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    return data.candidates[0].content.parts[0].text;
  }
  throw new Error('응답 형식 오류: ' + JSON.stringify(data).slice(0, 200));
}
