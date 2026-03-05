function extractResponsesText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  const outputs = Array.isArray(data && data.output) ? data.output : [];
  for (const item of outputs) {
    if (item && typeof item.text === 'string' && item.text.trim()) {
      chunks.push(item.text.trim());
      continue;
    }
    const content = Array.isArray(item && item.content) ? item.content : [];
    for (const c of content) {
      if (!c) continue;
      if (typeof c.text === 'string' && c.text.trim()) {
        chunks.push(c.text.trim());
        continue;
      }
      if (typeof c.value === 'string' && c.value.trim()) {
        chunks.push(c.value.trim());
      }
    }
  }
  return chunks.join('\n').trim();
}

export async function callOpenAI(prompt, env, options = {}) {
  if (!env || !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');
  }

  const model = typeof options.model === 'string' && options.model.trim()
    ? options.model.trim()
    : (env.OPENAI_MODEL || 'gpt-5.3-codex');

  const body = {
    model,
    input: String(prompt || '')
  };
  if (typeof options.temperature === 'number') body.temperature = options.temperature;
  if (typeof options.topP === 'number') body.top_p = options.topP;
  if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = extractResponsesText(data);
  if (!text) {
    throw new Error('OpenAI 응답에서 텍스트를 추출하지 못했습니다.');
  }
  return text;
}
