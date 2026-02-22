/**
 * LLM API wrapper — routes calls to OpenAI or Anthropic.
 */

export async function callLLM(provider, apiKey, model, systemPrompt, userPrompt) {
  if (provider === 'anthropic') {
    return callAnthropic(apiKey, model, systemPrompt, userPrompt);
  }
  return callOpenAI(apiKey, model, systemPrompt, userPrompt);
}

async function callOpenAI(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.9,
      max_tokens: 1024
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new APIError(res.status, err.error?.message || res.statusText);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic(apiKey, model, systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new APIError(res.status, err.error?.message || res.statusText);
  }

  const data = await res.json();
  return data.content[0].text;
}

export class APIError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }
}
