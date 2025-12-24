
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  BookOpen, 
  Trash2, 
  Settings, 
  Sparkles, 
  Volume2, 
  AlignLeft, 
  Save, 
  Quote, 
  Loader2,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { Story, AIModelMode } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [aiMode, setAiMode] = useState<AIModelMode>(AIModelMode.STANDARD);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize data
  useEffect(() => {
    const loadedStories = storageService.loadStories();
    setStories(loadedStories);
    const lastId = storageService.getActiveId();
    if (lastId && loadedStories.find(s => s.id === lastId)) {
      setActiveStoryId(lastId);
    } else if (loadedStories.length > 0) {
      setActiveStoryId(loadedStories[0].id);
    }
  }, []);

  // Persistence
  useEffect(() => {
    if (stories.length > 0) {
      storageService.saveStories(stories);
    }
    if (activeStoryId) {
      storageService.saveActiveId(activeStoryId);
    }
  }, [stories, activeStoryId]);

  const activeStory = stories.find(s => s.id === activeStoryId);

  const createNewStory = () => {
    const newStory: Story = {
      id: Date.now().toString(),
      title: 'নতুন গল্প',
      content: '',
      lastModified: Date.now(),
      category: 'Short Story'
    };
    setStories([newStory, ...stories]);
    setActiveStoryId(newStory.id);
  };

  const deleteStory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = stories.filter(s => s.id !== id);
    setStories(filtered);
    if (activeStoryId === id) {
      setActiveStoryId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const updateActiveStory = (updates: Partial<Story>) => {
    if (!activeStoryId) return;
    setStories(prev => prev.map(s => s.id === activeStoryId ? { ...s, ...updates, lastModified: Date.now() } : s));
  };

  const smartDialogueFormat = () => {
    if (!activeStory) return;
    
    // Simple logic to find patterns like "X said: text" and convert to proper Bengali dialog quotes
    // This is a specialized feature for Bengali literature formatting
    let newContent = activeStory.content;
    
    // Replace standard quotes with Bengali style if needed, or format dashes
    // Bengali dialogs often start with a dash '—'
    const lines = newContent.split('\n');
    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('—') && !trimmed.startsWith('"')) {
        // Only format if it looks like a dialogue line (contains 'বলল' or ':' etc)
        if (trimmed.includes(':') || trimmed.includes('বলল') || trimmed.includes('বললেন')) {
           return '— ' + trimmed;
        }
      }
      return line;
    });

    updateActiveStory({ content: formattedLines.join('\n') });
  };

  const handleAIRequest = async () => {
    if (!activeStoryId || !aiPrompt) return;
    setIsAILoading(true);
    setShowAIModal(false);
    
    try {
      const result = await geminiService.generateStoryPart(aiPrompt, activeStory?.content || "", aiMode);
      updateActiveStory({ content: (activeStory?.content || "") + "\n\n" + result });
      setAiPrompt('');
    } catch (error) {
      console.error(error);
      alert("AI Generation failed. Please check your connection.");
    } finally {
      setIsAILoading(false);
    }
  };

  const playTTS = async () => {
    if (!activeStory?.content) return;
    setIsTTSLoading(true);
    
    try {
      const base64Audio = await geminiService.generateSpeech(activeStory.content.slice(0, 500)); // Sample first 500 chars
      if (!base64Audio) throw new Error("Audio generation failed");

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      
      const ctx = audioContextRef.current;
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = ctx.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    } catch (error) {
      console.error(error);
      alert("TTS failed to play.");
    } finally {
      setIsTTSLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full text-slate-900">
      {/* Sidebar */}
      <aside 
        className={`${isSidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 border-r border-slate-200 bg-white overflow-hidden flex flex-col`}
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-amber-700 bengali-serif">কথা-বলি</h1>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={createNewStory}
            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg transition-colors border border-amber-200 font-medium"
          >
            <Plus size={18} /> নতুন গল্প শুরু করুন
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            {stories.map(story => (
              <div 
                key={story.id}
                onClick={() => setActiveStoryId(story.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border group ${
                  activeStoryId === story.id 
                    ? 'bg-amber-50 border-amber-200 shadow-sm' 
                    : 'bg-white border-transparent hover:border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-slate-800 line-clamp-1 bengali-serif">
                    {story.title || 'শিরোনামহীন'}
                  </h3>
                  <button 
                    onClick={(e) => deleteStory(story.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2 mt-1 bengali-serif leading-relaxed">
                  {story.content || 'গল্পটি লেখা শুরু করুন...'}
                </p>
                <span className="text-[10px] text-slate-400 mt-2 block uppercase tracking-wider">
                  {new Date(story.lastModified).toLocaleDateString('bn-BD')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#fdfcf8] relative">
        {/* Floating Menu Trigger (Mobile) */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-6 left-6 z-10 p-2 bg-white shadow-md rounded-full text-slate-600 hover:text-amber-700"
          >
            <Menu size={20} />
          </button>
        )}

        {/* Toolbar */}
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2">
               <button 
                onClick={() => setShowAIModal(true)}
                className="flex items-center gap-2 px-4 py-1.5 bg-amber-600 text-white rounded-full text-sm font-medium hover:bg-amber-700 transition-all shadow-sm"
               >
                 <Sparkles size={16} /> AI সহায়িকা
               </button>
             </div>
             <div className="h-4 w-[1px] bg-slate-200" />
             <div className="flex items-center gap-1">
               <button 
                onClick={smartDialogueFormat}
                title="সংলাপ বিন্যাস"
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
               >
                 <Quote size={20} />
               </button>
               <button 
                onClick={playTTS}
                disabled={isTTSLoading}
                title="পাঠ করে শুনুন"
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-all disabled:opacity-50"
               >
                 {isTTSLoading ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
               </button>
             </div>
          </div>

          <div className="flex items-center gap-4">
             <span className="text-xs text-slate-400 font-medium hidden sm:inline">
               {activeStory ? `শব্দ সংখ্যা: ${activeStory.content.trim().split(/\s+/).filter(Boolean).length}` : ''}
             </span>
             <button className="p-2 text-slate-400 hover:text-slate-600">
               <Settings size={20} />
             </button>
          </div>
        </header>

        {/* Editor Wrapper */}
        <div className="flex-1 overflow-y-auto pt-12 pb-24 px-6 md:px-0">
          <div className="max-w-2xl mx-auto space-y-8">
            {activeStory ? (
              <>
                <input 
                  type="text"
                  value={activeStory.title}
                  onChange={(e) => updateActiveStory({ title: e.target.value })}
                  placeholder="গল্পের শিরোনাম..."
                  className="w-full text-4xl font-bold bg-transparent border-none placeholder:text-slate-300 focus:outline-none bengali-serif text-slate-800"
                />
                
                <div className="relative min-h-[500px]">
                  {isAILoading && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center z-10">
                      <div className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm border border-amber-200">
                        <Loader2 size={14} className="animate-spin" /> AI লিখছে...
                      </div>
                    </div>
                  )}
                  <textarea 
                    value={activeStory.content}
                    onChange={(e) => updateActiveStory({ content: e.target.value })}
                    placeholder="এখানে আপনার গল্পটি লিখতে শুরু করুন..."
                    className="editor-textarea w-full h-full min-h-[500px] text-lg leading-relaxed bg-transparent border-none placeholder:text-slate-300 resize-none bengali-serif text-slate-700"
                    spellCheck={false}
                  />
                </div>
              </>
            ) : (
              <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 space-y-4">
                <BookOpen size={64} className="opacity-20" />
                <p className="text-lg bengali-serif">একটি গল্প নির্বাচন করুন অথবা নতুন শুরু করুন</p>
                <button 
                  onClick={createNewStory}
                  className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                >
                  নতুন গল্প
                </button>
              </div>
            )}
          </div>
        </div>

        {/* AI Prompt Modal */}
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-amber-50">
                <div className="flex items-center gap-2 text-amber-900">
                  <Sparkles size={20} />
                  <h2 className="text-xl font-bold bengali-serif">AI লেখক সহায়িকা</h2>
                </div>
                <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">লেখার মোড</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.values(AIModelMode).map(mode => (
                      <button 
                        key={mode}
                        onClick={() => setAiMode(mode)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                          aiMode === mode 
                            ? 'bg-amber-600 text-white border-amber-600' 
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mode === AIModelMode.BOLD ? '১৮+ ম্যাচুউর' : mode}
                      </button>
                    ))}
                  </div>
                  {aiMode === AIModelMode.BOLD && (
                    <p className="mt-2 text-[10px] text-amber-600 font-medium">
                      * ম্যাচুউর মোড জটিল আবেগ এবং প্রাপ্তবয়স্কদের উপযোগী বিষয়বস্তু নিয়ে লিখবে।
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">AI কে বলুন কী লিখতে হবে</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="যেমন: এরপর একটি নাটকীয় সংলাপ যোগ করো..."
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all bengali-serif text-slate-700"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button 
                    onClick={() => setShowAIModal(false)}
                    className="px-6 py-2 text-slate-500 font-medium hover:text-slate-700"
                  >
                    বাতিল
                  </button>
                  <button 
                    onClick={handleAIRequest}
                    disabled={!aiPrompt}
                    className="px-8 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50"
                  >
                    লিখুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
