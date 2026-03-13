import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Search, Bell, FileText, Upload, User, Calendar, 
  ListTodo, MessageSquare, Settings, LogOut, 
  CheckCircle2, Folder, ChevronDown, Activity, PlayCircle, Loader2, FileSearch, Send, X, ArrowRight,
  TrendingUp, Clock, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDocument, askQuestion } from './services/geminiService';
import { supabase } from './lib/supabase';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setAnalysis(null);
      setMessages([]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    multiple: false
  });

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const result = await analyzeDocument(base64, file.type);
        setAnalysis(result || "Não foi possível analisar o documento.");
        
        if (supabase) {
          try {
            await supabase.from('analyses').insert([{ file_name: file.name, result: result }]);
          } catch(e) { console.error('Supabase save error', e); }
        }

        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError("Erro ao analisar documento. Verifique sua chave API.");
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !analysis || chatLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const response = await askQuestion(analysis, userMessage);
      const assistantMsg = response || "Desculpe, não consegui processar.";
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);
      
      if (supabase) {
        try {
          await supabase.from('messages').insert([{ user_msg: userMessage, assist_msg: assistantMsg }]);
        } catch(e) { console.error('Supabase save error', e); }
      }

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro na conexão." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  const currentDate = new Date().toLocaleDateString('en-GB', { 
    weekday: 'short', 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-[#E9F0F8] flex items-center justify-center p-4 lg:p-8">
      
      {/* App Container */}
      <div className="w-full max-w-[1440px] h-[92vh] bg-[#F7F9FC] rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden flex relative border-8 border-white">
        
        {/* Sidebar */}
        <aside className="w-[100px] bg-white border-r border-slate-100 flex flex-col items-center py-10 shrink-0">
          <div className="w-14 h-14 bg-[#1E293B] rounded-2xl flex items-center justify-center mb-12 shadow-xl text-white transform hover:rotate-6 transition-transform cursor-pointer">
            <LayoutDashboardIcon className="w-7 h-7" />
          </div>
          
          <nav className="flex flex-col gap-10 flex-1 w-full items-center">
            <SidebarIcon icon={User} />
            <SidebarIcon icon={Calendar} />
            <SidebarIcon icon={ListTodo} active badge={3} />
            <SidebarIcon icon={MessageSquare} />
            <SidebarIcon icon={TrendingUp} />
          </nav>
          
          <div className="flex flex-col gap-8 w-full items-center mt-auto">
            <SidebarIcon icon={Settings} />
            <SidebarIcon icon={LogOut} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* Top Header */}
          <header className="px-12 pt-10 pb-6 flex items-end justify-between shrink-0">
            <div>
              <h1 className="text-[32px] font-bold text-[#1E293B] tracking-tight leading-tight">Welcome, Daniel!</h1>
              <p className="text-[14px] text-slate-400 font-semibold mt-1 uppercase tracking-wider">{currentDate}</p>
            </div>
            
            <div className="flex items-center gap-8">
              {/* Search Bar */}
              <div className="relative group">
                <Search className="w-5 h-5 text-slate-300 absolute left-5 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-[320px] pl-14 pr-6 py-3.5 bg-white border-none rounded-2xl text-[15px] focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-medium placeholder:text-slate-300 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                />
              </div>
              
              {/* Notifications */}
              <button className="relative w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-white transition-all shadow-[0_4px_20px_rgba(0,0,0,0.03)] group">
                <Bell className="w-6 h-6 group-hover:shake" />
                <span className="absolute top-4 right-4 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-white"></span>
              </button>
            </div>
          </header>

          {/* Dashboard Body */}
          <div className="flex-1 overflow-y-auto px-12 pb-10 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
              
              {/* Left Column: Profile & Team */}
              <div className="xl:col-span-3 flex flex-col gap-8">
                
                {/* Profile Card - Daniel Nixen style */}
                <div className="bg-[#6B9DF8] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-200">
                  <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                  <div className="absolute top-0 right-0 p-4 opacity-40">
                     <TrendingUp className="w-6 h-6" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-28 h-28 rounded-full border-[5px] border-white/30 p-1 mb-5">
                       <img src="https://i.imgur.com/8Q5Z2g7.jpg" alt="Daniel" className="w-full h-full rounded-full object-cover shadow-lg" />
                    </div>
                    <div className="text-center">
                       <h2 className="text-2xl font-bold tracking-tight mb-1">Daniel Nixen</h2>
                       <p className="text-blue-100/80 text-[14px] font-semibold mb-6">UI&UX designer</p>
                    </div>
                    
                    {/* Ring Progress */}
                    <div className="relative w-28 h-28 flex items-center justify-center mb-8">
                       <svg className="w-full h-full -rotate-90">
                         <circle cx="56" cy="56" r="50" className="stroke-white/20 fill-none" strokeWidth="8" />
                         <circle cx="56" cy="56" r="50" className="stroke-white fill-none" strokeWidth="8" strokeDasharray="314" strokeDashoffset="15.7" strokeLinecap="round" />
                       </svg>
                       <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-bold">95%</span>
                       </div>
                    </div>
                    
                    <button className="w-full py-4 bg-white/20 backdrop-blur-md text-white font-bold text-[14px] rounded-2xl flex items-center justify-center gap-2 hover:bg-white hover:text-blue-600 transition-all border border-white/30">
                      <span className="text-xl leading-none">+</span> Add your hobbies
                    </button>
                  </div>
                </div>

                {/* Team Section */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-bold text-[#1E293B]">Your team</h3>
                    <button className="text-[13px] text-slate-400 font-bold hover:text-blue-500 transition-colors uppercase tracking-wider">Show all</button>
                  </div>
                  <div className="flex justify-between">
                     <TeamAvatar name="Louise Green" role="Team-lead" img="https://i.imgur.com/w1v8XJ5.jpg" />
                     <TeamAvatar name="Mark Fell" role="Art director" img="https://i.imgur.com/vH3yJt8.jpg" />
                     <TeamAvatar name="Anna Fish" role="UI&UX designer" img="https://i.imgur.com/XqU7x58.jpg" />
                     <TeamAvatar name="Kevin Less" role="UI&UX designer" img="https://i.imgur.com/39P2R3x.jpg" />
                  </div>
                </div>

                {/* Courses Section */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-[#1E293B]">Courses</h3>
                    <button className="text-[13px] text-slate-400 font-bold hover:text-blue-500 transition-colors uppercase tracking-wider">Show all</button>
                  </div>
                  <div className="flex flex-col gap-4">
                     <CourseCardItem title="Webinar: Automation of Basic Processes" date="25 May, 11:00-12:00" />
                     <CourseCardItem title="Situational Leadership as a Necessity" date="23 May, 11:00-12:00" />
                  </div>
                </div>

              </div>

              {/* Center Column: Core UI */}
              <div className="xl:col-span-5 flex flex-col gap-8 h-full">
                
                {/* Top Status Cards */}
                <div className="grid grid-cols-2 gap-8">
                   <StatusCard title="Meetings" val="2/3" percent="66%" color="#A2DA27" />
                   <StatusCard title="Tasks completed" val="3/10" percent="32%" color="#A2DA27" />
                </div>

                {/* Main Action Area: Document Analyzer */}
                <div className="bg-white rounded-[32px] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50 flex-1 flex flex-col min-h-[420px] relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-8">
                     <div>
                       <div className="flex items-center gap-2 mb-2">
                         <Activity className="w-4 h-4 text-[#A2DA27]" />
                         <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">System Live</span>
                       </div>
                       <h3 className="text-3xl font-extrabold text-[#1E293B] tracking-tight">
                         Explica Fácil <span className="text-blue-500 font-light">Analyzer</span>
                       </h3>
                     </div>
                     <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl cursor-not-allowed">
                        <span className="text-[13px] font-bold text-slate-500">A week</span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                     </div>
                  </div>

                  {!file ? (
                    <div 
                      {...getRootProps()} 
                      className={`flex-1 w-full rounded-[24px] border-2 border-dashed flex flex-col items-center justify-center gap-6 transition-all cursor-pointer background-pattern
                        ${isDragActive ? 'border-blue-400 bg-blue-50/20' : 'border-slate-100 hover:border-blue-200 bg-slate-50/50'}`}
                    >
                      <input {...getInputProps()} />
                      <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-500' : 'text-slate-300'}`} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-[#1E293B]">
                          Selecione um documento
                        </p>
                        <p className="text-sm text-slate-400 font-medium mt-1">PDF, Imagens ou Texto (Max 20MB)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 w-full flex flex-col items-center justify-center gap-8 py-4">
                       <div className="relative group">
                          <div className="w-24 h-24 bg-blue-50 rounded-[32px] flex items-center justify-center border border-blue-100 shadow-sm overflow-hidden animate-in zoom-in-50 duration-300">
                             {file.type.startsWith('image/') ? (
                               <img src={URL.createObjectURL(file)} className="w-full h-full object-cover opacity-80" alt="Preview"/>
                             ) : (
                               <FileText className="w-10 h-10 text-blue-500" />
                             )}
                          </div>
                          <button 
                            onClick={reset} 
                            className="absolute -top-3 -right-3 w-8 h-8 bg-white text-slate-500 rounded-full shadow-lg border border-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                       </div>
                       
                       <div className="text-center">
                         <p className="text-xl font-bold text-[#1E293B] max-w-sm truncate">{file.name}</p>
                         <p className="text-sm text-slate-400 font-semibold uppercase mt-1">{(file.size / 1024).toFixed(1)} KB • {file.type.split('/')[1]}</p>
                       </div>
                       
                       <div className="flex gap-4">
                         {!analysis && !loading && (
                           <button
                             onClick={handleAnalyze}
                             className="px-10 py-4 bg-[#1E293B] text-white rounded-2xl font-bold text-[15px] shadow-2xl shadow-slate-200 hover:shadow-blue-200 hover:-translate-y-1 transition-all flex items-center gap-3"
                           >
                             Analyze Project <ArrowRight className="w-5 h-5" />
                           </button>
                         )}

                         {loading && (
                           <div className="flex items-center gap-4 px-8 py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold text-[15px]">
                             <Loader2 className="w-5 h-5 animate-spin" /> GPT-4o Analisando...
                           </div>
                         )}
                       </div>

                       {error && (
                         <div className="text-sm text-red-500 font-bold bg-red-50 px-6 py-3 rounded-2xl border border-red-100 shadow-sm animate-pulse">
                           {error}
                         </div>
                       )}
                    </div>
                  )}
                  
                  {/* Decorative faint bars at bottom like original */}
                  {!file && (
                     <div className="absolute bottom-10 left-10 right-10 flex justify-between items-end h-32 opacity-10 pointer-events-none px-6">
                        {[45, 65, 35, 90, 100, 55, 75, 40, 60, 80].map((h, i) => (
                           <div key={i} className="w-8 rounded-t-[12px] bg-[#1E293B]" style={{ height: `${h}%` }}></div>
                        ))}
                     </div>
                  )}
                </div>

                {/* Documents Bottom Bar */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50 mt-auto">
                   <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-bold text-[#1E293B]">Recent Documents</h3>
                    <button className="text-[13px] text-slate-400 font-bold hover:text-blue-500 transition-colors uppercase tracking-wider">Show all</button>
                  </div>
                  <div className="flex justify-between px-2">
                     <DocFolder label="Employment Contract.doc" />
                     <DocFolder label="Brand Style Docume...doc" />
                     <DocFolder label="New project.doc" />
                  </div>
                </div>

              </div>

              {/* Right Column: Tracker & Goals */}
              <div className="xl:col-span-4 bg-white rounded-[40px] p-10 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50 flex flex-col h-[78vh] min-h-[800px]">
                
                <div className="flex justify-between items-center mb-10 shrink-0">
                  <h3 className="text-2xl font-bold text-[#1E293B]">Project Tracker</h3>
                  <button className="text-[14px] text-slate-400 font-bold hover:text-blue-500 transition-colors uppercase tracking-widest">Details</button>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100/50 rounded-2xl p-1.5 mb-10 shrink-0 border border-slate-100">
                  <button className="flex-1 py-3 px-6 bg-white shadow-md rounded-xl text-[14px] text-[#1E293B] font-bold">Analysis</button>
                  <button className="flex-1 py-3 px-6 rounded-xl text-[14px] text-slate-400 font-bold hover:text-slate-600 transition-colors">Questions</button>
                  <button className="flex-1 py-3 px-6 rounded-xl text-[14px] text-slate-400 font-bold hover:text-slate-600 transition-colors">Log</button>
                </div>

                {/* Main Content Pane */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {!analysis ? (
                    <div className="flex-1 flex flex-col gap-8 overflow-y-auto pr-2 custom-scrollbar">
                       <TrackerTask 
                         title="Meet your team" 
                         subtitle="Introduction to the Core team" 
                         status="done" 
                         user="Louise Green"
                         time="Today, 10:00"
                        />
                       <TrackerTask 
                         title="Get access credentials" 
                         subtitle="System credentials for project" 
                         status="done" 
                         user="Louise Green"
                         time="Today"
                        />
                       <TrackerTask 
                         title="Upload First Document" 
                         subtitle="Start analyzing your files" 
                         status="active" 
                         tag="Do this first"
                         user="System"
                         time="Next task"
                        />
                       <TrackerTask 
                         title="Review Analysis" 
                         subtitle="Check AI findings" 
                         status="locked" 
                        />
                       
                       <div className="mt-auto pt-10 border-t border-slate-100">
                         <h4 className="text-xl font-bold text-[#1E293B] mb-4">Goals tracker</h4>
                         <p className="text-[14px] text-slate-400 leading-relaxed mb-10">These goals are designed to support your work progress during the week.</p>
                         <div className="flex flex-col gap-8">
                           <GoalProgressBar icon={User} title="Onboarding Complete" percent="72%" val={72} />
                           <GoalProgressBar icon={Clock} title="Time Allocated" percent="12%" val={12} />
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-10 duration-500">
                      
                      {/* Analysis Text Box */}
                      <div className="flex-1 overflow-y-auto pr-4 pb-8 border-b border-slate-100 custom-scrollbar mb-6">
                         <div className="flex items-center gap-3 mb-6">
                           <div className="w-10 h-10 bg-[#A2DA27]/10 rounded-xl flex items-center justify-center">
                              <CheckCircle2 className="w-6 h-6 text-[#A2DA27]" />
                           </div>
                           <h4 className="text-xl font-extrabold text-[#1E293B]">Analysis Report</h4>
                         </div>
                         <div className="prose prose-slate max-w-none text-[15px] leading-relaxed markdown-content">
                           <Markdown>{analysis}</Markdown>
                         </div>
                      </div>

                      {/* Interactive Chat Box */}
                      <div className="h-[280px] bg-slate-50 rounded-[24px] border border-slate-100 flex flex-col overflow-hidden shrink-0 shadow-inner">
                        <div className="px-6 py-4 border-b border-slate-200/50 flex items-center gap-3 bg-white/50 backdrop-blur-sm">
                           <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                           <span className="text-[14px] font-bold text-[#1E293B]">Expert Assistant</span>
                           <Info className="w-4 h-4 text-slate-300 ml-auto cursor-help" />
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 custom-scrollbar bg-slate-50/30">
                          {messages.length === 0 && (
                            <div className="text-center my-auto px-6">
                               <p className="text-[14px] text-slate-400 font-medium italic">
                                 "What are the main risks?" or "Summarize the financial terms..."
                               </p>
                            </div>
                          )}
                          <AnimatePresence initial={false}>
                            {messages.map((msg, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`max-w-[85%] p-4 rounded-[20px] text-[14px] shadow-sm leading-relaxed ${
                                  msg.role === 'user' 
                                    ? 'bg-[#1E293B] text-white rounded-tr-none' 
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none font-medium'
                                }`}>
                                  {msg.content}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-slate-100 p-4 rounded-[20px] rounded-tl-none flex gap-1.5 shadow-sm">
                                <span className="w-1.5 h-1.5 bg-blue-500/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Message Input Area */}
                        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 bg-white">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              placeholder="Ask a question..."
                              className="w-full pl-6 pr-14 py-4 bg-slate-50 border-none rounded-2xl text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold placeholder:text-slate-300"
                            />
                            <button
                              type="submit"
                              disabled={!input.trim() || chatLoading}
                              className="absolute right-2 p-2.5 bg-[#1E293B] text-white rounded-xl hover:bg-slate-800 disabled:opacity-20 transition-all hover:scale-105 active:scale-95 shadow-lg"
                            >
                              <Send className="w-5 h-5" />
                            </button>
                          </div>
                        </form>
                      </div>

                    </div>
                  )}
                  
                </div>

              </div>
              
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(0); }
          25% { transform: rotate(-10deg); }
          75% { transform: rotate(10deg); }
        }
        .group:hover .group-hover\\:shake {
          animation: shake 0.5s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        
        .background-pattern {
          background-image: radial-gradient(#E2E8F0 0.5px, transparent 0.5px);
          background-size: 20px 20px;
        }
        
        .markdown-content h1 { font-size: 1.4rem; font-weight: 900; color: #1E293B; margin: 1.5rem 0 1rem; }
        .markdown-content h2 { font-size: 1.1rem; font-weight: 800; color: #334155; margin: 1.2rem 0 0.8rem; border-bottom: 2px solid #F1F5F9; padding-bottom: 0.5rem; }
        .markdown-content p { color: #475569; margin-bottom: 1rem; line-height: 1.7; font-weight: 500; }
        .markdown-content ul { padding-left: 1.25rem; margin-bottom: 1.5rem; }
        .markdown-content li { margin-bottom: 0.5rem; position: relative; color: #475569; padding-left: 0.5rem; font-weight: 500; }
        .markdown-content li::before { content: "•"; color: #A2DA27; font-weight: bold; position: absolute; left: -1rem; }
        .markdown-content strong { color: #1E293B; font-weight: 700; }
        .markdown-content code { background: #F8FAFC; padding: 0.2rem 0.4rem; rounded: 0.25rem; color: #3B82F6; font-family: monospace; }
      `}</style>
    </div>
  );
}

// Visual Mini-Components

function SidebarIcon({ icon: Icon, active, badge }: any) {
  return (
    <div className={`relative p-4 rounded-3xl cursor-pointer transition-all duration-300 group ${active ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-300 hover:text-slate-600 hover:bg-slate-50'}`}>
      <Icon className={`w-[26px] h-[26px] ${active ? 'fill-blue-600/10' : ''}`} />
      {badge && (
        <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-[#3B82F6] text-white text-[11px] font-black flex items-center justify-center rounded-full border-[3px] border-white shadow-lg">
          {badge}
        </span>
      )}
      {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-blue-600 rounded-r-full"></div>}
    </div>
  );
}

function LayoutDashboardIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function TeamAvatar({ name, role, img }: any) {
  return (
    <div className="flex flex-col items-center group cursor-pointer">
       <div className="relative">
         <div className="w-14 h-14 rounded-full overflow-hidden ring-4 ring-transparent group-hover:ring-blue-500/20 transition-all duration-300">
           <img src={img} alt={name} className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all" />
         </div>
         <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg border border-slate-50">
           <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
             <ArrowRight className="w-2.5 h-2.5 text-white -rotate-45" />
           </div>
         </div>
       </div>
       <p className="text-[12px] font-black text-[#1E293B] mt-3 whitespace-nowrap opacity-80">{name.split(' ')[0]}</p>
       <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{role.split('-')[0]}</p>
    </div>
  );
}

function CourseCardItem({ title, date }: any) {
  return (
    <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-5 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group">
       <p className="text-[14px] font-bold text-[#1E293B] leading-snug mb-4 group-hover:text-blue-600 transition-colors">{title}</p>
       <div className="flex items-center gap-2 text-[12px] font-bold text-slate-400">
         <Calendar className="w-4 h-4 text-slate-300" />
         {date}
       </div>
    </div>
  );
}

function StatusCard({ title, val, percent, color }: any) {
  return (
    <div className="bg-white rounded-[24px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] border border-slate-50 hover:shadow-2xl transition-all duration-500 group">
      <div className="flex justify-between items-center mb-5">
        <span className="text-[15px] font-extrabold text-[#1E293B]/60 uppercase tracking-widest">{title}</span>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-colors">
           <TrendingUp className="w-4 h-4" />
        </div>
      </div>
      <div className="flex justify-between items-end">
        <span className="text-4xl font-black text-[#1E293B] tracking-tight">{val}</span>
        <span className="text-[14px] font-black text-slate-400">{percent}</span>
      </div>
      <div className="mt-5 w-full h-2.5 bg-slate-50 rounded-full overflow-hidden flex">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: percent, backgroundColor: color }}></div>
      </div>
    </div>
  );
}

function DocFolder({ label }: any) {
  return (
    <div className="flex flex-col items-center gap-3 cursor-pointer group">
       <div className="relative transform hover:scale-110 active:scale-95 transition-transform duration-300">
         <svg width="86" height="64" viewBox="0 0 86 64" fill="none" className="drop-shadow-xl overflow-visible">
            <path d="M0 8C0 3.58172 3.58172 0 8 0H32C34.2091 0 36 1.79086 36 4V4C36 6.20914 37.7909 8 40 8H78C82.4183 8 86 11.5817 86 16V56C86 60.4183 82.4183 64 78 64H8C3.58172 64 0 60.4183 0 56V8Z" fill="#93C5FD"/>
            <path d="M0 18C0 14.6863 2.68629 12 6 12H80C83.3137 12 86 14.6863 86 18V58C86 61.3137 83.3137 64 80 64H6C2.68629 64 0 61.3137 0 58V18Z" fill="#BFDBFE" fillOpacity="0.8"/>
            <path d="M0 26C0 22.6863 2.68629 20 6 20H80C83.3137 20 86 22.6863 86 26V58C86 61.3137 83.3137 64 80 64H6C2.68629 64 0 61.3137 0 58V26Z" fill="#DBEAFE"/>
         </svg>
       </div>
       <p className="text-[11px] font-black text-slate-500 text-center leading-tight truncate max-w-[80px] opacity-70">{label}</p>
    </div>
  );
}

function TrackerTask({ title, subtitle, status, tag, user, time }: any) {
  return (
    <div className="flex gap-6 items-start group relative">
       <div className="mt-1 relative z-10">
         {status === 'done' && <div className="w-6 h-6 bg-[#3B82F6] rounded-full flex items-center justify-center border-4 border-white shadow-lg shadow-blue-200"><CheckCircle2 className="w-3 h-3 text-white" /></div>}
         {status === 'active' && <div className="w-6 h-6 bg-white border-[6px] border-[#3B82F6] rounded-full shadow-lg shadow-blue-100 flex items-center justify-center animate-pulse"></div>}
         {status === 'locked' && <div className="w-6 h-6 bg-white border-2 border-slate-100 rounded-full"></div>}
       </div>
       
       {/* Vertical Line Connector */}
       <div className="absolute left-3 top-7 w-[2px] h-[calc(100%+12px)] bg-slate-50 group-last:hidden"></div>
       
       <div className="flex-1 pb-10 group-last:pb-0">
          <div className="flex justify-between items-start mb-2">
             <h4 className={`text-[16px] font-extrabold ${status === 'locked' ? 'text-slate-200' : 'text-[#1E293B]'}`}>{title}</h4>
             {tag && <span className="text-[10px] font-black text-white bg-blue-500 px-2 py-1 rounded-lg uppercase tracking-wider shadow-lg shadow-blue-200">{tag}</span>}
          </div>
          <p className="text-[14px] text-slate-400 font-bold mb-4">{subtitle}</p>
          {user && (
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-1.5 font-bold">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  <span className="text-[11px] text-slate-400 uppercase tracking-tight">{time}</span>
               </div>
               <div className="flex items-center gap-1.5 font-bold">
                  <div className="w-5 h-5 rounded-full bg-slate-100 p-0.5">
                     <div className="w-full h-full rounded-full bg-blue-400 overflow-hidden">
                        <User className="w-full h-full text-white p-0.5" />
                     </div>
                  </div>
                  <span className="text-[11px] text-slate-500 uppercase tracking-tighter">{user}</span>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}

function GoalProgressBar({ icon: Icon, title, percent, val }: any) {
  return (
    <div className="group">
       <div className="flex items-center gap-3 mb-3">
         <div className="w-10 h-10 bg-slate-100/50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
            <Icon className="w-5 h-5" />
         </div>
         <div className="flex-1">
            <div className="flex justify-between items-center mb-0.5">
               <span className="text-[14px] font-extrabold text-[#1E293B]">{title}</span>
               <span className="text-[14px] font-black text-slate-800">{percent}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-50 rounded-full flex overflow-hidden border border-slate-100">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${val}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-[#A2DA27] rounded-full shadow-[0_0_10px_rgba(162,218,39,0.3)]"
              ></motion.div>
            </div>
         </div>
       </div>
    </div>
  );
}
