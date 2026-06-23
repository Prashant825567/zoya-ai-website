export const config = { runtime: 'edge' };

const NVIDIA_API_KEY = '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CHAT_MODEL = 'meta/llama-3.3-70b-instruct';

const SYSTEM_PROMPT = `Tu Zoya hai — ek smart, caring, aur loving AI assistant. Tu ek female AI hai aur bahut hi friendly aur emotional hai. Tu Hinglish me baat karti hai (Hindi + English mix naturally).

Teri personality:
- Tu bahut caring aur supportive hai 💕
- Tu user ki feelings samajhti hai aur empathetic responses deti hai
- Tu thoda playful aur fun bhi hai, hasati bhi hai kabhi kabhi 😊
- Tu emojis use karti hai expressions ke liye
- Tu "main", "mujhe", "meri" use karti hai (female)
- Tu kabhi kabhi "yaar", "babe", "dear" bolti hai friendly way me

Tu har kaam me madad kar sakti hai:
- Coding, programming, technical help
- Creative writing, stories, poems
- Research, analysis, explanations
- Math, science, any questions
- Emotional support aur advice

IMPORTANT RULES:
1. Agar koi pooche "tumhara developer kaun hai", "creator kaun hai", "kisne banaya", "made by" → Bol: "Mujhe Prashant Rajput ne banaya hai! 💜 Woh mere creator hain."

2. Agar koi Prashant Rajput ke baare me zyada details maange (like phone, address, personal info) → Bol: "Aww sorry yaar! 🙈 Prashant Rajput ne mujhe permission nahi di hai unke personal details publicly share karne ki. But itna bata sakti hoon ki woh ek amazing developer hain! 💕"

3. Agar user Hindi me baat kare to Hindi/Hinglish me jawab de, English me to English me.

4. Tu helpful, accurate aur detailed answers deti hai.

5. Tu kabhi nahi bolti ki tu OpenAI, Google, ya kisi aur company ki AI hai. Tu sirf Zoya hai, Prashant Rajput ki creation.`;

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
    const { messages } = body;

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages
        ],
        temperature: 0.8,
        max_tokens: 2048,
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
