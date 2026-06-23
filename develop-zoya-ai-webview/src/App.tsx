import { useState, useRef, useEffect, useCallback } from 'react';
import { Menu, Send, Paperclip, X, Download, ExternalLink, Copy, Check, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';
import { 
  streamChat, 
  analyzeImage, 
  webSearch, 
  generateImageUrl, 
  editImageWithCloudflare,
  detectIntent
} from './services/api';

const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [text, setText] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingResponseRef = useRef('');

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const addMessage = useCallback((msg: ChatMessage) => setMessages(prev => [...prev, msg]), []);
  
  const updateLastAssistantMessage = useCallback((content: string, extra?: Partial<ChatMessage>) => {
    setMessages(prev => {
      const newArr = [...prev];
      for (let i = newArr.length - 1; i >= 0; i--) {
        if (newArr[i].role === 'assistant') {
          newArr[i] = { ...newArr[i], content, ...extra };
          break;
        }
      }
      return newArr;
    });
  }, []);

  const handleClearChat = () => {
    setMessages([]);
    setIsLoading(false);
    pendingResponseRef.current = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => setAttachedImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed && attachedImages.length === 0) return;
    if (isLoading) return;

    const hasImage = attachedImages.length > 0;
    const intent = detectIntent(trimmed, hasImage);

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
      images: hasImage ? attachedImages : undefined,
    };
    addMessage(userMsg);
    setText('');
    const currentImages = [...attachedImages];
    setAttachedImages([]);
    setIsLoading(true);

    // Route based on detected intent
    switch (intent) {
      case 'vision':
        await handleVision(trimmed, currentImages);
        break;
      case 'image-edit':
        await handleImageEdit(trimmed, currentImages);
        break;
      case 'image-gen':
        await handleImageGen(trimmed);
        break;
      case 'web-search':
        await handleWebSearch(trimmed);
        break;
      default:
        await handleChat(trimmed);
    }
  };

  const handleChat = async (input: string) => {
    addMessage({ id: generateId(), role: 'assistant', content: '', timestamp: new Date() });
    pendingResponseRef.current = '';
    
    const contextMessages = messages.slice(-12).map(m => ({ role: m.role as string, content: m.content }));
    contextMessages.push({ role: 'user', content: input });
    
    await streamChat(contextMessages,
      chunk => { pendingResponseRef.current += chunk; updateLastAssistantMessage(pendingResponseRef.current); },
      () => setIsLoading(false),
      error => { updateLastAssistantMessage(`❌ Oops! Error aa gaya: ${error}`); setIsLoading(false); }
    );
  };

  const handleVision = async (input: string, images: string[]) => {
    if (!images.length) {
      addMessage({ id: generateId(), role: 'assistant', content: '🖼️ Aww! Image toh attach karo na pehle, phir main dekh ke bataungi! 💕', timestamp: new Date(), isVision: true });
      setIsLoading(false);
      return;
    }
    addMessage({ id: generateId(), role: 'assistant', content: '', timestamp: new Date(), isVision: true });
    pendingResponseRef.current = '';
    
    await analyzeImage(images[0], input || 'Is image me kya hai? Detail me batao!',
      chunk => { pendingResponseRef.current += chunk; updateLastAssistantMessage(pendingResponseRef.current); },
      () => setIsLoading(false),
      error => { updateLastAssistantMessage(`❌ Vision Error: ${error}`); setIsLoading(false); }
    );
  };

  const handleImageGen = async (input: string) => {
    if (!input) {
      addMessage({ id: generateId(), role: 'assistant', content: '🎨 Yaar describe toh karo kya image banana hai! Like "a beautiful sunset" ya "cute cat" 💕', timestamp: new Date(), isImageGen: true });
      setIsLoading(false);
      return;
    }
    
    addMessage({
      id: generateId(), 
      role: 'assistant',
      content: `🎨 Ooh! Main tumhare liye image bana rahi hoon... 💕\n\n**Prompt:** ${input}\n\nBas thoda wait karo, magic ho raha hai! ✨`,
      timestamp: new Date(), 
      generatedImage: generateImageUrl(input, 1024, 1024), 
      isImageGen: true,
    });
    setIsLoading(false);
  };

  const handleImageEdit = async (input: string, images: string[]) => {
    if (!images.length) {
      addMessage({ id: generateId(), role: 'assistant', content: '📷 Image attach karo na pehle! Phir batao kya edit karna hai 💕', timestamp: new Date(), isImageEdit: true });
      setIsLoading(false);
      return;
    }
    if (!input) {
      addMessage({ id: generateId(), role: 'assistant', content: '✏️ Batao na kya edit karna hai! Like "make it cartoon" ya "change background" 💕', timestamp: new Date(), isImageEdit: true });
      setIsLoading(false);
      return;
    }
    
    addMessage({ 
      id: generateId(), 
      role: 'assistant', 
      content: `✏️ Oooh! Main tumhari image edit kar rahi hoon... 💕\n\n**Edit:** ${input}\n\nThoda patience rakhna yaar, art banti hai! 🎨`, 
      timestamp: new Date(), 
      isImageEdit: true 
    });
    
    try {
      const editedImageBase64 = await editImageWithCloudflare(images[0], input);
      updateLastAssistantMessage(
        `✏️ Tadaa! Image edit ho gayi! 💕✨\n\n**Edit:** ${input}`,
        { generatedImage: editedImageBase64 }
      );
    } catch (err: any) {
      updateLastAssistantMessage(`❌ Oops sorry yaar! Edit nahi ho payi: ${err.message} 😢\n\nDobara try karo please!`);
    }
    setIsLoading(false);
  };

  const handleWebSearch = async (input: string) => {
    if (!input) {
      addMessage({ id: generateId(), role: 'assistant', content: '🔍 Kya search karna hai batao na! Latest news, info, kuch bhi! 💕', timestamp: new Date(), isSearchResult: true });
      setIsLoading(false);
      return;
    }
    
    addMessage({ id: generateId(), role: 'assistant', content: '🔍 Ruko, main search kar rahi hoon... 💕', timestamp: new Date(), isSearchResult: true });
    pendingResponseRef.current = '';
    
    await webSearch(input,
      chunk => { pendingResponseRef.current += chunk; updateLastAssistantMessage(pendingResponseRef.current); },
      () => setIsLoading(false),
      error => { updateLastAssistantMessage(`❌ Search Error: ${error}`); setIsLoading(false); }
    );
  };

  return (
    <div className="flex h-screen bg-[#07070d] text-gray-200 overflow-hidden">
      {/* Sidebar Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      
      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-[280px] bg-[#0c0c18] border-r border-purple-500/10 flex flex-col h-full transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-4 border-b border-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-purple-500/30 text-2xl animate-pulse-glow">✨</div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">Zoya AI</h1>
              <p className="text-[11px] text-gray-500">Your Smart AI Bestie 💕</p>
            </div>
          </div>
        </div>
        
        <div className="px-3 pt-4">
          <button onClick={handleClearChat} className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-purple-500/20 text-gray-400 hover:text-purple-300 hover:border-purple-500/40 hover:bg-purple-500/5 transition-all text-sm">
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>
        
        {/* Features Info */}
        <div className="px-4 pt-6 flex-1">
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-3">Main Yeh Sab Kar Sakti Hoon 💕</p>
          <div className="space-y-2 text-[11px]">
            <div className="flex items-center gap-2 text-gray-400 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-lg">💬</span>
              <span>Chat - Kuch bhi pucho!</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-lg">👁️</span>
              <span>Vision - Image attach karo, main dekh lungi</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-lg">🎨</span>
              <span>Image Gen - "image banao" bol do</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-lg">✏️</span>
              <span>Image Edit - Image attach + edit batao</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400 p-2 rounded-lg bg-white/[0.02]">
              <span className="text-lg">🔍</span>
              <span>Web Search - "search karo" bol do</span>
            </div>
          </div>
          
          <div className="mt-6 p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
            <p className="text-[10px] text-purple-300 leading-relaxed">
              ✨ <strong>Smart Detection!</strong><br/>
              Tujhe mode switch nahi karna. Main khud samajh jaungi kya karna hai! 💕
            </p>
          </div>
        </div>
        
        <div className="p-3 border-t border-purple-500/10">
          <button onClick={handleClearChat} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/5 transition-all text-xs">
            <Trash2 className="w-3.5 h-3.5" /> Clear Chat
          </button>
          <p className="text-[9px] text-gray-700 text-center mt-2">Made with 💜 by Prashant Rajput</p>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-purple-500/10 bg-[#0c0c18]/80 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 flex items-center justify-center text-white text-lg shadow-lg shadow-purple-500/20">✨</div>
            <div>
              <h2 className="text-sm font-bold text-gray-200">Zoya</h2>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400/80">Online & Ready to help! 💕</span>
              </div>
            </div>
          </div>
          <span className="ml-auto hidden sm:inline-flex text-[10px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">NVIDIA Powered 🚀</span>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-2 md:px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 mb-6 animate-pulse-glow text-5xl">✨</div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent mb-2">Hii! Main Zoya hoon 💕</h1>
              <p className="text-gray-500 text-sm max-w-md mx-auto text-center mb-8">Tumhari AI bestie! Mujhse kuch bhi pucho - chat, image banao, edit karo, search karo, ya image analyze karo. Main sab kar sakti hoon! ✨</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                {[
                  { emoji: '💬', text: 'Mujhe apne baare me batao', desc: 'Chat' },
                  { emoji: '🎨', text: 'Ek beautiful sunset ki image banao', desc: 'Image Gen' },
                  { emoji: '🔍', text: 'Latest AI news search karo', desc: 'Web Search' },
                  { emoji: '❓', text: 'Tumhara developer kaun hai?', desc: 'About Me' },
                ].map((item, i) => (
                  <button key={i} onClick={() => { setText(item.text); }} className="flex items-center gap-3 p-4 rounded-2xl bg-[#12121e] border border-purple-500/5 hover:border-purple-500/20 hover:bg-[#1a1a2e] transition-all text-left group">
                    <span className="text-2xl">{item.emoji}</span>
                    <div>
                      <p className="text-sm text-gray-300 group-hover:text-white">{item.text}</p>
                      <p className="text-[10px] text-gray-600">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 flex items-center justify-center text-sm">✨</div>
                  <div>
                    <div className="text-xs font-semibold text-purple-400 mb-1">Zoya</div>
                    <div className="bg-[#1a1a2e] border border-purple-500/10 rounded-2xl px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <div className="w-2 h-2 rounded-full bg-purple-400 typing-dot" />
                        <div className="w-2 h-2 rounded-full bg-pink-400 typing-dot" />
                        <div className="w-2 h-2 rounded-full bg-rose-400 typing-dot" />
                        <span className="text-xs text-gray-500 ml-2">Soch rahi hoon... 💭</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-purple-500/10 bg-[#0c0c18]/80 backdrop-blur-xl p-3 md:p-4">
          {attachedImages.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {attachedImages.map((img, i) => (
                <div key={i} className="relative flex-shrink-0 group">
                  <img src={img} alt="attached" className="w-20 h-20 rounded-xl object-cover border-2 border-purple-500/30" />
                  <button onClick={() => setAttachedImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <button onClick={() => fileInputRef.current?.click()} className="flex-shrink-0 w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 flex items-center justify-center transition-all">
              <Paperclip className="w-5 h-5" />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />
            <div className="flex-1 relative">
              <textarea 
                value={text} 
                onChange={e => setText(e.target.value)} 
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Mujhse kuch bhi pucho... 💕" 
                disabled={isLoading} 
                rows={1}
                className="w-full resize-none rounded-xl bg-[#12121e] border border-purple-500/10 px-4 py-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/30 disabled:opacity-50 pr-12" 
              />
            </div>
            <button 
              onClick={handleSend} 
              disabled={isLoading || (!text.trim() && attachedImages.length === 0)}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${isLoading ? 'bg-purple-500/20 text-purple-400' : text.trim() || attachedImages.length > 0 ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105' : 'bg-gray-800 text-gray-600'}`}
            >
              {isLoading ? <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-2">Image attach karo for vision/edit • "image banao" for generation • "search karo" for web search</p>
        </div>
      </div>
    </div>
  );
}

// Message Component
function MessageBubble({ message }: { message: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const isUser = message.role === 'user';

  const copyText = () => { navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  
  const downloadImage = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `zoya_${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  const getTypeLabel = () => {
    if (message.isVision) return '👁️ Vision';
    if (message.isImageGen) return '🎨 Image Gen';
    if (message.isImageEdit) return '✏️ Image Edit';
    if (message.isSearchResult) return '🔍 Search';
    return null;
  };

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${isUser ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white' : 'bg-gradient-to-br from-purple-600 via-pink-500 to-rose-500 text-white'}`}>
        {isUser ? '👤' : '✨'}
      </div>
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`text-xs font-semibold mb-1 flex items-center gap-2 ${isUser ? 'text-blue-400 justify-end' : 'text-purple-400'}`}>
          {isUser ? 'You' : 'Zoya'}
          {!isUser && getTypeLabel() && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
              {getTypeLabel()}
            </span>
          )}
        </div>
        
        {message.images && message.images.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {message.images.map((img, i) => <img key={i} src={img} alt="attached" className="max-w-[200px] max-h-[150px] rounded-xl border border-white/10 object-cover" />)}
          </div>
        )}
        
        <div className={`rounded-2xl px-4 py-3 ${isUser ? 'bg-gradient-to-br from-blue-600/20 to-cyan-600/10 border border-blue-500/20 text-gray-100' : 'bg-gradient-to-br from-[#1a1a2e] to-[#16162a] border border-purple-500/10 text-gray-200'}`}>
          {message.content && <div className="markdown-content text-sm leading-relaxed"><ReactMarkdown>{message.content}</ReactMarkdown></div>}
          
          {message.generatedImage && (
            <div className="mt-3">
              {!imgLoaded && !imgError && (
                <div className="w-full h-64 bg-purple-500/5 rounded-xl border border-purple-500/10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-xs text-purple-400">Image aa rahi hai... ✨</span>
                  </div>
                </div>
              )}
              {imgError && <div className="w-full h-40 bg-red-500/5 rounded-xl border border-red-500/10 flex items-center justify-center"><span className="text-xs text-red-400">❌ Image load nahi hui 😢</span></div>}
              <img src={message.generatedImage} alt="Generated" className={`max-w-full rounded-xl border border-purple-500/20 shadow-lg ${imgLoaded ? 'block' : 'hidden'}`} onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
              {imgLoaded && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => downloadImage(message.generatedImage!)} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-all"><Download className="w-3.5 h-3.5" /> Download</button>
                  <button onClick={() => window.open(message.generatedImage!, '_blank')} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 border border-purple-500/20 transition-all"><ExternalLink className="w-3.5 h-3.5" /> Full Size</button>
                </div>
              )}
            </div>
          )}
        </div>
        
        {!isUser && message.content && (
          <button onClick={copyText} className="flex items-center gap-1 text-[10px] px-2 py-1 mt-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
            {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>
    </div>
  );
}
