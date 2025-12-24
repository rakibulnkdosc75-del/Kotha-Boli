
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, BookOpen, Trash2, Sparkles, Volume2, Quote, 
  Loader2, X, ChevronLeft, ChevronRight, Image as ImageIcon,
  Book, Download, Share2, LayoutGrid, Type, User, Save, Zap
} from 'lucide-react';
import { Story, StoryScene, AIModelMode, AI_PERSONAS } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';

// Audio Processing Utils
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
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [view, setView] = useState<'library' | 'editor'>('library');
  const [editorTab, setEditorTab] = useState<'write' | 'storyboard' | 'publish'>('write');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIModelMode>(AIModelMode.STANDARD);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Fix: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout for consistent browser behavior
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Initial Data
  useEffect(() => {
    const loaded = storageService.loadStories();
    setStories(loaded);
    const lastId = storageService.getActiveId();
    if (lastId && loaded.find(s => s.id === lastId)) {
      setActiveStoryId(lastId);
    }
  }, []);

  // Debounced Save Mechanism
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    if (stories.length > 0) {
      setIsAutoSaving(true);
      saveTimeoutRef.current = setTimeout(() => {
        storageService.saveStories(stories);
        setIsAutoSaving(false);
      }, 1500);
    }
  }, [stories]);

  useEffect(() => {
    if (activeStoryId) storageService.saveActiveId(activeStoryId);
  }, [activeStoryId]);

  const activeStory = stories.find(s => s.id === activeStoryId);

  const createNewStory = () => {
    const newStory: Story = {
      id: Date.now().toString(),
      title: 'নতুন গল্প',
      author: 'অজ্ঞাতনামা লেখক',
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
  };

  const updateActiveStory = useCallback((updates: Partial<Story>) => {
    if (!activeStoryId) return;
    setStories(prev => prev.map(s => s.id === activeStoryId ? { ...s, ...updates, lastModified: Date.now() } : s));
  }, [activeStoryId]);

  const handleStoryboardGeneration = async () => {
    if (!activeStory || activeStory.content.length < 100) {
      alert("স্টোরিবোর্ড তৈরির জন্য কমপক্ষে ১০০টি অক্ষর লিখুন।");
      return;
    }
    setIsAILoading(true);
    try {
      const sceneTexts = await geminiService.breakIntoScenes(activeStory.content);
      const newStoryboard: StoryScene[] = sceneTexts.map((text: string) => ({
        id: Math.random().toString(36).substr(2, 9),
        text
      }));
      updateActiveStory({ storyboard: newStoryboard });
    } catch (error) {
      alert("দৃশ্য তৈরি করতে ত্রুটি হয়েছে।");
    } finally {
      setIsAILoading(false);
    }
  };

  const illustrateScene = async (sceneId: string) => {
    const scene = activeStory?.storyboard.find(s => s.id === sceneId);
    if (!scene || !activeStory) return;
    setIsAILoading(true);
    try {
      const imageUrl = await geminiService.generateImage(scene.text);
      if (imageUrl) {
        const updatedStoryboard = activeStory.storyboard.map(s => 
          s.id === sceneId ? { ...s, imageUrl } : s
        );
        updateActiveStory({ storyboard: updatedStoryboard });
      }
    } finally {
      setIsAILoading(false);
    }
  };

  const smartDialogueFormat = () => {
    if (!activeStory) return;
    const lines = activeStory.content.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      // Detect dialogue patterns like: রহিম: কেমন আছ? or সে বলল, আমি যাব।
      if (trimmed.length > 0 && !trimmed.startsWith('—')) {
        const speechVerbs = ['বলল', 'বললেন', 'বলছি', 'জিজ্ঞেস করল', 'বলল সে', 'শুধানো'];
        const hasSpeechVerb = speechVerbs.some(verb => trimmed.includes(verb));
        const hasColon = trimmed.includes(':');
        
        if (hasColon || hasSpeechVerb) {
          return '— ' + trimmed;
        }
      }
      return line;
    });
    updateActiveStory({ content: formattedLines.join('\n') });
  };

  const playTTS = async () => {
    if (!activeStory?.content || isTTSLoading) return;
    setIsTTSLoading(true);
    try {
      const textToPlay = activeStory.content.slice(0, 3000);
      const base64Audio = await geminiService.generateSpeech(textToPlay);
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume();
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsTTSLoading(false);
    }
  };

  const renderLibrary = () => (
    <div className="p-12 max-w-7xl mx-auto min-h-screen animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-8">
        <div>
          <div className="flex items-center gap-4 mb-4">
             <div className="w-14 h-14 bg-slate-900 rounded-[1.25rem] flex items-center justify-center text-white font-bold text-3xl shadow-xl">ক</div>
             <h1 className="text-5xl font-extrabold text-slate-800 bengali-serif tracking-tight">কথা-বলি</h1>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] ml-1">The Digital Home for Bengali Lit.</p>
        </div>
        <button 
          onClick={createNewStory}
          className="bg-amber-600 hover:bg-amber-700 text-white px-10 py-4 rounded-2xl shadow-xl shadow-amber-600/20 flex items-center gap-3 font-bold transition-all transform hover:scale-105 active:scale-95"
        >
          <Plus size={22} /> নতুন গল্প শুরু করুন
        </button>
      </header>

      {stories.length === 0 ? (
        <div className="h-[40vh] flex flex-col items-center justify-center space-y-4 text-slate-300">
          <BookOpen size={80} strokeWidth={1} className="opacity-10" />
          <p className="bengali-serif text-lg font-medium opacity-50">আপনার কোনো পাণ্ডুলিপি নেই</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
          {stories.map(story => (
            <div 
              key={story.id} 
              onClick={() => { setActiveStoryId(story.id); setView('editor'); }}
              className="group bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all cursor-pointer flex flex-col h-[520px]"
            >
              <div className="h-[65%] bg-slate-50 relative overflow-hidden">
                {story.coverImage ? (
                  <img src={story.coverImage} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" alt="Cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                    <Book size={80} strokeWidth={0.5} />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                   <div className="bg-white px-8 py-3 rounded-2xl font-bold text-xs shadow-xl">Edit Manuscript</div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800 bengali-serif line-clamp-1 mb-2">{story.title}</h3>
                  <p className="text-sm text-slate-400 bengali-serif line-clamp-2 leading-relaxed opacity-80">{story.synopsis || story.content.slice(0, 100) || 'বিবরণ নেই...'}</p>
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{story.category}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); if(confirm("মুছে ফেলতে চান?")) setStories(stories.filter(s => s.id !== story.id)); }}
                    className="p-2 text-slate-200 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderEditor = () => (
    <div className="flex flex-col h-full bg-[#fdfcf8] animate-in slide-in-from-right duration-500">
      <header className="h-20 border-b border-slate-100 bg-white/90 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-10">
        <div className="flex items-center gap-8">
          <button onClick={() => setView('library')} className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all">
            <ChevronLeft size={24} />
          </button>
          <nav className="flex gap-2 p-1.5 bg-slate-100/50 rounded-2xl border border-slate-200/50">
            {[
              { id: 'write', icon: <Type size={18} />, label: 'লিখনী' },
              { id: 'storyboard', icon: <LayoutGrid size={18} />, label: 'স্টোরিবোর্ড' },
              { id: 'publish', icon: <BookOpen size={18} />, label: 'প্রকাশনা' }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setEditorTab(tab.id as any)}
                className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  editorTab === tab.id ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.icon} <span className="bengali-serif">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center gap-6">
           {isAILoading && <div className="flex items-center gap-2 text-amber-600 font-bold text-[10px] uppercase tracking-widest"><Loader2 className="animate-spin" size={14} /> AI Processing</div>}
           <div className={`flex items-center gap-2 text-slate-300 transition-opacity ${isAutoSaving ? 'opacity-100' : 'opacity-0'}`}>
              <Save size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
           </div>
           <button className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:scale-105 transition-all"><Share2 size={18} /></button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {editorTab === 'write' && (
          <div className="max-w-4xl mx-auto pt-24 pb-60 px-10">
            <input 
              value={activeStory?.title} 
              onChange={e => updateActiveStory({ title: e.target.value })}
              className="w-full text-7xl font-black bg-transparent border-none focus:outline-none mb-14 bengali-serif text-slate-900 placeholder:text-slate-100"
              placeholder="গল্পের নাম..."
            />
            <textarea 
              ref={textareaRef}
              value={activeStory?.content} 
              onChange={e => updateActiveStory({ content: e.target.value })}
              className="w-full min-h-[70vh] text-2xl leading-[2.4] bg-transparent border-none focus:outline-none bengali-serif text-slate-700 placeholder:text-slate-200 resize-none"
              placeholder="এখানে আপনার অমর লেখনী শুরু করুন..."
            />
          </div>
        )}

        {editorTab === 'storyboard' && (
          <div className="max-w-6xl mx-auto p-16 space-y-16">
            <div className="flex justify-between items-center bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
              <div>
                <h2 className="text-3xl font-bold bengali-serif text-slate-800">গল্পের স্টোরিবোর্ড</h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-2">Visual Mapping via Gemini Flash</p>
              </div>
              <button 
                onClick={handleStoryboardGeneration}
                className="bg-slate-900 text-white px-10 py-4 rounded-2xl flex items-center gap-3 font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10"
              >
                <Sparkles size={20} /> দৃশ্য তৈরি করুন
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pb-40">
              {activeStory?.storyboard.map((scene, idx) => (
                <div key={scene.id} className="bg-white rounded-[3.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-2xl transition-all">
                  <div className="aspect-video bg-slate-50 relative overflow-hidden ring-1 ring-inset ring-slate-100/50">
                    {scene.imageUrl ? (
                      <img src={scene.imageUrl} className="w-full h-full object-cover" alt="Scene" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-slate-200">
                        <ImageIcon size={64} strokeWidth={0.5} />
                        <button 
                          onClick={() => illustrateScene(scene.id)}
                          className="px-8 py-3 bg-white border border-slate-200 rounded-2xl text-[10px] font-black text-slate-500 hover:text-amber-600 hover:border-amber-500 transition-all shadow-md active:scale-95 uppercase tracking-widest"
                        >
                          Illustrate Scene
                        </button>
                      </div>
                    )}
                    <div className="absolute top-6 left-6 bg-slate-900/80 backdrop-blur-xl text-white text-[9px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-white/10 shadow-lg">Scene {idx + 1}</div>
                  </div>
                  <div className="p-10">
                    <p className="bengali-serif text-xl leading-relaxed text-slate-700 opacity-90">{scene.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {editorTab === 'publish' && (
          <div className="max-w-6xl mx-auto p-16 space-y-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
              <div className="lg:col-span-4 space-y-8">
                <div className="aspect-[3/4.5] bg-slate-50 rounded-[3.5rem] overflow-hidden shadow-2xl relative group border-[12px] border-white ring-1 ring-slate-100">
                  {activeStory?.coverImage ? (
                    <img src={activeStory.coverImage} className="w-full h-full object-cover" alt="Cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-100">
                       <Book size={100} strokeWidth={0.5} />
                    </div>
                  )}
                  <button 
                    onClick={async () => {
                      setIsAILoading(true);
                      const url = await geminiService.generateImage(`Dramatic book cover for "${activeStory?.title}". Theme: ${activeStory?.synopsis || "Bengali Literature"}`);
                      if (url) updateActiveStory({ coverImage: url });
                      setIsAILoading(false);
                    }}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-md opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300"
                  >
                    <div className="bg-white px-8 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 text-slate-900 shadow-xl active:scale-95">
                       <Sparkles size={14} className="text-amber-500" />
                       Design Cover
                    </div>
                  </button>
                </div>
                <button className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95">
                  <Download size={20} /> 
                  <span className="bengali-serif">PDF হিসেবে সেভ করুন</span>
                </button>
              </div>

              <div className="lg:col-span-8 space-y-10">
                <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm space-y-10">
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Manuscript Title</label>
                     <input value={activeStory?.title} onChange={e => updateActiveStory({ title: e.target.value })} className="w-full bg-slate-50 px-8 py-5 rounded-3xl font-bold bengali-serif text-2xl text-slate-800 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all border-none outline-none" />
                   </div>
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Author Name</label>
                     <div className="flex items-center gap-4 bg-slate-50 px-8 py-5 rounded-3xl">
                       <User size={20} className="text-slate-300" />
                       <input value={activeStory?.author} onChange={e => updateActiveStory({ author: e.target.value })} className="bg-transparent border-none focus:outline-none w-full font-bold bengali-serif text-lg text-slate-800" />
                     </div>
                   </div>
                   <div className="space-y-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Synopsis</label>
                     <textarea value={activeStory?.synopsis} onChange={e => updateActiveStory({ synopsis: e.target.value })} className="w-full h-40 bg-slate-50 border-none rounded-[2.5rem] p-8 focus:ring-4 focus:ring-slate-100 outline-none bengali-serif text-lg text-slate-700 leading-relaxed transition-all resize-none" placeholder="গল্পের মূল কাহিনী এক লাইনে লিখুন..." />
                   </div>
                   <div className="grid grid-cols-2 gap-8">
                     <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Genre</label>
                       <select value={activeStory?.category} onChange={e => updateActiveStory({ category: e.target.value as any })} className="w-full bg-slate-50 rounded-3xl p-5 border-none focus:ring-0 font-bold text-slate-700 appearance-none cursor-pointer">
                         <option value="Short Story">ছোটগল্প</option>
                         <option value="Novel">উপন্যাস</option>
                         <option value="Poetry">কবিতা</option>
                         <option value="Experimental">পরীক্ষামূলক</option>
                       </select>
                     </div>
                     <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Rights</label>
                       <div className="flex items-center gap-3 bg-slate-50 p-5 rounded-3xl text-slate-400 font-bold text-[10px] uppercase tracking-tighter">
                          All Rights Reserved © {new Date().getFullYear()}
                       </div>
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Action HUD */}
      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] transition-transform hover:scale-[1.02]">
        <div className="bg-slate-900/95 backdrop-blur-3xl border border-white/10 px-10 py-5 rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)] flex items-center gap-10">
           <button 
             onClick={() => setShowAIModal(true)} 
             className="flex items-center gap-3 font-bold text-white hover:text-amber-400 transition-colors group"
           >
             <Sparkles size={24} className="text-amber-500 group-hover:scale-125 transition-transform" />
             <span className="bengali-serif text-lg">এআই লেখক</span>
           </button>
           
           <div className="h-10 w-[1px] bg-white/10" />
           
           <div className="flex items-center gap-6">
             <button onClick={smartDialogueFormat} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90" title="Dialogues"><Quote size={22} /></button>
             <button onClick={playTTS} disabled={isTTSLoading} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90 disabled:opacity-30" title="Listen">{isTTSLoading ? <Loader2 size={22} className="animate-spin text-amber-500" /> : <Volume2 size={22} />}</button>
             <button onClick={() => setEditorTab('storyboard')} className="p-4 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white active:scale-90" title="Storyboard"><ImageIcon size={22} /></button>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col font-sans selection:bg-amber-100">
      {view === 'library' ? renderLibrary() : renderEditor()}

      {showAIModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-8">
          <div className="bg-white w-full max-w-4xl rounded-[4rem] shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
            <div className="p-14 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-4xl font-bold bengali-serif text-slate-900">এআই লেখক সহায়িকা</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3 ml-2">Creative Neural Synergy</p>
              </div>
              <button onClick={() => setShowAIModal(false)} className="p-5 hover:bg-white rounded-full text-slate-300 hover:text-slate-900 transition-all active:scale-75 shadow-sm ring-1 ring-slate-100"><X size={36} /></button>
            </div>
            
            <div className="p-14 space-y-12">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {AI_PERSONAS.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => setAiMode(p.id)}
                    className={`p-10 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group ${
                      aiMode === p.id 
                        ? 'bg-amber-600 border-amber-600 shadow-2xl shadow-amber-600/30 -translate-y-1' 
                        : 'bg-white hover:bg-slate-50 border-slate-100'
                    }`}
                  >
                    <div className="text-5xl mb-6 group-hover:scale-110 transition-transform duration-300">{p.icon}</div>
                    <div className={`font-bold bengali-serif text-2xl ${aiMode === p.id ? 'text-white' : 'text-slate-800'}`}>{p.bnName}</div>
                    <p className={`text-[11px] mt-3 leading-relaxed opacity-90 ${aiMode === p.id ? 'text-amber-50' : 'text-slate-500'}`}>{p.description}</p>
                    {aiMode === p.id && <div className="absolute top-6 right-6"><Zap size={16} className="text-white fill-white animate-pulse" /></div>}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Next Chapter Direction (Prompt)</label>
                <textarea 
                  value={aiPrompt} 
                  onChange={e => setAiPrompt(e.target.value)}
                  className="w-full h-52 bg-slate-50 rounded-[3rem] p-12 focus:ring-8 focus:ring-amber-500/5 focus:bg-white focus:border-amber-200 border-2 border-transparent outline-none bengali-serif text-2xl text-slate-800 resize-none transition-all placeholder:text-slate-200"
                  placeholder="গল্পের পরবর্তী দৃশ্য বা পরিচ্ছেদের নির্দেশনা দিন..."
                />
              </div>

              <div className="flex justify-end gap-10 pt-8 items-center">
                <button onClick={() => setShowAIModal(false)} className="font-bold text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] text-xs">বাতিল</button>
                <button 
                  onClick={async () => {
                    if (!activeStoryId || !aiPrompt) return;
                    setIsAILoading(true);
                    setShowAIModal(false);
                    const initial = activeStory?.content || "";
                    let accumulated = "";
                    updateActiveStory({ content: initial + "\n\n" });
                    try {
                      await geminiService.generateStoryPartStream(aiPrompt, initial, aiMode, (chunk) => {
                        accumulated += chunk;
                        updateActiveStory({ content: initial + "\n\n" + accumulated });
                        if (textareaRef.current) textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                      });
                      setAiPrompt('');
                    } catch (err) {
                      alert("এআই সংকেত পাওয়া যায়নি।");
                    } finally {
                      setIsAILoading(false);
                    }
                  }}
                  disabled={!aiPrompt}
                  className="bg-slate-900 text-white px-20 py-6 rounded-[2.5rem] font-bold shadow-2xl shadow-slate-900/20 hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 flex items-center gap-4 text-lg"
                >
                  গল্পটি এগিয়ে নিন <ChevronRight size={24} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        body { background-color: #fdfcf8; color: #1e293b; overflow: hidden; }
        .custom-scrollbar::-webkit-scrollbar { width: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { 
          background: #e2e8f0; 
          border-radius: 20px; 
          border: 4px solid #fdfcf8; 
          background-clip: content-box; 
        }
        .bengali-serif { font-family: 'Noto Serif Bengali', serif; }
        textarea::placeholder, input::placeholder { color: #f1f5f9; }
        .animate-in { animation: animate-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes animate-in { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default App;
