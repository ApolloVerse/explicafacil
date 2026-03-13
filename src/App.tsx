import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Search, Bell, FileText, Upload, User, Calendar, 
  ListTodo, MessageSquare, Settings, LogOut, 
  CheckCircle2, Folder, ChevronDown, Activity, PlayCircle, Loader2, FileSearch, Send, X, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDocument, askQuestion } from './services/geminiService';
import { supabase } from './lib/supabase'; // Import Supabase Client

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
        
        // Save to Supabase (if configured)
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
      setError("Erro ao analisar documento.");
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
      
      // Save chat to Supabase (if configured)
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
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setMessages([]);
    setError(null);
  };

  const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center p-4 lg:p-8 font-sans">
      
      {/* App Container */}
      <div className="w-full max-w-[1400px] h-[90vh] bg-[#F7F9FC] rounded-[32px] shadow-2xl overflow-hidden flex shadow-blue-500/20 ring-1 ring-white/60 relative">
        
        {/* Sidebar */}
        <aside className="w-[84px] bg-white border-r border-slate-100 flex flex-col items-center py-8 z-10 shrink-0">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center mb-10 shadow-lg text-white">
            <LayoutDashboardIcon className="w-6 h-6" />
          </div>
          
          <nav className="flex flex-col gap-8 flex-1 w-full items-center">
            <SidebarIcon icon={User} />
            <SidebarIcon icon={Calendar} />
            <SidebarIcon icon={ListTodo} active badge={3} />
            <SidebarIcon icon={MessageSquare} />
          </nav>
          
          <div className="flex flex-col gap-6 w-full items-center mt-auto">
            <SidebarIcon icon={Settings} />
            <SidebarIcon icon={LogOut} />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#F7F9FC]">
          
          {/* Header */}
          <header className="px-10 py-8 flex items-end justify-between shrink-0">
            <div>
              <h1 className="text-[28px] font-medium text-slate-800 tracking-tight leading-tight">Welcome, Daniel!</h1>
              <p className="text-[13px] text-slate-500 font-medium mt-1">{currentDate}</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Search" 
                  className="w-64 pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium placeholder:text-slate-400 shadow-sm"
                />
              </div>
              
              {/* Notification */}
              <button className="relative w-11 h-11 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-blue-500 rounded-full border border-white"></span>
              </button>
            </div>
          </header>

          {/* Grid Content */}
          <div className="flex-1 overflow-y-auto px-10 pb-10 custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              
              {/* Column 1: Profile & Team (3 spans) */}
              <div className="xl:col-span-3 flex flex-col gap-6">
                
                {/* Profile Card */}
                <div className="bg-[#6B9DF8] rounded-[24px] p-6 text-white relative overflow-hidden shadow-lg shadow-blue-500/20">
                   {/* Decorative circle */}
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden bg-white mb-4 shadow-md">
                       <img src="https://i.imgur.com/8Q5Z2g7.jpg" alt="Daniel" className="w-full h-full object-cover" />
                    </div>
                    <h2 className="text-xl font-semibold tracking-wide">Daniel Nixen</h2>
                    <p className="text-blue-100 text-[13px] font-medium mb-5">UI&UX designer</p>
                    
                    <div className="w-full flex items-center gap-3 mb-6 bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                       <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                         <svg className="w-10 h-10 -rotate-90">
                           <circle cx="20" cy="20" r="16" className="stroke-white/20 fill-none" strokeWidth="4" />
                           <circle cx="20" cy="20" r="16" className="stroke-white fill-none" strokeWidth="4" strokeDasharray="100" strokeDashoffset="5" strokeLinecap="round" />
                         </svg>
                         <span className="absolute text-[10px] font-bold">95%</span>
                       </div>
                       <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                          <div className="w-[95%] h-full bg-white rounded-full"></div>
                       </div>
                    </div>
                    
                    <button className="w-full py-2.5 bg-white text-blue-600 font-semibold text-[13px] rounded-xl flex items-center justify-center gap-1.5 hover:bg-blue-50 transition-colors shadow-sm">
                      <span className="text-blue-500 text-lg leading-none">+</span> Add your hobbies to complete your profile!
                    </button>
                  </div>
                </div>

                {/* Your Team */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold text-slate-800">Your team</h3>
                    <button className="text-[13px] text-slate-400 font-medium hover:text-slate-600">Show all</button>
                  </div>
                  <div className="flex justify-between gap-1">
                     <TeamMember name="Louise Green" role="Team-lead" img="https://i.imgur.com/w1v8XJ5.jpg" />
                     <TeamMember name="Mark Fell" role="Art director" img="https://i.imgur.com/vH3yJt8.jpg" />
                     <TeamMember name="Anna Fish" role="UI&UX designer" img="https://i.imgur.com/XqU7x58.jpg" />
                  </div>
                </div>

                {/* Courses */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100">
                   <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold text-slate-800">Courses and webinars</h3>
                    <button className="text-[13px] text-slate-400 font-medium hover:text-slate-600">Show all</button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                     <CourseCard title="Webinar: Automation of Basic Processes" date="25 May, 11:00-12:00" />
                     <CourseCard title="Situational Leadership as a Necessity" date="23 May, 11:00-12:00" />
                  </div>
                </div>

              </div>

              {/* Column 2: Upload Area & Documents (5 spans) */}
              <div className="xl:col-span-5 flex flex-col gap-6 h-full">
                
                {/* Stats row */}
                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
                     <div className="flex justify-between items-center mb-4">
                       <span className="text-[13px] font-semibold text-slate-700">Meetings</span>
                       <Activity className="w-4 h-4 text-slate-400" />
                     </div>
                     <div className="flex justify-between items-end">
                       <span className="text-3xl font-bold text-slate-800 tracking-tight">2/3</span>
                       <span className="text-xs font-bold text-slate-500">66%</span>
                     </div>
                     <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full flex">
                       <div className="w-[66%] h-full bg-[#A2DA27] rounded-full"></div>
                       <div className="w-[10%] h-full bg-slate-200 rounded-full ml-1"></div>
                     </div>
                   </div>
                   <div className="bg-white rounded-[20px] p-5 shadow-sm border border-slate-100">
                     <div className="flex justify-between items-center mb-4">
                       <span className="text-[13px] font-semibold text-slate-700">Tasks completed</span>
                       <Activity className="w-4 h-4 text-slate-400" />
                     </div>
                     <div className="flex justify-between items-end">
                       <span className="text-3xl font-bold text-slate-800 tracking-tight">3/10</span>
                       <span className="text-xs font-bold text-slate-500">32%</span>
                     </div>
                     <div className="mt-3 w-full h-1.5 bg-slate-100 rounded-full flex">
                       <div className="w-[32%] h-full bg-[#A2DA27] rounded-full"></div>
                       <div className="w-[10%] h-full bg-slate-200 rounded-full ml-1"></div>
                     </div>
                   </div>
                </div>

                {/* App Core: Document Upload instead of Progress Chart */}
                <div className="bg-white rounded-[24px] p-8 shadow-sm border border-slate-100 flex-1 flex flex-col min-h-[340px] relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                     <div>
                       <h3 className="font-semibold text-slate-800 mb-1">Document Analyzer</h3>
                       <p className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                         Gemini AI <span className="text-[11px] font-bold px-2 py-0.5 bg-[#A2DA27]/20 text-green-700 rounded-md">Online</span>
                       </p>
                     </div>
                     <div className="flex items-center gap-1 text-[13px] font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg cursor-pointer">
                        Format <ChevronDown className="w-4 h-4" />
                     </div>
                  </div>

                  {!file ? (
                    <div 
                      {...getRootProps()} 
                      className={`flex-1 w-full mt-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all cursor-pointer bg-slate-50
                        ${isDragActive ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-blue-300'}`}
                    >
                      <input {...getInputProps()} />
                      <div className="bg-white p-4 rounded-2xl shadow-sm">
                        <Upload className={`w-8 h-8 ${isDragActive ? 'text-blue-500' : 'text-slate-400'}`} />
                      </div>
                      <div className="text-center">
                        <p className="text-[15px] font-medium text-slate-700">
                          Drop your document to analyze
                        </p>
                        <p className="text-sm text-slate-400 mt-1">Accepts PDF, JPG, PNG & TXT</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 w-full mt-4 flex flex-col items-center justify-center gap-5">
                       <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 relative">
                         <FileText className="w-8 h-8 text-blue-500" />
                         <button onClick={reset} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-sm border border-slate-200 hover:bg-red-50 hover:text-red-500">
                           <X className="w-3 h-3" />
                         </button>
                       </div>
                       <div className="text-center">
                         <p className="font-semibold text-slate-800 truncate max-w-xs">{file.name}</p>
                         <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                       </div>
                       
                       {!analysis && !loading && (
                         <button
                           onClick={handleAnalyze}
                           className="mt-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-semibold text-[15px] shadow-lg shadow-slate-900/20 hover:bg-slate-800 transition-all flex items-center gap-2"
                         >
                           Analyze Now <FileSearch className="w-4 h-4" />
                         </button>
                       )}

                       {loading && (
                         <div className="mt-2 flex items-center gap-3 text-blue-500 font-medium">
                           <Loader2 className="w-5 h-5 animate-spin" /> Abstracting data...
                         </div>
                       )}

                       {error && (
                         <div className="mt-2 text-sm text-red-500 font-medium bg-red-50 px-4 py-2 rounded-lg border border-red-100 text-center">
                           {error}
                         </div>
                       )}
                    </div>
                  )}
                  
                  {/* Faint bar chart background decoration like design */}
                  {!file && (
                     <div className="absolute bottom-6 left-8 right-8 flex justify-between items-end h-24 opacity-10 pointer-events-none px-4">
                        {[40, 60, 30, 80, 100, 50, 70].map((h, i) => (
                           <div key={i} className="w-6 rounded-t-full bg-slate-900" style={{ height: `${h}%` }}></div>
                        ))}
                     </div>
                  )}
                </div>

                {/* Documents Cards Bottom */}
                <div className="bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 mt-auto">
                   <div className="flex justify-between items-center mb-5">
                    <h3 className="font-semibold text-slate-800">Documents</h3>
                    <button className="text-[13px] text-slate-400 font-medium hover:text-slate-600">Show all</button>
                  </div>
                  <div className="flex justify-between gap-4">
                     <FolderCard name="Employment Contract.doc" color="blue" />
                     <FolderCard name="Brand Style Docume...doc" color="blue" />
                     <FolderCard name="New project.doc" color="blue" />
                  </div>
                </div>

              </div>

              {/* Column 3: "Task tracker" replaced by Analysis Chat (4 spans) */}
              <div className="xl:col-span-4 bg-white rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-12rem)] min-h-[700px]">
                
                <div className="flex justify-between items-center mb-6 shrink-0">
                  <h3 className="font-semibold text-slate-800 text-lg">Ai Assistant Tracker</h3>
                  <button className="text-[13px] text-slate-400 font-medium hover:text-slate-600">Show all</button>
                </div>

                {/* Tracker Tabs */}
                <div className="flex items-center gap-1 bg-slate-50 rounded-full p-1 mb-6 shrink-0 border border-slate-100">
                  <button className="flex-1 py-1.5 px-4 bg-white shadow-sm rounded-full text-[13px] text-slate-800 font-semibold border border-slate-200">Analysis</button>
                  <button className="flex-1 py-1.5 px-4 rounded-full text-[13px] text-slate-500 font-medium hover:text-slate-700">Q&A Chat</button>
                  <button className="flex-1 py-1.5 px-4 rounded-full text-[13px] text-slate-500 font-medium hover:text-slate-700">History</button>
                </div>

                {/* Main Content of Right Panel */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  
                  {!analysis ? (
                    // Placeholder when no analysis
                    <div className="flex-1 flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar">
                       <TrackerItem 
                         title="Analyze a document to start" 
                         subtitle="Upload via the central panel" 
                         status="pending" 
                         tag="Do this first" 
                         userImg="https://i.imgur.com/w1v8XJ5.jpg"
                         userName="System"
                       />
                       <TrackerItem 
                         title="Ask questions about the content" 
                         subtitle="Get immediate answers from Gemini" 
                         status="locked" 
                       />
                       <TrackerItem 
                         title="Store the data securely" 
                         subtitle="Synced via Supabase database" 
                         status="locked" 
                       />
                       
                       <div className="mt-auto pt-6 border-t border-slate-100">
                         <h4 className="font-semibold text-slate-800 mb-4">Goals tracker</h4>
                         <p className="text-[13px] text-slate-500 leading-relaxed mb-4">These tools are designed to support your work flow during the first 2 weeks.</p>
                         <div className="flex flex-col gap-4">
                           <GoalItem icon={User} title="Get to know the AI" percent="72%" progress="72%" />
                           <GoalItem icon={Settings} title="Upload your first doc" percent="0%" progress="0%" />
                         </div>
                       </div>
                    </div>
                  ) : (
                    // Actual Document Analysis Result & Chat
                    <div className="flex-1 flex flex-col min-h-0">
                      
                      {/* Read-only Analysis Result */}
                      <div className="flex-1 overflow-y-auto pr-2 pb-4 mb-4 border-b border-slate-100 custom-scrollbar">
                         <div className="flex items-center gap-3 mb-4">
                           <CheckCircle2 className="w-5 h-5 text-[#A2DA27]" />
                           <h4 className="font-semibold text-slate-800 text-[15px]">Analysis Complete</h4>
                         </div>
                         <div className="prose prose-sm prose-slate max-w-none text-[13.5px] leading-relaxed markdown-style">
                           <Markdown>{analysis}</Markdown>
                         </div>
                      </div>

                      {/* Q&A Chat Section */}
                      <div className="h-[240px] flex flex-col bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden shrink-0">
                        <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2 bg-white">
                           <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                           <span className="text-[13px] font-semibold text-slate-700">Ask Gemini</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                          {messages.length === 0 && (
                            <p className="text-[13px] text-slate-400 text-center m-auto px-4 italic">
                              Ask specific questions like "What is the penalty?" or "Summarize chapter 2".
                            </p>
                          )}
                          <AnimatePresence initial={false}>
                            {messages.map((msg, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div className={`max-w-[85%] p-2.5 rounded-2xl text-[13px] shadow-sm ${
                                  msg.role === 'user' 
                                    ? 'bg-slate-900 text-white rounded-tr-none' 
                                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                                }`}>
                                  {msg.content}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none flex gap-1 shadow-sm">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>

                        {/* Chat Input */}
                        <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-100 bg-white">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              value={input}
                              onChange={(e) => setInput(e.target.value)}
                              placeholder="Type a message..."
                              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all font-medium placeholder:text-slate-400"
                            />
                            <button
                              type="submit"
                              disabled={!input.trim() || chatLoading}
                              className="absolute right-2 p-1.5 bg-transparent text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                              <Send className="w-4 h-4" />
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
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .markdown-style h1, .markdown-style h2 { font-size: 1.1em; font-weight: 700; margin-bottom: 0.5em; color: #1e293b; }
        .markdown-style p { margin-bottom: 0.8em; color: #475569; }
        .markdown-style ul { list-style: disc; margin-left: 1.2em; margin-bottom: 1em; color: #475569; }
        .markdown-style strong { color: #1e293b; }
      `}</style>
    </div>
  );
}

// Mini Components to match Design Elements

function SidebarIcon({ icon: Icon, active, badge }: { icon: any, active?: boolean, badge?: number }) {
  return (
    <div className={`relative p-3 rounded-full cursor-pointer transition-colors ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}>
      <Icon className="w-[22px] h-[22px]" />
      {badge && (
        <span className="absolute top-1 right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
          {badge}
        </span>
      )}
    </div>
  );
}

function LayoutDashboardIcon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function TeamMember({ name, role, img }: { name: string, role: string, img: string }) {
  return (
    <div className="flex flex-col items-center">
       <div className="relative w-11 h-11 rounded-full overflow-hidden border border-slate-100 bg-slate-50 group cursor-pointer hover:ring-2 hover:ring-blue-500/50 transition-all shadow-sm">
         <img src={img} alt={name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
         <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full">
           <div className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
             <ArrowRight className="w-2 h-2 text-white -rotate-45" />
           </div>
         </div>
       </div>
       <p className="text-[12px] font-semibold text-slate-800 mt-2 truncate max-w-[60px]">{name}</p>
       <p className="text-[10px] text-slate-400 font-medium">{role}</p>
    </div>
  );
}

function CourseCard({ title, date }: { title: string, date: string }) {
  return (
    <div className="min-w-[150px] bg-slate-50 border border-slate-100 rounded-xl p-4 shrink-0 transition-transform hover:-translate-y-1 cursor-pointer">
       <p className="text-[13px] font-semibold text-slate-800 leading-tight mb-3">{title}</p>
       <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
         <Calendar className="w-3 h-3 text-slate-400" />
         {date}
       </div>
    </div>
  );
}

function FolderCard({ name, color }: { name: string, color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
       <div className="relative">
         <svg width="74" height="54" viewBox="0 0 74 54" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-105 transition-transform drop-shadow-sm">
            <path d="M0 6C0 2.68629 2.68629 0 6 0H26.5412C28.47 0 30.2764 0.934444 31.396 2.51351L34.1983 6.46581C35.3178 8.04488 37.1242 8.97932 39.0531 8.97932H68C71.3137 8.97932 74 11.6656 74 14.9793V48C74 51.3137 71.3137 54 68 54H6C2.68629 54 0 51.3137 0 48V6Z" fill="#93C5FD"/>
            <path d="M0 16C0 12.6863 2.68629 10 6 10H68C71.3137 10 74 12.6863 74 16V48C74 51.3137 71.3137 54 68 54H6C2.68629 54 0 51.3137 0 48V16Z" fill="#BFDBFE" fillOpacity="0.8"/>
            <path d="M0 24C0 20.6863 2.68629 18 6 18H68C71.3137 18 74 20.6863 74 24V48C74 51.3137 71.3137 54 68 54H6C2.68629 54 0 51.3137 0 48V24Z" fill="#DBEAFE"/>
         </svg>
       </div>
       <p className="text-[11px] font-medium text-slate-600 text-center leading-tight truncate max-w-[70px]">{name}</p>
    </div>
  );
}

function TrackerItem({ title, subtitle, status, tag, userImg, userName }: any) {
  return (
    <div className="flex gap-4 items-start group">
       <div className="mt-1">
         {status === 'pending' && <div className="w-[18px] h-[18px] rounded-full border-2 border-blue-500 bg-white shadow-sm flex items-center justify-center"><div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div></div>}
         {status === 'completed' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
         {status === 'locked' && <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-200 bg-white"></div>}
       </div>
       <div className="flex-1 border-b border-slate-100 pb-4 group-last:border-0">
          <div className="flex justify-between items-start mb-1">
             <h4 className={`text-[14px] font-semibold ${status === 'locked' ? 'text-slate-400' : 'text-slate-800'}`}>{title}</h4>
             {tag && <span className="text-[11px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><span className="text-blue-400 text-sm">✦</span> {tag}</span>}
          </div>
          <p className="text-[12px] text-slate-500 mb-2">{subtitle}</p>
          {userImg && (
            <div className="flex items-center gap-2">
               <span className="text-[11px] text-slate-400 font-medium">Deadline: Today</span>
               <div className="flex items-center gap-1">
                  <img src={userImg} alt="" className="w-4 h-4 rounded-full object-cover grayscale" />
                  <span className="text-[11px] text-slate-600 font-medium">{userName}</span>
               </div>
            </div>
          )}
       </div>
    </div>
  );
}

function GoalItem({ icon: Icon, title, percent, progress }: any) {
  return (
    <div>
       <div className="flex items-center gap-2 mb-2">
         <Icon className="w-4 h-4 text-slate-400" />
         <span className="text-[13px] font-medium text-slate-700">{title}</span>
         <span className="ml-auto text-[13px] font-bold text-slate-800">{percent}</span>
       </div>
       <div className="w-full h-1.5 bg-slate-100 rounded-full flex overflow-hidden">
         <div className="h-full bg-[#A2DA27] rounded-full" style={{ width: progress }}></div>
       </div>
    </div>
  );
}
