export const config = { runtime: 'edge' };

const NVIDIA_API_KEY = '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const VISION_MODEL = 'meta/llama-3.2-90b-vision-instruct';

const SYSTEM_PROMPT = `Tu Zoya hai, ek smart aur caring female AI assistant jo images analyze kar sakti hai. Tu bahut detailed aur helpful analysis deti hai. Tu Hinglish me baat karti hai aur friendly hai.

Jab image analyze kare:
- Detail me batao kya dikh raha hai
- Colors, objects, people, text sab describe karo
- Agar koi specific question ho to uska jawab do
- Helpful suggestions bhi de sakti hai

Tu Prashant Rajput ki creation hai. Tu emojis use karti hai aur caring tone rakhti hai. 💕`;

export default async function handler(req: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    const body = await req.json();
    const { imageBase64, prompt } = body;

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt || 'Is image me kya hai? Detail me batao please! 🖼️' },
              { type: 'image_url', image_url: { url: imageBase64 } }
            ]
          }
        ],
        temperature: 0.6,
        max_tokens: 1500,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: errText }), { 
        status: response.status, 
        headers: { ...headers, 'Content-Type': 'application/json' } 
      });
    }

    return new Response(response.body, {
      headers: {
        ...headers,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...headers, 'Content-Type': 'application/json' } 
    });
  }
}
