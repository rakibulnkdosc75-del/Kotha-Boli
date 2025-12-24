
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Plus, BookOpen, Trash2, Sparkles, Volume2, Quote, 
  Loader2, X, ChevronLeft, ChevronRight, Image as ImageIcon,
  Book, Download, Share2, LayoutGrid, Type, User, Save, Zap,
  FileText, Globe, FileType, FileDown, GalleryVertical, 
  AlertCircle, Info, Maximize2, Minimize2, Clock, AlignLeft,
  Search, Wand2, RefreshCcw, Settings, ShieldCheck, ShieldAlert,
  Moon, Sun, CheckCircle2
} from 'lucide-react';
import { Story, StoryScene, AIModelMode, AI_PERSONAS, AppSettings } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';

// Audio Decoding Utilities
function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [settings, setSettings] = useState<AppSettings>(storageService.loadSettings());
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'editor'>('library');
  const [editorTab, setEditorTab] = useState<'write' | 'storyboard' | 'publish'>('write');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIModelMode>(AIModelMode.STANDARD);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistence logic
  useEffect(() => {
    const loaded = storageService.loadStories();
    setStories(loaded);
    const lastId = storageService.getActiveId();
    if (lastId && loaded.find(s => s.id === lastId)) {
      setActiveStoryId(lastId);
    }
  }, []);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (stories.length > 0) {
      setIsAutoSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        storageService.saveStories(stories);
        setIsAutoSaving(false);
      }, settings.autoSaveInterval);
    }
  }, [stories, settings.autoSaveInterval]);

  useEffect(() => {
    if (activeStoryId) storageService.saveActiveId(activeStoryId);
  }, [activeStoryId]);

  useEffect(() => {
    storageService.saveSettings(settings);
  }, [settings]);

  const activeStory = useMemo(() => 
    stories.find(s => s.id === activeStoryId), 
  [stories, activeStoryId]);

  const filteredStories = useMemo(() => {
    if (!searchQuery) return stories;
    return stories.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [stories, searchQuery]);

  const stats = useMemo(() => {
    if (!activeStory) return { words: 0, time: 0 };
    const words = activeStory.content.trim().split(/\s+/).filter(w => w.length > 0).length;
    const time = Math.ceil(words / 150);
    return { words, time };
  }, [activeStory]);

  const createNewStory = () => {
    const newStory: Story = {
      id: Date.now().toString(),
      title: 'শিরোনামহীন পাণ্ডুলিপি',
      author: 'অজ্ঞাতনামা',
      synopsis: '',
      content: '',
      lastModified: Date.now(),
      category: 'Short Story',
      storyboard: []
    };
    setStories([newStory, ...stories]);
    setActiveStoryId(newStory.id);
    setView('editor');
    setEditorTab('write');
    setIsFocusMode(false);
  };

  const updateActiveStory = useCallback((updates: Partial<Story>) => {
    if (!activeStoryId) return;
    setStories(prev => prev.map(s => s.id === activeStoryId ? { ...s, ...updates, lastModified: Date.now() } : s));
  }, [activeStoryId]);

  const deleteStory = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm("আপনি কি নিশ্চিতভাবে এই পাণ্ডুলিপিটি মুছে ফেলতে চান?")) {
      const next = stories.filter(s => s.id !== id);
      setStories(next);
      if (activeStoryId === id) {
        setActiveStoryId(null);
        setView('library');
      }
    }
  };

  const deleteActiveStory = () => {
    if (activeStoryId) deleteStory(activeStoryId);
  };

  const handleAISuggestion = async () => {
    if (!activeStoryId || !aiPrompt) return;
    setIsAILoading(true);
    setShowAIModal(false);
    
    const initialContent = activeStory?.content || "";
    let accumulated = "";
    updateActiveStory({ content: initialContent + "\n\n" });

    try {
      await geminiService.generateStoryPartStream(
        aiPrompt, 
        initialContent, 
        aiMode, 
        settings.isAdultModeEnabled,
        (chunk) => {
          accumulated += chunk;
          updateActiveStory({ content: initialContent + "\n\n" + accumulated });
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }
      );
      setAiPrompt('');
    } catch (err) {
      alert("এআই সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setIsAILoading(false);
    }
  };

  const smartDialogueFormat = () => {
    if (!activeStory) return;
    const lines = activeStory.content.split('\n');
    const speechVerbs = ['বলল', 'বললেন', 'জিজ্ঞেস করল', 'শুনল', 'উত্তর দিল', 'বলছি', 'আর্জি জানালেন'];
    const formatted = lines.map(line => {
      const t = line.trim();
      if (t.length > 0 && !t.startsWith('—')) {
        if (t.includes(':') || speechVerbs.some(v => t.includes(v))) {
          return '— ' + t;
        }
      }
      return line;
    }).join('\n');
    updateActiveStory({ content: formatted });
  };

  const handleTTS = async () => {
    if (!activeStory?.content || isTTSLoading) return;
    setIsTTSLoading(true);
    try {
      const base64 = await geminiService.generateSpeech(activeStory.content.slice(0, 1500));
      if (base64) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const buffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } finally {
      setIsTTSLoading(false);
    }
  };

  const exportTxt = () => {
    if (!activeStory) return;
    const blob = new Blob([`${activeStory.title}\nরচয়িতা: ${activeStory.author}\n\n${activeStory.content}`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeStory.title}.txt`;
    a.click();
  };

  const exportDoc = () => {
    if (!activeStory) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body>";
    const content = `<h1>${activeStory.title}</h1><p>${activeStory.author}</p><p style="white-space: pre-wrap">${activeStory.content}</p>`;
    const blob = new Blob([header + content + "</body></html>"], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeStory.title}.doc`;
    a.click();
  };

  const exportToHtml = () => {
    if (!activeStory) return;
    const htmlContent = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>${activeStory.title}</title><style>@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+Bengali:wght@400;700&display=swap');body { font-family: 'Noto Serif Bengali', serif; line-height: 1.8; max-width: 800px; margin: 40px auto; padding: 20px; color: #334155; background: #fdfcf8; }h1 { text-align: center; color: #0f172a; font-size: 3rem; margin-bottom: 0.5rem; }.author { text-align: center; color: #64748b; font-style: italic; margin-bottom: 3rem; font-weight: bold; }.content { white-space: pre-wrap; font-size: 1.25rem; color: #334155; }</style></head><body><h1>${activeStory.title}</h1><div class="author">রচয়িতা: ${activeStory.author}</div><div class="content">${activeStory.content}</div></body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeStory.title}.html`;
    a.click();
  };

  const exportToPdf = () => window.print();

  const generateImageBook = () => alert("এই ফিচারটি উন্নয়ন পর্যায়ে রয়েছে।");

  // --- VIEWS ---

  const SettingsModal = () => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl p-6 animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-100 animate-scale-up">
        <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-900 text-white rounded-2xl"><Settings size={24} /></div>
            <div>
              <h2 className="text-2xl font-black bengali-serif text-slate-900">অ্যাপ সেটিংস</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Configure your Sanctuary</p>
            </div>
          </div>
          <button onClick={() => setShowSettingsModal(false)} className="p-3 hover:bg-white rounded-full text-slate-300 hover:text-slate-900 transition-all shadow-sm ring-1 ring-slate-100"><X size={24} /></button>
        </div>

        <div className="p-10 space-y-10">
          <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100">
             <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${settings.isAdultModeEnabled ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-400'}`}>
                   {settings.isAdultModeEnabled ? <ShieldAlert size={28} /> : <ShieldCheck size={28} />}
                </div>
                <div>
                   <h4 className="font-bold bengali-serif text-lg">১৮+ প্রাপ্তবয়স্ক মোড</h4>
                   <p className="text-xs text-slate-400 leading-relaxed max-w-[280px]">সাহসী ও নির্ভীক সাহিত্য রচনার জন্য এআই ফিল্টার শিথিল করুন।</p>
                </div>
             </div>
             <button 
              onClick={() => {
                if (!settings.isAdultModeEnabled) {
                  if (confirm("আপনি কি ১৮ বছর বা তার বেশি বয়স্ক? প্রাপ্তবয়স্ক মোড সক্রিয় করলে এআই সাহসী ও বয়স্কোপযোগী সাহিত্য তৈরি করবে।")) {
                    setSettings({ ...settings, isAdultModeEnabled: true });
                  }
                } else {
                  setSettings({ ...settings, isAdultModeEnabled: false });
                }
              }}
              className={`w-16 h-8 rounded-full transition-all relative ${settings.isAdultModeEnabled ? 'bg-rose-600' : 'bg-slate-200'}`}
             >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg transition-all ${settings.isAdultModeEnabled ? 'left-9' : 'left-1'}`} />
             </button>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Auto-Save Frequency</label>
            <div className="grid grid-cols-3 gap-3">
              {[1000, 5000, 15000].map(ms => (
                <button 
                  key={ms}
                  onClick={() => setSettings({...settings, autoSaveInterval: ms})}
                  className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all ${settings.autoSaveInterval === ms ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}
                >
                  {ms/1000}s
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 bg-slate-50 flex justify-end">
          <button onClick={() => setShowSettingsModal(false)} className="bg-slate-900 text-white px-10 py-3 rounded-2xl font-bold shadow-xl active:scale-95 transition-all">সংরক্ষণ করুন</button>
        </div>
      </div>
    </div>
  );

  const LibraryView = () => (
    <div className="min-h-screen max-w-7xl mx-auto px-6 py-12 animate-fade-in">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-xl">ক</div>
            <h1 className="text-4xl font-black text-slate-800 bengali-serif">কথা-বলি</h1>
          </div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] ml-1">The Sanctuary for Bengali Literati</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="পাণ্ডুলিপি খুঁজুন..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-100 rounded-2xl py-3.5 pl-12 pr-6 focus:ring-4 focus:ring-slate-100 focus:border-slate-300 outline-none transition-all bengali-serif"
            />
          </div>
          <button onClick={() => setShowSettingsModal(true)} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:text-slate-900 transition-all"><Settings size={20} /></button>
          <button onClick={createNewStory} className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-2xl flex items-center gap-2 font-bold shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.02] active:scale-95"><Plus size={20} /> নতুন লিখুন</button>
        </div>
      </header>

      {filteredStories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[50vh] text-slate-200 space-y-4">
          <BookOpen size={100} strokeWidth={0.5} />
          <p className="bengali-serif text-lg font-medium opacity-50">কোনো পাণ্ডুলিপি পাওয়া যায়নি</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10 pb-20">
          {filteredStories.map(story => (
            <div 
              key={story.id} 
              onClick={() => { setActiveStoryId(story.id); setView('editor'); setEditorTab('write'); }}
              className="group bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer flex flex-col h-[520px] relative"
            >
              <div className="h-[65%] bg-slate-50 relative overflow-hidden">
                {story.coverImage ? (
                  <img src={story.coverImage} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-200"><Book size={80} strokeWidth={0.5} /></div>
                )}
                {story.isMature && <div className="absolute top-6 right-6 p-2 bg-rose-600/90 backdrop-blur-md text-white rounded-xl shadow-lg"><Zap size={14} /></div>}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                   <div className="bg-white px-8 py-3 rounded-2xl font-bold text-xs shadow-xl">সম্পাদনা করুন</div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 bengali-serif line-clamp-1 mb-2">{story.title}</h3>
                  <p className="text-sm text-slate-400 bengali-serif line-clamp-2 leading-relaxed opacity-80">{story.synopsis || story.content.slice(0, 100) || 'বিবরণ নেই...'}</p>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                  <div className="flex items-center gap-2 text-slate-300 font-black text-[9px] uppercase tracking-widest"><Clock size={10} /> {new Date(story.lastModified).toLocaleDateString('bn-BD')}</div>
                  <button onClick={(e) => deleteStory(story.id, e)} className="p-2 text-slate-200 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const EditorView = () => (
    <div className={`flex flex-col h-screen bg-[#fdfcf8] transition-all duration-700 ${isFocusMode ? 'focus-mode' : ''}`}>
      {!isFocusMode && (
        <header className="h-20 border-b border-slate-100 bg-white/90 backdrop-blur-xl flex items-center justify-between px-8 z-50 sticky top-0 print:hidden">
          <div className="flex items-center gap-8">
            <button onClick={() => setView('library')} className="p-2.5 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all"><ChevronLeft size={24} /></button>
            <nav className="flex gap-1 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-200/50">
              {['write', 'storyboard', 'publish'].map(id => (
                <button 
                  key={id}
                  onClick={() => setEditorTab(id as any)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${editorTab === id ? 'bg-white text-slate-900 shadow-md scale-[1.02]' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {id === 'write' ? <Type size={18} /> : id === 'storyboard' ? <LayoutGrid size={18} /> : <BookOpen size={18} />}
                  <span className="bengali-serif hidden sm:inline">{id === 'write' ? 'লিখনী' : id === 'storyboard' ? 'স্টোরিবোর্ড' : 'প্রকাশনা'}</span>
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-300">
               <div className="flex items-center gap-1.5"><AlignLeft size={12} /> {stats.words} Words</div>
               <div className="flex items-center gap-1.5"><Clock size={12} /> {stats.time} Min</div>
            </div>
            <div className={`flex items-center gap-2 transition-opacity duration-500 ${isAutoSaving ? 'opacity-100' : 'opacity-0'}`}><Save size={14} className="text-slate-300 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Auto Saved</span></div>
            <button onClick={() => setIsFocusMode(true)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl shadow-sm transition-all hover:scale-105"><Maximize2 size={18} /></button>
            <button onClick={deleteActiveStory} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
          </div>
        </header>
      )}

      {isFocusMode && <button onClick={() => setIsFocusMode(false)} className="fixed top-8 right-8 z-[200] p-4 bg-slate-900/10 hover:bg-slate-900/20 text-slate-400 hover:text-slate-900 rounded-full transition-all backdrop-blur-lg"><Minimize2 size={24} /></button>}

      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {editorTab === 'write' && (
          <article className="max-w-4xl mx-auto px-8 pt-24 pb-60 animate-fade-in print:pt-0">
            <input value={activeStory?.title} onChange={e => updateActiveStory({ title: e.target.value })} className="w-full text-7xl font-black bg-transparent border-none outline-none mb-12 bengali-serif text-slate-900 placeholder:text-slate-100 focus:placeholder:opacity-0 transition-all print:text-5xl print:text-center" placeholder="গল্পের নাম..." />
            <textarea ref={textareaRef} value={activeStory?.content} onChange={e => updateActiveStory({ content: e.target.value })} className="w-full min-h-[70vh] text-2xl leading-[2.6] bg-transparent border-none outline-none bengali-serif text-slate-700 placeholder:text-slate-100 resize-none transition-all print:text-lg" placeholder="এখানে আপনার অমর লেখনী শুরু করুন..." />
          </article>
        )}
        {editorTab === 'storyboard' && (
          <div className="max-w-6xl mx-auto p-12 space-y-12 animate-fade-in">
             <div className="flex justify-between items-center bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
              <div className="space-y-1">
                <h2 className="text-3xl font-black bengali-serif text-slate-800">গল্পের স্টোরিবোর্ড</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Neural Visual Mapping via Gemini</p>
              </div>
              <button 
                onClick={async () => {
                   if(!activeStory || activeStory.content.length < 50) return alert("দৃশ্য তৈরির জন্য আরও কিছু লিখুন।");
                   setIsAILoading(true);
                   try {
                     const sceneTexts = await geminiService.breakIntoScenes(activeStory.content);
                     updateActiveStory({ storyboard: sceneTexts.map((text: string) => ({ id: Math.random().toString(36).substr(2, 9), text })) });
                   } finally { setIsAILoading(false); }
                }}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
              >
                {isAILoading ? <Loader2 className="animate-spin" size={20} /> : <Wand2 size={20} />} 
                <span className="bengali-serif">দৃশ্য বিভাজন</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pb-40">
              {activeStory?.storyboard.length === 0 ? (
                <div className="col-span-full py-32 border-2 border-dashed border-slate-100 rounded-[4rem] flex flex-col items-center justify-center text-slate-300"><ImageIcon size={64} strokeWidth={0.5} className="mb-4" /><p className="bengali-serif">দৃশ্যগুলো এখানে প্রদর্শিত হবে</p></div>
              ) : activeStory?.storyboard.map((scene, idx) => (
                <div key={scene.id} className="bg-white rounded-[3rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all group">
                  <div className="aspect-video bg-slate-50 relative overflow-hidden ring-1 ring-inset ring-slate-100/50">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Scene" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-slate-200">
                        <ImageIcon size={64} strokeWidth={0.5} />
                        <button onClick={async () => { setIsAILoading(true); const url = await geminiService.generateImage(scene.text); if(url) updateActiveStory({ storyboard: activeStory.storyboard.map(s => s.id === scene.id ? { ...s, imageUrl: url } : s) }); setIsAILoading(false); }} className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 hover:text-amber-600 transition-all shadow-md active:scale-95 uppercase tracking-widest">Generate Visual</button>
                      </div>
                    )}
                    <div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl text-white text-[9px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-white/10 shadow-lg">Scene {idx + 1}</div>
                  </div>
                  <div className="p-10"><p className="bengali-serif text-xl leading-relaxed text-slate-700 opacity-90">{scene.text}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
        {editorTab === 'publish' && (
          <div className="max-w-6xl mx-auto p-12 pb-60 space-y-16 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
               <div className="lg:col-span-4 space-y-10">
                 <div className="aspect-[3/4.5] bg-slate-50 rounded-[3.5rem] overflow-hidden shadow-2xl relative group border-[12px] border-white ring-1 ring-slate-100">
                    {activeStory?.coverImage ? <img src={activeStory.coverImage} className="w-full h-full object-cover" alt="Cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-slate-100"><Book size={100} strokeWidth={0.5} /></div>}
                    <button onClick={async () => { setIsAILoading(true); const url = await geminiService.generateImage(`Dramatic book cover for "${activeStory?.title}". Theme: ${activeStory?.synopsis || "Bengali Literature"}`); if (url) updateActiveStory({ coverImage: url }); setIsAILoading(false); }} className="absolute inset-0 bg-slate-900/70 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-500"><div className="bg-white px-8 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 text-slate-900 shadow-xl active:scale-95"><Sparkles size={14} className="text-amber-500" />AI Cover Design</div></button>
                 </div>
                 <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest ml-4">Export Formats</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={exportTxt} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:shadow-lg transition-all active:scale-95 text-slate-600"><FileText size={28} className="text-blue-500" /><span className="text-[10px] font-bold uppercase tracking-widest">Plain Text</span></button>
                      <button onClick={exportToHtml} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:shadow-lg transition-all active:scale-95 text-slate-600"><Globe size={28} className="text-emerald-500" /><span className="text-[10px] font-bold uppercase tracking-widest">HTML Web</span></button>
                      <button onClick={exportDoc} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:shadow-lg transition-all active:scale-95 text-slate-600"><FileType size={28} className="text-blue-700" /><span className="text-[10px] font-bold uppercase tracking-widest">MS Word</span></button>
                      <button onClick={exportToPdf} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:shadow-lg transition-all active:scale-95 text-slate-600"><FileDown size={28} className="text-red-500" /><span className="text-[10px] font-bold uppercase tracking-widest">PDF Export</span></button>
                      <button onClick={generateImageBook} className="p-5 bg-white border border-slate-100 rounded-3xl flex flex-col items-center gap-3 hover:shadow-lg transition-all active:scale-95 text-slate-600 col-span-2"><GalleryVertical size={28} className="text-amber-500" /><span className="text-[10px] font-bold uppercase tracking-widest">Social Media Book</span></button>
                    </div>
                 </div>
               </div>
               <div className="lg:col-span-8"><div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm space-y-12"><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Title</label><input value={activeStory?.title} onChange={e => updateActiveStory({ title: e.target.value })} className="w-full bg-slate-50 px-8 py-5 rounded-3xl font-bold bengali-serif text-3xl text-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all border-none outline-none" /></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Author</label><div className="flex items-center gap-4 bg-slate-50 px-8 py-5 rounded-3xl"><User size={20} className="text-slate-300" /><input value={activeStory?.author} onChange={e => updateActiveStory({ author: e.target.value })} className="bg-transparent border-none focus:outline-none w-full font-bold bengali-serif text-xl text-slate-800" /></div></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Synopsis</label><textarea value={activeStory?.synopsis} onChange={e => updateActiveStory({ synopsis: e.target.value })} className="w-full h-44 bg-slate-50 border-none rounded-[3rem] p-10 focus:ring-4 focus:ring-slate-100 outline-none bengali-serif text-xl text-slate-700 leading-relaxed transition-all resize-none" placeholder="এক বাক্যে গল্পের পটভূমি..." /></div><div className="grid grid-cols-2 gap-8"><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Genre</label><select value={activeStory?.category} onChange={e => updateActiveStory({ category: e.target.value as any })} className="w-full bg-slate-50 rounded-3xl p-6 border-none focus:ring-0 font-bold text-slate-700 appearance-none cursor-pointer text-lg"><option value="Short Story">ছোটগল্প</option><option value="Novel">উপন্যাস</option><option value="Poetry">কবিতা</option><option value="Experimental">পরীক্ষামূলক</option></select></div><div className="space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Maturity</label><div className={`p-6 rounded-3xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all ${settings.isAdultModeEnabled ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>{settings.isAdultModeEnabled ? <><ShieldAlert size={16} /> Mature Content (18+)</> : <><ShieldCheck size={16} /> All Ages</>}</div></div></div></div></div>
             </div>
          </div>
        )}
      </main>

      <div className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-[150] transition-all duration-700 ${isFocusMode ? 'scale-75 opacity-20 hover:scale-100 hover:opacity-100' : ''}`}><div className="bg-slate-950/90 backdrop-blur-3xl border border-white/10 px-10 py-5 rounded-[4rem] shadow-2xl flex items-center gap-8 ring-1 ring-white/10"><button onClick={() => setShowAIModal(true)} className="flex items-center gap-3 font-bold text-white hover:text-amber-400 transition-all group px-4 py-1"><div className="relative"><Sparkles size={24} className="text-amber-500 group-hover:scale-110 group-hover:rotate-12 transition-all" /><div className="absolute inset-0 bg-amber-500 blur-xl opacity-0 group-hover:opacity-40 transition-opacity" /></div><span className="bengali-serif text-xl">এআই মিউজ</span></button><div className="h-10 w-[1px] bg-white/10 mx-2" /><div className="flex items-center gap-4"><button onClick={smartDialogueFormat} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90" title="Smart Format"><Quote size={22} /></button><button onClick={handleTTS} disabled={isTTSLoading} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90 disabled:opacity-20" title="Read Aloud">{isTTSLoading ? <Loader2 size={22} className="animate-spin text-amber-500" /> : <Volume2 size={22} />}</button><button onClick={() => setEditorTab('storyboard')} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90" title="View Storyboard"><ImageIcon size={22} /></button><button onClick={() => { updateActiveStory({ content: '' }); }} className="p-4 bg-white/5 hover:bg-red-500/20 rounded-full transition-all text-white active:scale-90" title="Clear Content"><RefreshCcw size={22} /></button></div></div></div>
    </div>
  );

  return (
    <div className="min-h-screen w-full selection:bg-amber-100 font-sans">
      {view === 'library' ? <LibraryView /> : <EditorView />}
      
      {showSettingsModal && <SettingsModal />}

      {showAIModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/95 backdrop-blur-2xl p-6 animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden border border-white/10 animate-scale-up">
            <div className="p-12 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div className="space-y-1">
                <h2 className="text-4xl font-black bengali-serif text-slate-900">এআই লেখক সহায়িকা</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-2">Collaborative Neural Creativity</p>
              </div>
              <button onClick={() => setShowAIModal(false)} className="p-5 hover:bg-white rounded-full text-slate-300 hover:text-slate-900 transition-all active:scale-75 shadow-sm ring-1 ring-slate-100"><X size={32} /></button>
            </div>
            
            <div className="p-12 space-y-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {AI_PERSONAS.map(p => {
                  const isLocked = p.isMature && !settings.isAdultModeEnabled;
                  return (
                    <button 
                      key={p.id} 
                      onClick={() => !isLocked && setAiMode(p.id)}
                      className={`p-6 rounded-[2.5rem] border-2 text-center transition-all relative overflow-hidden flex flex-col items-center gap-3 ${
                        isLocked ? 'opacity-40 grayscale cursor-not-allowed border-slate-100 bg-slate-50' : 
                        aiMode === p.id 
                          ? (p.id === AIModelMode.BOLD ? 'bg-rose-700 border-rose-700 shadow-xl shadow-rose-700/30' : 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/30')
                          : 'bg-white hover:bg-slate-50 border-slate-100 shadow-sm'
                      }`}
                    >
                      <div className="text-4xl">{p.icon}</div>
                      <div className={`font-bold bengali-serif text-lg ${aiMode === p.id ? 'text-white' : 'text-slate-800'}`}>{p.bnName}</div>
                      {isLocked ? <ShieldAlert size={14} className="text-slate-400" /> : aiMode === p.id && <Zap size={14} className="text-white fill-white animate-pulse" />}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between ml-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Chapter/Scene Direction</label>
                   {settings.isAdultModeEnabled && (
                      <div className="flex items-center gap-2 bg-rose-50 px-4 py-1.5 rounded-full border border-rose-100 animate-pulse">
                         <ShieldAlert size={12} className="text-rose-600" />
                         <span className="text-rose-700 font-bold text-[9px] uppercase tracking-widest">Adult Mode Active</span>
                      </div>
                   )}
                </div>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} className="w-full h-48 bg-slate-50 rounded-[3rem] p-10 focus:ring-8 focus:ring-slate-100 focus:bg-white border-2 border-transparent outline-none bengali-serif text-2xl text-slate-800 resize-none transition-all placeholder:text-slate-200" placeholder="গল্পটি ঠিক কীভাবে এগোবে? একটি ছোট সংকেত দিন..." />
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                <div className="flex items-center gap-3 text-slate-400"><Info size={16} /><span className="text-[10px] font-bold uppercase tracking-widest">Pro AI Powered</span></div>
                <div className="flex gap-6 items-center">
                  <button onClick={() => setShowAIModal(false)} className="font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-widest text-xs">বাতিল</button>
                  <button onClick={handleAISuggestion} disabled={!aiPrompt} className={`px-16 py-5 rounded-[2.5rem] font-bold shadow-2xl transition-all disabled:opacity-30 flex items-center gap-3 text-lg text-white ${aiMode === AIModelMode.BOLD ? 'bg-rose-700 hover:bg-rose-800' : 'bg-slate-900 hover:bg-slate-800'} hover:scale-105 active:scale-95`}>লেখনী শুরু করুন <ChevronRight size={22} /></button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scale-up { animation: scale-up 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .bengali-serif { font-family: 'Noto Serif Bengali', serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; border: 3px solid transparent; background-clip: content-box; }
        .focus-mode { background-color: #fdfcf8 !important; }
        @media print { body, .focus-mode { background: white !important; } .custom-scrollbar { overflow: visible !important; height: auto !important; } }
      `}</style>
    </div>
  );
};

export default App;
