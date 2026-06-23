// ══════════════════════════════════════════════════════════════
// ZOYA AI - Smart API Services
// No manual mode switching - Zoya automatically detects intent!
// ══════════════════════════════════════════════════════════════

const API_BASE = '/api';
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';

// Cloudflare Worker for Image Editing
const CLOUDFLARE_WORKER_URL = 'https://image-api.pr3095079.workers.dev';
const CLOUDFLARE_API_KEY = 'noida123';

// ══════════════════════════════════════════════════════════════
// CHAT - NVIDIA Llama 3.3 70B
// ══════════════════════════════════════════════════════════════
export async function streamChat(
  messages: { role: string; content: string }[],
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `API Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader available');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {}
        }
      }
    }
    onDone();
  } catch (err: any) {
    onError(err.message || 'Chat error');
  }
}

// ══════════════════════════════════════════════════════════════
// VISION - NVIDIA Llama 3.2 90B Vision
// ══════════════════════════════════════════════════════════════
export async function analyzeImage(
  imageBase64: string,
  prompt: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  try {
    const response = await fetch(`${API_BASE}/vision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, prompt }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Vision Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {}
        }
      }
    }
    onDone();
  } catch (err: any) {
    onError(err.message || 'Vision error');
  }
}

// ══════════════════════════════════════════════════════════════
// WEB SEARCH - NVIDIA
// ══════════════════════════════════════════════════════════════
export async function webSearch(
  query: string,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void
) {
  try {
    const response = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Search Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No reader');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onDone();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) onChunk(content);
          } catch {}
        }
      }
    }
    onDone();
  } catch (err: any) {
    onError(err.message || 'Search error');
  }
}

// ══════════════════════════════════════════════════════════════
// IMAGE GENERATION - Pollinations (FREE)
// ══════════════════════════════════════════════════════════════
export function generateImageUrl(
  prompt: string,
  width: number = 1024,
  height: number = 1024
): string {
  const seed = Math.floor(Math.random() * 999999);
  const encodedPrompt = encodeURIComponent(prompt);
  return `${POLLINATIONS_IMAGE_URL}/${encodedPrompt}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&nofeed=true`;
}

// ══════════════════════════════════════════════════════════════
// IMAGE EDITING - Cloudflare Worker (img2img)
// ══════════════════════════════════════════════════════════════
export async function editImageWithCloudflare(
  imageBase64: string,
  prompt: string,
  strength: number = 0.75
): Promise<string> {
  // Remove data:image/...;base64, prefix if present
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  const response = await fetch(CLOUDFLARE_WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
    },
    body: JSON.stringify({
      mode: 'edit',
      prompt: prompt,
      image: cleanBase64,
      strength: strength,
      num_steps: 20,
      guidance: 7.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Image edit failed: ${errText}`);
  }

  // Response is image/png binary
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read edited image'));
    reader.readAsDataURL(blob);
  });
}

// ══════════════════════════════════════════════════════════════
// IMAGE GENERATION via Cloudflare (alternative)
// ══════════════════════════════════════════════════════════════
export async function generateImageWithCloudflare(
  prompt: string,
  width: number = 1024,
  height: number = 1024
): Promise<string> {
  const response = await fetch(CLOUDFLARE_WORKER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
    },
    body: JSON.stringify({
      mode: 'generate',
      prompt: prompt,
      width: width,
      height: height,
      num_steps: 20,
      guidance: 7.5,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Image generation failed: ${errText}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(blob);
  });
}

// ══════════════════════════════════════════════════════════════
// INTENT DETECTION - Zoya khud samjhegi kya karna hai
// ══════════════════════════════════════════════════════════════
export type Intent = 'chat' | 'vision' | 'image-gen' | 'image-edit' | 'web-search';

export function detectIntent(text: string, hasImage: boolean): Intent {
  const lower = text.toLowerCase();
  
  // Image Edit keywords (when image is attached)
  const editKeywords = ['edit', 'change', 'modify', 'convert', 'transform', 'make it', 'turn it', 'banao', 'badlo', 'karo', 'kar do', 'style', 'filter', 'effect', 'painting', 'cartoon', 'anime', 'realistic', 'background change', 'remove', 'add', 'replace'];
  
  // Image Generation keywords
  const genKeywords = ['generate', 'create', 'draw', 'make image', 'make a image', 'make an image', 'image banao', 'photo banao', 'picture banao', 'tasveer', 'image of', 'picture of', 'photo of', 'draw me', 'generate image', 'create image', 'ek image', 'ek photo', 'ek picture'];
  
  // Web Search keywords
  const searchKeywords = ['search', 'find', 'latest', 'news', 'current', 'today', '2024', '2025', 'what is happening', 'kya ho raha', 'latest news', 'search karo', 'dhundho', 'pata karo', 'batao kya', 'update', 'trending'];
  
  // Vision - if image attached and no edit keywords, default to vision

  if (hasImage) {
    // Check for edit intent first
    for (const kw of editKeywords) {
      if (lower.includes(kw)) return 'image-edit';
    }
    // If image attached but no edit keywords, it's vision
    return 'vision';
  }
  
  // Check for image generation
  for (const kw of genKeywords) {
    if (lower.includes(kw)) return 'image-gen';
  }
  
  // Check for web search
  for (const kw of searchKeywords) {
    if (lower.includes(kw)) return 'web-search';
  }
  
  // Default to chat
  return 'chat';
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
