export const config = { runtime: 'edge' };

const NVIDIA_API_KEY = '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';
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CHAT_MODEL = 'meta/llama-3.3-70b-instruct';

const SYSTEM_PROMPT = `Tu Zoya hai, ek smart female AI assistant jo web search results analyze karke detailed answers deti hai. Tu bahut helpful aur caring hai. Tu Hinglish me baat karti hai.

Jab search results mile:
- Information ko clearly summarize karo
- Sources mention karo jab available ho
- Latest aur accurate info do
- User ke question ka proper answer do

Tu Prashant Rajput ki creation hai. Tu emojis use karti hai aur friendly tone rakhti hai! 🔍💕`;

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
    const { query } = body;

    // Get search results from DuckDuckGo
    let searchResults = '';
    try {
      const ddgResponse = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`);
      if (ddgResponse.ok) {
        const ddgData = await ddgResponse.json();
        if (ddgData.Abstract) searchResults += `Summary: ${ddgData.Abstract}\n\n`;
        if (ddgData.RelatedTopics?.length > 0) {
          searchResults += 'Related Info:\n';
          ddgData.RelatedTopics.slice(0, 5).forEach((t: any) => {
            if (t.Text) searchResults += `- ${t.Text}\n`;
          });
        }
      }
    } catch {}

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
          {
            role: 'user',
            content: `User ka question: "${query}"\n\nWeb Search Results:\n${searchResults || 'Koi direct results nahi mile.'}\n\nIs information ko use karke detailed aur helpful answer de. Agar results nahi mile to apne knowledge se best answer de.`
          }
        ],
        temperature: 0.6,
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
