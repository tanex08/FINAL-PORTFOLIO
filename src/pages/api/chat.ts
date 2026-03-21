import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing GEMINI_API_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let message = '';
  const urlMessage = new URL(request.url).searchParams.get('message');
  if (urlMessage) message = urlMessage;
  try {
    const raw = await request.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { message?: string };
        message = parsed?.message || '';
      } catch {
        const params = new URLSearchParams(raw);
        message = params.get('message') || params.get('text') || '';
      }
    }
  } catch {
    message = '';
  }

  message = message.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const systemPrompt =
    'You are Tristan\'s portfolio assistant. Be friendly, concise, and helpful. Focus on Tristan\'s AI, full-stack, and computer vision work. If asked about contact, share gaid.tristan123@gmail.com and Discord @Tanex112.';

  const modelName = (import.meta.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const endpoint =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(modelName) +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  const geminiPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: systemPrompt + '\nUser: ' + message }]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 280
    }
  };

  try {
    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload)
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      const status = geminiRes.status === 429 ? 429 : 502;
      return new Response(
        JSON.stringify({
          error: geminiRes.status === 429 ? 'Quota exceeded' : 'Gemini error',
          detail: errorText,
          model: modelName
        }),
        {
          status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry, I could not generate a response.';

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Request failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
