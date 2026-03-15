import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  FileText, CheckCircle2, Loader2, Send, X, History, Home as HomeIcon, Upload, Search, Filter, 
  MoreVertical, PlayCircle, Bell, User, Lock, Mail, Github, LogOut, Star, TrendingUp, ChevronRight,
  ShieldCheck, CreditCard, Zap, Check, ArrowLeft, Camera, Shield, HelpCircle, Trash2, Pill, Stethoscope, Scale, Receipt, QrCode, Phone, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDocument, askQuestion, analyzeDocumentStream } from './services/geminiService';
import { paymentService, type PixPaymentResponse } from './services/paymentService';
import { supabase, supabaseConfigured } from './lib/supabase';

// --- Configuration ---
const PREFER_MOCK = false; 

// --- Types ---
interface Message { role: 'user' | 'assistant'; content: string; }
interface AnalysisItem { id: string; file_name: string; result: string; created_at: string; }
interface UserProfile {
  id: string;
  name?: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  plan_tier: 'free' | 'premium';
  analysis_count: number;
  analysis_limit: number;
  premium_expires_at?: string;
}
type TabType = 'inicio' | 'historico' | 'explicações' | 'perfil' | 'planos' | 'pagamento';

// --- Mock Storage Helpers ---
const getLocalHistory = (): AnalysisItem[] => JSON.parse(localStorage.getItem('explica_history') || '[]');
const saveLocalHistory = (history: AnalysisItem[]) => localStorage.setItem('explica_history', JSON.stringify(history));
const getLocalProfile = (email: string, name: string = '', phone: string = ''): UserProfile => JSON.parse(localStorage.getItem(`explica_profile_${email}`) || `{"id":"mock-${Date.now()}","name":"${name}","email":"${email}","phone":"${phone}","plan_tier":"free","analysis_count":0,"analysis_limit":3}`);
const saveLocalProfile = (profile: UserProfile) => localStorage.setItem(`explica_profile_${profile.email}`, JSON.stringify(profile));

const sessionId = (() => {
  const stored = localStorage.getItem('explica_session_id');
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem('explica_session_id', newId);
  return newId;
})();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('inicio');
  const [historyTabPreselected, setHistoryTabPreselected] = useState<AnalysisItem | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // App Logic State
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisItem[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  // -- Supabase Auth & Data Sync --
  const syncedRef = useRef(false);

  useEffect(() => {
    // Se o Supabase não está configurado, mostra a tela de login imediatamente
    if (!supabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      console.log(`[AUTH] Event: ${event}`);
      setSession(newSession);
      
      if (newSession?.user) {
        if (!syncedRef.current || !profile) {
          await syncUserData(newSession.user);
          syncedRef.current = true;
        }
      } else {
        setProfile(null);
        setAnalysisHistory([]);
        syncedRef.current = false;
      }
      
      setAuthLoading(false);
    });

    const initAuth = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (mounted && s) {
          setSession(s);
          await syncUserData(s.user);
          syncedRef.current = true;
        }
      } catch (err) {
        console.warn("[AUTH] Initial session check failed.");
      } finally {
        setTimeout(() => { if (mounted) setAuthLoading(false); }, 1500);
      }
    };

    initAuth();

    const safetyTimer = setTimeout(() => {
      if (mounted && authLoading) {
        setAuthLoading(false);
      }
    }, 6000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  // Single Device Login: Monitor session changes in a dedicated effect
  useEffect(() => {
    if (!profile?.id) return;

    console.log("[SESSION] Starting monitoring for user:", profile.id);
    const channel = supabase
      .channel(`session_sync_${profile.id}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public',
        table: 'profiles', 
        filter: `id=eq.${profile.id}` 
      }, (payload) => {
        const newSessionId = payload.new.current_session_id;
        console.log("[SESSION] DB Change detected:", newSessionId, "vs Local:", sessionId);
        
        // Se o novo session_id for diferente do local, e este dispositivo JÁ tinha um session_id salvo
        if (newSessionId && newSessionId !== sessionId) {
          alert("Sua conta foi acessada em outro dispositivo. Você será deslogado para sua segurança.");
          handleLogout();
        }
      })
      .subscribe((status) => {
        console.log("[SESSION] Subscription status:", status);
      });

    return () => {
      console.log("[SESSION] Cleaning up monitoring");
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const syncUserData = async (authUser: any) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const metadata = authUser.user_metadata;
      
      // Se o perfil não existir ou faltar dados básicos, usamos metadados do Google
      if (!data || !data.name || (!data.avatar_url && (metadata?.avatar_url || metadata?.picture))) {
        const updates: any = {};
        if (!data?.name && (metadata?.full_name || metadata?.name)) {
          updates.name = metadata.full_name || metadata.name;
        }
        if (!data?.avatar_url && (metadata?.avatar_url || metadata?.picture)) {
          updates.avatar_url = metadata.avatar_url || metadata.picture;
        }

        if (Object.keys(updates).length > 0) {
          console.log("[SYNC] Permitting upsert with:", updates);
          const { data: updated, error: upsertError } = await supabase
            .from('profiles')
            .upsert({ id: authUser.id, email: authUser.email, ...updates }, { onConflict: 'id' })
            .select()
            .single();
          
          if (updated) {
            data = updated;
            console.log("[SYNC] Profile successfully upserted.");
          }
          if (upsertError) {
            console.error("[SYNC] Upsert error (Check RLS for INSERT):", upsertError);
          }
        }
      }

      if (data) {
        setProfile(data);
        
        // Single Device Login: Update current session
        if (data.current_session_id !== sessionId) {
          supabase.from('profiles').update({ current_session_id: sessionId }).eq('id', authUser.id).then();
        }

        // Fetch History
        const { data: history } = await supabase
          .from('analyses')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });
        if (history) setAnalysisHistory(history);
      }
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const fetchHistory = () => {
    if (profile?.plan_tier === 'premium') {
      setAnalysisHistory(getLocalHistory());
    } else {
      setAnalysisHistory([]);
    }
  };

  const handleLoginGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { 
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setAnalysisHistory([]);
    setActiveTab('inicio');
  };

  const handleAnalyze = async () => {
    if (!file || !session?.user || !profile) return;
    if (profile.plan_tier === 'free' && profile.analysis_count >= profile.analysis_limit) {
      setError("Limite gratuito atingido!");
      setActiveTab('planos');
      return;
    }

    setLoading(true);
    setError(null);
    setAnalysis(""); // Start empty for streaming
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        let accumulatedResult = "";
        let firstChunk = true;

        try {
          const stream = analyzeDocumentStream(base64, file.type);
          
          for await (const chunk of stream) {
            if (firstChunk) {
              setLoading(false);
              setActiveTab('explicações');
              firstChunk = false;
            }
            accumulatedResult += chunk;
            setAnalysis(accumulatedResult);
          }

          // DB SAVE: Save analysis to History
          const { data: newEntry } = await supabase
            .from('analyses')
            .insert({
              user_id: session.user.id,
              file_name: file.name,
              result: accumulatedResult
            })
            .select()
            .single();

          if (newEntry) {
            setAnalysisHistory(prev => [newEntry, ...prev]);
          }

          // DB UPDATE: Increment count
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .update({ analysis_count: profile.analysis_count + 1 })
            .eq('id', session.user.id)
            .select()
            .single();

          if (updatedProfile) setProfile(updatedProfile);

        } catch (err: any) {
          console.error("Stream error details:", err);
          const errorMsg = err.message || "Erro desconhecido";
          setError(`Erro na conexão com a IA: ${errorMsg}`);
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
      setError("Erro ao ler o arquivo.");
    }
  };

  const handleDeleteHistory = async (id: string) => {
    if (window.confirm('Excluir esta análise definitivamente?')) {
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (!error) {
        setAnalysisHistory(prev => prev.filter(item => item.id !== id));
      }
    }
  };

  const handleUpdatePhoto = async (file: File) => {
    const currentUserId = session?.user?.id;
    if (!currentUserId) {
      alert("Erro: Usuário não identificado. Por favor, saia e entre novamente.");
      return;
    }
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${currentUserId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const finalUrl = `${publicUrl}?t=${Date.now()}`;

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: currentUserId,
          avatar_url: finalUrl,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

      if (updateError) throw updateError;
      
      setProfile(updatedProfile);
      alert('Foto atualizada com sucesso!');
    } catch (error: any) {
      alert('Erro ao carregar foto: ' + error.message);
    }
  };

  const navItems = [
    { id: 'inicio', icon: HomeIcon, label: 'INÍCIO' },
    { id: 'historico', icon: History, label: 'HISTÓRICO' },
    { id: 'planos', icon: Zap, label: 'PLANO' },
    { id: 'perfil', icon: User, label: 'PERFIL' }
  ];

  const handleNavClick = (tab: TabType) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const renderScreen = () => {
    const variants = {
      initial: { opacity: 0, x: 20, scale: 0.98 },
      animate: { opacity: 1, x: 0, scale: 1 },
      exit: { opacity: 0, x: -20, scale: 0.98 }
    };

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="h-full"
        >
          {(() => {
            switch (activeTab) {
              case 'inicio': return <ScreenInicio {...{file, setFile, loading, error, setError, handleAnalyze, profile}} />;
              case 'historico': return <ScreenHistorico history={analysisHistory} profile={profile} onView={(item) => { setAnalysis(item.result); setActiveTab('explicações'); }} onNew={() => setActiveTab('inicio')} onGoPlans={() => setActiveTab('planos')} onDelete={handleDeleteHistory} />;
              case 'perfil':
                return <ScreenPerfil 
                  user={session.user} 
                  profile={profile} 
                  onLogout={handleLogout} 
                  onUpgrade={() => setActiveTab('planos')}
                  onUpdatePhoto={handleUpdatePhoto}
                  setProfile={setProfile}
                />;
              case 'planos': return <ScreenPlanos profile={profile} onSelect={() => setActiveTab('pagamento')} onBack={() => setActiveTab('inicio')} />;
              case 'pagamento': return <ScreenPagamento user={session.user} onBack={() => setActiveTab('planos')} onConfirm={async () => {
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 30);
                
                // Security Audit in Supabase
                await supabase.from('payments').insert({
                  user_id: session.user.id,
                  amount: 19.90,
                  method: 'pix'
                });

                const { data: updated } = await supabase
                  .from('profiles')
                  .update({ 
                    plan_tier: 'premium', 
                    premium_expires_at: expiresAt.toISOString() 
                  })
                  .eq('id', session.user.id)
                  .select()
                  .single();

                if (updated) setProfile(updated);
                setActiveTab('perfil');
              }} />;
              case 'explicações': return <ScreenExplicacoes analysis={analysis} messages={messages} setMessages={setMessages} input={input} setInput={setInput} chatLoading={chatLoading} setChatLoading={setChatLoading} chatEndRef={chatEndRef} onBack={() => { setAnalysis(null); setMessages([]); setActiveTab(profile?.plan_tier === 'premium' ? 'historico' : 'inicio'); }} />;
              default: return <ScreenInicio {...{file, setFile, loading, error, setError, handleAnalyze, profile}} />;
            }
          })()}
        </motion.div>
      </AnimatePresence>
    );
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="animate-spin text-green-500 w-12 h-12" /></div>;
  if (!session) return <ScreenAuth onLoginGoogle={handleLoginGoogle} />;

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex font-sans overflow-hidden">
      {PREFER_MOCK && <div className="fixed top-4 left-4 z-[9999] bg-[#1E293B] text-white text-[10px] px-3 py-1 rounded-full font-black shadow-2xl border border-slate-700">PROTO-LOCAL</div>}
      
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden md:flex w-72 bg-white border-r border-slate-200 flex-col h-screen fixed top-0 left-0 z-40">
        <div className="p-8 flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="w-12 h-12 rounded-2xl shadow-lg transform rotate-3" />
          <h1 className="text-2xl font-black text-[#1E293B] tracking-tighter uppercase">ExplicaFácil</h1>
        </div>

        <nav className="flex-1 px-4 flex flex-col gap-2 mt-4">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as TabType)}
              className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-black transition-all ${
                activeTab === item.id 
                  ? 'bg-green-50 text-[#22C55E]' 
                  : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-sm tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
           <div className={`p-4 rounded-3xl flex items-center gap-4 ${profile?.plan_tier === 'premium' ? 'bg-[#1E293B] text-white' : 'bg-slate-100 text-slate-500'}`}>
              <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                 {profile?.plan_tier === 'premium' ? <ShieldCheck className="w-5 h-5 text-green-400" /> : <Star className="w-5 h-5 text-slate-400" />}
              </div>
              <div className="flex flex-col">
                 <span className="text-[10px] uppercase font-black tracking-widest opacity-60">Plano Atual</span>
                 <span className="text-sm font-black capitalize">{profile?.plan_tier}</span>
              </div>
           </div>
           <div className="mt-4 text-center">
             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">v1.2</span>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:pl-72 w-full transition-all">
        
        {/* Mobile Top Bar */}
        <div className="md:hidden bg-white/90 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <img src="/logo.png" alt="Logo" className="w-10 h-10 rounded-xl shadow-md transform rotate-3" />
             <h1 className="text-xl font-black text-[#1E293B] tracking-tighter uppercase">ExplicaFácil</h1>
           </div>
           <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-slate-50 text-slate-600 rounded-xl">
             {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
           </button>
        </div>

        {/* Mobile Side Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              />
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="md:hidden fixed top-0 right-0 bottom-0 w-4/5 max-w-sm bg-white z-50 shadow-2xl flex flex-col"
              >
                <div className="p-6 flex justify-between items-center border-b border-slate-100">
                   <span className="text-xs font-black text-slate-400 tracking-widest uppercase">Menu</span>
                   <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400"><X /></button>
                </div>
                <nav className="flex-1 p-6 flex flex-col gap-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id as TabType)}
                      className={`flex items-center gap-4 px-6 py-5 rounded-2xl font-black transition-all ${
                        activeTab === item.id 
                          ? 'bg-green-50 text-[#22C55E]' 
                          : 'text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon className="w-6 h-6" />
                      <span className="text-base tracking-wider">{item.label}</span>
                    </button>
                  ))}
                </nav>
                <div className="p-6 text-center border-t border-slate-50">
                   <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">v1.2</span>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Dynamic Screen Content Container */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-[#F0F2F5] pb-24 md:pb-8 relative">
           <div className="max-w-4xl mx-auto w-full p-6 md:p-10 min-h-full">
              {renderScreen()}
           </div>
        </div>


      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .dash-border { background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='40' ry='40' stroke='%2322C55E' stroke-width='4' stroke-dasharray='16%2c 16' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e"); border-radius: 40px; }
        .markdown-content h1 { font-size: 1.6rem; font-weight: 900; color: #1E293B; margin: 1.5rem 0 1rem; border-bottom: 2px solid #F1F5F9; padding-bottom: 0.5rem; }
        .markdown-content h2 { font-size: 1.2rem; font-weight: 800; color: #1E293B; margin: 1.5rem 0 0.75rem; display: flex; items-center; gap: 0.5rem; }
        .markdown-content h3 { font-size: 1rem; font-weight: 800; color: #475569; margin: 1.25rem 0 0.5rem; }
        .markdown-content p { color: #475569; margin-bottom: 1rem; line-height: 1.8; font-size: 1rem; font-weight: 500; }
        .markdown-content strong { color: #1E293B; font-weight: 800; }
        .markdown-content ul, .markdown-content ol { margin-bottom: 1.25rem; padding-left: 1.25rem; }
        .markdown-content li { margin-bottom: 0.5rem; color: #475569; font-weight: 500; line-height: 1.6; }
        .markdown-content hr { border: 0; border-top: 2px dashed #E2E8F0; margin: 2rem 0; }
        .markdown-content blockquote { border-left: 4px solid #22C55E; padding-left: 1rem; font-style: italic; color: #64748B; margin-bottom: 1rem; }
      `}</style>
    </div>
  );
}

// --- Screens Components ---

function ScreenAuth({ onLoginGoogle }: any) {
  const [authError] = useState('');

  return (
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center justify-center p-6 w-full">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white p-12 rounded-[48px] shadow-2xl shadow-green-900/5 max-w-[480px] w-full flex flex-col items-center text-center">
        <motion.div 
          animate={{ 
            y: [0, -10, 0],
            rotate: [3, 6, 3] 
          }} 
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          className="mb-8"
        >
          <img src="/logo.png" alt="Logo" className="w-24 h-24 rounded-[32px] shadow-xl shadow-green-200" />
        </motion.div>
        <h1 className="text-5xl font-black text-[#1E293B] mb-4 tracking-tighter uppercase">ExplicaFácil</h1>
        <p className="text-slate-400 font-bold mb-12 leading-relaxed text-sm px-4">Simplificando documentos complexos para você com inteligência artificial.</p>
        
        <div className="w-full flex flex-col gap-5">
           {authError && <div className="text-red-500 text-sm font-bold text-center px-4 py-3 bg-red-50 rounded-2xl">{authError}</div>}
           
           <button onClick={onLoginGoogle} className="w-full bg-[#1E293B] text-white py-6 rounded-[32px] font-black shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all flex items-center justify-center gap-4">
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale invert" alt="Google" /> CONTINUAR COM GOOGLE
           </button>
        </div>
        
        <p className="mt-12 text-[10px] text-slate-300 font-bold leading-loose uppercase tracking-widest">Ao continuar, você concorda com nossos <br/> <span className="text-[#22C55E] cursor-pointer hover:underline">Termos de Uso</span> e <span className="text-[#22C55E] cursor-pointer hover:underline">Privacidade</span></p>
        <div className="mt-4">
           <span className="text-[10px] font-bold text-slate-200 uppercase tracking-widest">v1.2</span>
        </div>
      </motion.div>
    </div>
  );
}

function ScreenInicio({ file, setFile, loading, error, setError, handleAnalyze, profile }: any) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => { if (accepted.length > 0) { setFile(accepted[0]); setError?.(null); } },
    accept: { 'image/*': ['.jpeg', '.jpg', '.png'], 'application/pdf': ['.pdf'] }
  });

  return (
    <div className="flex flex-col gap-10 md:gap-14 bg-white p-6 md:p-12 rounded-[40px] shadow-sm">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover" />
          ) : (
            <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center shadow-lg"><User className="text-white w-6 h-6" /></div>
          )}
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Olá,</span>
            <span className="text-lg font-black text-[#1E293B] tracking-tight leading-none">{profile?.name || 'Explorador'}</span>
          </div>
        </div>
        <div className={`px-5 py-2.5 rounded-full border flex items-center gap-2.5 ${profile?.plan_tier === 'premium' ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}>
           <Star className={`w-4 h-4 ${profile?.plan_tier === 'premium' ? 'text-green-600 fill-green-600' : 'text-slate-400'}`} />
           <span className={`text-[11px] font-black uppercase tracking-widest ${profile?.plan_tier === 'premium' ? 'text-green-700' : 'text-slate-500'}`}>{profile?.plan_tier}</span>
        </div>
      </header>

      <div className="text-center px-2">
        <h2 className="text-[44px] leading-[1] font-black text-[#1E293B] mb-6 tracking-tight">Qual documento <br/><span className="text-green-500">vamos ler agora?</span></h2>
      </div>

      <div {...getRootProps()} className={`relative h-[480px] w-full dash-border flex flex-col items-center justify-center p-8 transition-all duration-300 ${isDragActive ? 'bg-green-50 scale-102' : 'bg-white shadow-inner'}`}>
         <input {...getInputProps()} />
         <div className="w-28 h-28 bg-[#22C55E] rounded-full flex items-center justify-center shadow-2xl shadow-green-200 mb-8 mt-[-10px] animate-bounce-slow"><Upload className="text-white w-10 h-10" /></div>
         <p className="text-[22px] font-black text-[#1E293B] text-center mb-2 px-10">Envie o arquivo aqui</p>
         <p className="text-slate-400 font-bold text-sm mb-12">PDF, JPEG ou PNG até 20MB</p>
         <button className="px-12 py-5 bg-white text-[#22C55E] font-black text-base rounded-full shadow-xl border border-slate-50 hover:scale-105 transition-transform">SELECIONAR ARQUIVO</button>

         {file && (
           <div className="absolute inset-0 bg-white/98 rounded-[40px] flex flex-col items-center justify-center p-8 z-10">
              <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 shadow-xl"><FileText className="w-12 h-12 text-blue-500" /></div>
              <p className="text-xl font-black text-[#1E293B] mb-6 px-6 text-center leading-tight">{file.name}</p>
              
              {error && (
                <div className="w-full px-6 mb-6">
                  <div className="bg-red-50 text-red-500 px-4 py-3 rounded-2xl font-bold text-sm text-center border border-red-100 flex items-center justify-center gap-2">
                    <X className="w-4 h-4" /> {error}
                  </div>
                </div>
              )}

              {!loading ? (
                <div className="flex flex-col gap-4 w-full px-6">
                  <button onClick={(e) => {e.stopPropagation(); handleAnalyze();}} className="w-full py-6 bg-[#22C55E] text-white font-black rounded-3xl shadow-2xl shadow-green-100 flex items-center justify-center gap-3">ANALISAR AGORA <ChevronRight className="w-5 h-5"/></button>
                  <button onClick={(e) => {e.stopPropagation(); setFile(null); setError?.(null);}} className="text-slate-400 font-black text-sm uppercase tracking-widest mt-2">CANCELAR</button>
                </div>
              ) : <div className="flex flex-col items-center gap-4"><Loader2 className="animate-spin text-green-500 w-10 h-10" /><span className="text-green-600 font-black text-sm uppercase tracking-widest">O Gênio está lendo...</span></div>}
           </div>
         )}
      </div>

      <div className="w-full">
        <h3 className="text-[14px] font-black text-[#94A3B8] uppercase tracking-[3px] mb-6 md:mb-8 px-2">Sugestões de Análise</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
           <QuickAction icon={Shield} label="Contratos" sub="Aluguel, Trabalho" />
           <QuickAction icon={Pill} label="Bulas" sub="Como usar, Riscos" />
           <QuickAction icon={Stethoscope} label="Exames" sub="Saúde e Laudos" />
           <QuickAction icon={Receipt} label="Contas" sub="Cobranças e Taxas" />
        </div>
      </div>
    </div>
  );
}

function ScreenHistorico({ history, profile, onView, onNew, onGoPlans, onDelete }: any) {
  const isPremium = profile?.plan_tier === 'premium';

  return (
    <div className="flex flex-col gap-10 bg-white p-6 md:p-12 rounded-[40px] shadow-sm min-h-[80vh]">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-black text-[#1E293B]">Histórico</h2>
        <div className="p-3 bg-slate-50 rounded-2xl"><Search className="text-slate-400 w-6 h-6" /></div>
      </div>

      {!isPremium ? (
        <div className="bg-[#1E293B] p-10 rounded-[40px] text-white flex flex-col items-center text-center gap-8 shadow-2xl max-w-xl mx-auto w-full mt-10">
           <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/20"><Lock className="w-10 h-10" /></div>
           <div className="flex flex-col gap-3">
              <h3 className="text-2xl font-black">Histórico Premium</h3>
              <p className="text-slate-400 font-bold leading-relaxed px-2">No plano Free suas análises não ficam salvas. Mude para o Premium para salvar tudo!</p>
           </div>
           <button onClick={onGoPlans} className="w-full bg-[#22C55E] text-white py-6 rounded-[24px] font-black shadow-lg hover:scale-105 transition-transform">LIBERAR AGORA</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
           <div className="col-span-full">
               <button onClick={onNew} className="w-full md:w-auto px-10 bg-slate-50 text-slate-400 py-6 rounded-[24px] font-black border-2 border-dashed border-slate-100 flex items-center justify-center gap-3 hover:bg-slate-100 transition-all"><Upload className="w-6 h-6" /> NOVA ANÁLISE</button>
           </div>
           
           {history.length > 0 ? (
              history.map((item: any) => (
               <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={item.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex items-center justify-between hover:border-green-500/30 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex items-center gap-5 overflow-hidden flex-1" onClick={() => onView(item)}>
                    <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-[#22C55E] transition-colors"><FileText className="text-green-500 group-hover:text-white w-8 h-8 transition-colors" /></div>
                    <div className="overflow-hidden">
                       <p className="text-lg font-black text-[#1E293B] truncate">{item.file_name}</p>
                       <p className="text-xs font-bold text-slate-300 mt-1 uppercase group-hover:text-green-600 transition-colors">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-3 text-red-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all opacity-100 md:opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <ChevronRight className="text-slate-200 group-hover:text-green-500 transition-colors" onClick={() => onView(item)} />
                  </div>
               </motion.div>
             ))
           ) : (
             <div className="text-center py-20 col-span-full"><p className="text-slate-300 font-black uppercase tracking-widest text-sm">Nenhuma análise salva</p></div>
           )}
        </div>
      )}
    </div>
  );
}

function ScreenPerfil({ user, profile, onLogout, onUpgrade, onUpdatePhoto, setProfile }: any) {
  const isPremium = profile?.plan_tier === 'premium';
  const remaining = Math.max(0, (profile?.analysis_limit || 0) - (profile?.analysis_count || 0));
  const [isEditing, setIsEditing] = useState(!profile?.name || !profile?.phone);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.premium_expires_at) {
      const expiresAt = new Date(profile.premium_expires_at);
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      setDaysRemaining(Math.max(0, days));
    }

    if (profile && !isEditing) {
      setEditName(profile.name || '');
      setEditPhone(profile.phone || '');
    }
    if (profile?.avatar_url) {
      setPreviewUrl(null);
    }
  }, [profile, isEditing]);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const charCount = Math.min(numbers.length, 11);
    const masked = numbers.slice(0, charCount);
    if (charCount <= 2) return masked;
    if (charCount <= 7) return `(${masked.slice(0, 2)}) ${masked.slice(2)}`;
    return `(${masked.slice(0, 2)}) ${masked.slice(2, 7)}-${masked.slice(7)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditPhone(formatPhone(e.target.value));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      onUpdatePhoto(file);
    }
  };

  const handleSave = async () => {
    const currentUserId = user?.id || profile?.id;
    if (!currentUserId) {
      alert("Erro: Usuário não identificado.");
      return;
    }

    if (!editName.trim()) {
      alert("Por favor, preencha o seu nome.");
      return;
    }

    const digitsOnly = editPhone.replace(/\D/g, '');
    if (digitsOnly.length !== 11) {
      alert("Por favor, insira um número de telefone válido com DDD (11 dígitos). Ex: (11) 98888-7777");
      return;
    }

    setIsSaving(true);
    const updatedData = {
      ...(profile as any),
      name: editName.trim(),
      phone: editPhone,
      updated_at: new Date().toISOString()
    };
    setProfile(updatedData);
    if (profile?.email) {
      saveLocalProfile(updatedData);
    }

    setShowSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setShowSuccess(false);
      setIsEditing(false);
    }, 800);

    supabase
      .from('profiles')
      .upsert({ 
        id: currentUserId,
        name: editName.trim(), 
        phone: editPhone,
        email: profile?.email,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' })
      .select()
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn("[PROFILE] DB sync failed (RLS?). Data saved locally:", error.message);
        } else if (data) {
          setProfile(data);
          console.log("[PROFILE] DB sync successful.");
        }
      });
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-[#1E293B]">Meu Perfil</h2>
        <button onClick={onLogout} className="p-3 bg-red-50 text-red-400 rounded-2xl active:scale-95 transition-all hover:bg-red-100"><LogOut className="w-6 h-6" /></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
        <div className="bg-white p-10 rounded-[44px] shadow-sm flex flex-col items-center relative w-full border border-slate-100">
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileChange} 
             className="hidden" 
             accept="image/*" 
           />
           <div onClick={handlePhotoClick} className="w-32 h-32 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 shadow-inner overflow-hidden border-4 border-white relative cursor-pointer group hover:shadow-md transition-shadow">
              {profile?.avatar_url || previewUrl ? (
                <img src={previewUrl || profile?.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <User className="w-14 h-14 text-slate-200" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="text-white" /></div>
           </div>

           {isEditing ? (
              <div className="w-full flex flex-col gap-4 mt-2">
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-300 uppercase px-4">Nome Completo</span>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Seu nome" className="w-full bg-slate-50 border border-slate-200 px-6 py-4 rounded-2xl font-bold text-[#1E293B] focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner" />
                 </div>
                 <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-300 uppercase px-4">WhatsApp (Telefone)</span>
                    <input type="tel" value={editPhone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className="w-full bg-slate-50 border border-slate-200 px-6 py-4 rounded-2xl font-bold text-[#1E293B] focus:border-green-500 focus:bg-white outline-none transition-all shadow-inner" />
                 </div>
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving || showSuccess}
                    className={`relative overflow-hidden py-4 rounded-2xl font-black shadow-lg mt-4 transition-all text-white ${showSuccess ? 'bg-blue-500 cursor-default' : 'bg-[#22C55E] hover:bg-green-500 hover:shadow-green-500/30'}`}
                  >
                    <AnimatePresence mode="wait">
                      {isSaving ? (
                        <motion.div key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" /> SALVANDO...
                        </motion.div>
                      ) : showSuccess ? (
                        <motion.div key="success" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" /> PERFIL SALVO!
                        </motion.div>
                      ) : (
                        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          SALVAR DADOS
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
              </div>
           ) : (
              <>
                  <h3 className="text-3xl font-black text-[#1E293B] mb-1 text-center">{profile?.name || 'Seu Nome'}</h3>
                  <p className="text-slate-400 font-bold mb-1 text-center">{user.email}</p>
                  <p className="text-slate-400 font-bold text-sm mb-6 text-center">{profile?.phone || '(00) 00000-0000'}</p>
                 <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-slate-500 hover:text-[#22C55E] hover:bg-green-50 uppercase tracking-widest bg-slate-50 px-6 py-3 rounded-xl mb-4 transition-colors shadow-sm">Editar Perfil</button>
              </>
           )}
           
           <div className={`mt-4 px-8 py-3 rounded-full font-black text-[10px] tracking-[4px] shadow-sm flex items-center gap-3 ${isPremium ? 'bg-green-500 text-white' : 'bg-[#1E293B] text-white'}`}>
              {isPremium ? <ShieldCheck className="w-4 h-4" /> : <Star className="w-4 h-4" />}
              PLANO {profile?.plan_tier.toUpperCase()}
           </div>

           {isPremium && profile?.premium_expires_at && (
             <div className="mt-4 flex flex-col gap-2 w-full px-4">
               <div className="text-[11px] font-black text-amber-600 flex items-center justify-center gap-2 bg-amber-50 px-4 py-2.5 rounded-full uppercase tracking-wider">
                 <Star className="w-3.5 h-3.5" /> Expirará em {new Date(profile.premium_expires_at).toLocaleDateString()}
               </div>
               {daysRemaining !== null && (
                 <div className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-widest bg-slate-50 py-2 rounded-xl">
                   Faltam <span className="text-green-600 font-black">{daysRemaining}</span> dias
                 </div>
               )}
             </div>
           )}
        </div>

        <div className="flex flex-col gap-6 w-full">
          {!isPremium && (
            <div className="bg-[#1E293B] p-10 rounded-[44px] text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                 <Zap className="w-32 h-32" />
               </div>
               <div className="flex justify-between items-center mb-6 relative z-10">
                  <span className="text-sm font-black uppercase tracking-widest text-slate-400">Tempo de Uso</span>
                  <span className="text-white font-black text-xl">{profile?.analysis_count || 0} de {profile?.analysis_limit || 3} <span className="text-green-400 text-sm">usos</span></span>
               </div>
               <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden mb-8 relative z-10">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((profile?.analysis_count || 0) / (profile?.analysis_limit || 3)) * 100)}%` }} className="h-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
               </div>
               <button onClick={onUpgrade} className="w-full bg-[#22C55E] text-white py-6 rounded-[28px] font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-green-400 transition-colors relative z-10">FAZER UPGRADE AGORA <Zap className="w-4 h-4 fill-white"/></button>
            </div>
          )}

          {!isPremium && (
            <div className="grid grid-cols-2 gap-6 w-full">
               <div className="bg-white p-8 rounded-[40px] shadow-sm flex flex-col gap-4 border border-slate-100 hover:border-green-500/30 transition-colors">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Análises Possíveis</span>
                  <span className="text-5xl font-black text-[#1E293B]">{remaining}</span>
               </div>
               <div onClick={onUpgrade} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100 flex flex-col items-center justify-center cursor-pointer hover:border-[#22C55E] hover:bg-green-50 transition-all group">
                  <div className="w-16 h-16 bg-slate-50 group-hover:bg-green-100 rounded-2xl flex items-center justify-center transition-colors mb-2">
                    <TrendingUp className="text-slate-300 group-hover:text-green-500 w-8 h-8 transition-colors" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mt-2 group-hover:text-green-600">Ver Vantagens<br/>Premium</span>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScreenPlanos({ profile, onSelect, onBack }: any) {
  return (
    <div className="flex flex-col gap-10 bg-white p-6 md:p-12 rounded-[40px] shadow-sm min-h-[80vh]">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors"><ArrowLeft className="text-slate-400" /></button>
        <h2 className="text-3xl font-black text-[#1E293B]">Nossos Planos</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto w-full mt-4">
         <div className={`p-10 rounded-[48px] border-2 bg-white transition-all flex flex-col h-full ${profile?.plan_tier === 'free' ? 'border-blue-100 bg-blue-50/10 shadow-lg scale-[1.02]' : 'border-slate-50 shadow-sm hover:border-slate-200'}`}>
            <span className="text-xs font-black text-blue-400 tracking-[3px] uppercase mb-4 block">Básico</span>
            <div className="text-5xl font-black text-[#1E293B] mb-10 tracking-tighter">Grátis</div>
            <ul className="flex flex-col gap-5 mb-10 flex-1">
               <PlanLi text="3 análises por mês" active />
               <PlanLi text="IA Gemini 2.5 Flash" active />
               <PlanLi text="Sem histórico salvo" danger />
               <PlanLi text="Suporte Comunitário" active />
            </ul>
            {profile?.plan_tier === 'free' && (
              <div className="bg-blue-50 text-blue-500 py-4 rounded-[20px] font-black text-center border border-blue-100 uppercase tracking-widest text-[11px] mt-auto">Seu Plano Atual</div>
            )}
         </div>

         <div className="p-10 rounded-[48px] border-2 border-[#22C55E] bg-[#1E293B] text-white shadow-2xl shadow-green-200/20 relative flex flex-col h-full md:scale-[1.05] animate-pulse-subtle z-10">
            <div className="absolute -top-4 -right-2 bg-[#22C55E] text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[2px] shadow-xl">MELHOR VALOR</div>
            <span className="text-xs font-black text-green-500 tracking-[3px] uppercase mb-4 block">Premium</span>
            <div className="flex items-baseline gap-2 mb-10">
               <span className="text-5xl font-black tracking-tighter">R$ 19,90</span>
               <span className="text-slate-400 font-bold text-lg">/mês</span>
            </div>
            <ul className="flex flex-col gap-5 mb-12 flex-1">
               <PlanLi text="Análises Ilimitadas" active light />
               <PlanLi text="Acesso Premium" active light />
               <PlanLi text="Chat Contextual IA" active light />
               <PlanLi text="Prioridade de Resposta" active light />
               <PlanLi text="Resumos Avançados" active light />
            </ul>
            {profile?.plan_tier !== 'premium' ? (
              <button onClick={onSelect} className="w-full bg-[#22C55E] text-white py-6 rounded-[28px] font-black flex items-center justify-center gap-3 shadow-2xl shadow-green-500/20 active:scale-95 hover:bg-green-400 transition-all mt-auto">ASSINAR PREMIUM <Zap className="w-5 h-5 fill-white"/></button>
            ) : (
              <div className="bg-green-500/20 text-green-500 py-4 rounded-[20px] font-black text-center border border-green-500/30 uppercase tracking-widest text-[11px] mt-auto">Você já é Premium!</div>
            )}
         </div>
      </div>
    </div>
  );
}

function ScreenPagamento({ user, onBack, onConfirm }: any) {
  const [payLoading, setPayLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState<PixPaymentResponse | null>(null);

  const initPix = async () => {
    setPayLoading(true);
    setError('');
    try {
      const data = await paymentService.createPixPayment(user.email);
      if (data) {
        setPixData(data);
      } else {
        setError('Não foi possível gerar o PIX. Tente novamente.');
      }
    } catch (e) {
      setError('Erro de conexão. Verifique sua internet.');
    } finally {
      setPayLoading(false);
    }
  };

  useEffect(() => {
    initPix();
  }, []);

  // 2. Real-time Polling for confirmation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pixData && pixData.status !== 'approved') {
      interval = setInterval(async () => {
        const currentStatus = await paymentService.checkPaymentStatus(pixData.id);
        if (currentStatus === 'approved') {
          clearInterval(interval);
          onConfirm();
        }
      }, 5000); 
    }
    return () => clearInterval(interval);
  }, [pixData]);

  const handleCopy = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      alert("Pix Copia e Cola copiado com sucesso!");
    }
  };

  return (
    <div className="flex flex-col gap-10 h-full bg-white p-6 md:p-12 rounded-[40px] shadow-sm min-h-[80vh]">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors"><ArrowLeft className="text-slate-400" /></button>
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-[#1E293B]">Pagamento</h2>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sua segurança em 1º lugar</p>
        </div>
      </div>

      <div className="bg-white p-8 md:p-12 rounded-[40px] border border-slate-100 shadow-xl flex flex-col gap-10 max-w-2xl mx-auto w-full mt-4">
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
               <span className="text-sm font-black text-slate-300 uppercase">Total a pagar</span>
               <span className="text-4xl md:text-5xl font-black text-[#1E293B]">R$ 19,90</span>
            </div>
            <div className="w-16 h-16 md:w-20 md:h-20 bg-green-50 rounded-3xl flex items-center justify-center"><CreditCard className="text-green-500 w-8 h-8 md:w-10 md:h-10" /></div>
         </div>

         <div className="flex flex-col gap-4">
            <div className="bg-slate-50 p-6 rounded-3xl flex items-center gap-5 border border-slate-100 border-dashed">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0"><Zap className="text-orange-400 fill-orange-400 w-6 h-6" /></div>
               <div className="flex flex-col">
                  <span className="text-sm md:text-base font-black text-[#1E293B]">Acesso Premium</span>
                  <span className="text-xs md:text-sm font-bold text-slate-400">Ativação imediata após confirmação</span>
               </div>
            </div>
            <div className="flex flex-col gap-4">
               <span className="text-xs font-black text-slate-300 uppercase px-1 tracking-widest">Método de Checkout</span>
               <div className="grid grid-cols-1">
                  <div className="bg-slate-50 border-2 border-green-500/20 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><QrCode className="text-green-500 w-5 h-5" /></div>
                        <span className="text-sm font-black text-[#1E293B]">PIX (Padrão)</span>
                     </div>
                     <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center shadow-sm shadow-green-500/20"><Check className="text-white w-4 h-4" /></div>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex flex-col items-center gap-6 bg-slate-50 p-8 rounded-3xl border border-slate-100 border-dashed min-h-[400px] justify-center">
            {payLoading ? (
              <div className="flex flex-col items-center gap-4">
                 <Loader2 className="w-12 h-12 text-slate-300 animate-spin" />
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">Iniciando pagamento seguro...<br/>Aguarde um momento</span>
              </div>
            ) : pixData ? (
              <>
                 <div className="p-5 bg-white rounded-[32px] shadow-sm border border-slate-100 flex items-center justify-center hover:shadow-md transition-shadow relative">
                    <QRCodeCanvas value={pixData.qr_code} size={180} level="M" />
                 </div>
                 <div className="flex flex-col items-center gap-2 w-full max-w-sm">
                   <p className="text-[13px] font-bold text-slate-400 text-center px-4 leading-relaxed mb-2">
                      Escaneie o QR Code ou cole o código Pix abaixo no seu app de banco.
                   </p>
                   <div className="flex justify-center mt-1 w-full relative group">
                     <div className="absolute inset-0 bg-green-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                     <button onClick={handleCopy} className="bg-[#1E293B] w-full text-white text-[13px] tracking-wide font-black uppercase px-6 py-4 rounded-2xl hover:bg-black transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg border border-slate-700 relative z-10 text-center disabled:opacity-50">
                       PIX COPIA E COLA 
                       <span className="w-5 h-5 bg-white/10 rounded-md flex items-center justify-center">
                         <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='9' y='9' width='13' height='13' rx='2' ry='2'%3E%3C/rect%3E%3Cpath d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'%3E%3C/path%3E%3C/svg%3E" alt="copy" className="w-3 h-3 invert opacity-80" />
                       </span>
                     </button>
                   </div>
                   <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-green-700 bg-green-50/80 border border-green-100 px-4 py-2.5 rounded-full uppercase tracking-widest text-center shadow-sm">
                     <ShieldCheck className="w-4 h-4" /> Beneficiário: Core Build
                   </div>
                 </div>
                 <div className="w-full max-w-sm flex items-center justify-center gap-3 p-4">
                   <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                   <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Aguardando Confirmação Real...</span>
                 </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-6 p-4">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center"><AlertCircle className="text-red-400 w-8 h-8" /></div>
                <div className="flex flex-col gap-2 text-center">
                  <span className="text-lg font-black text-[#1E293B]">Ops! Ocorreu um erro</span>
                  <p className="text-sm font-medium text-slate-400 leading-relaxed px-4">Não conseguimos gerar seu código PIX agora por um problema técnico temporário.</p>
                </div>
                <button 
                  onClick={initPix}
                  className="w-full py-5 bg-[#1E293B] text-white font-black rounded-2xl text-[11px] uppercase tracking-[2px] hover:bg-black transition-all shadow-xl active:scale-95"
                >
                  Tentar Novamente
                </button>
                {error && <span className="text-[9px] font-bold text-red-300 uppercase tracking-widest opacity-50">{error}</span>}
              </div>
            )}
         </div>
      </div>
         
      </div>

      <div className="flex items-center justify-center gap-3 text-slate-300 mt-auto pt-8">
         <ShieldCheck className="w-5 h-5 text-green-500" />
         <span className="text-[10px] md:text-xs font-bold uppercase tracking-[2px]">Pagamento 100% Seguro e Criptografado</span>
      </div>
    </div>
  );
}

function ScreenExplicacoes({ analysis, messages, setMessages, input, setInput, chatLoading, setChatLoading, chatEndRef, onBack }: any) {
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    const msg = input.trim();
    setInput('');
    setMessages((prev: any) => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const response = await askQuestion(analysis, msg);
      setMessages((prev: any) => [...prev, { role: 'assistant', content: response || "Não entendi..." }]);
    } catch (e) { console.error(e); }
    finally { setChatLoading(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="flex flex-col lg:flex-row h-[85vh] gap-8 bg-white p-6 md:p-8 rounded-[40px] shadow-sm">
      <div className="flex flex-col gap-6 flex-1 h-full lg:border-r lg:border-slate-100 lg:pr-8">
        <div className="flex items-center gap-4 shrink-0">
          <button onClick={onBack} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors"><ArrowLeft className="text-slate-400" /></button>
          <div className="flex flex-col"><h2 className="text-2xl font-black text-[#1E293B]">Análise</h2><p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Documento Processado</p></div>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-100 p-8 rounded-[32px] shadow-inner custom-scrollbar markdown-content">
            <Markdown>{analysis}</Markdown>
        </div>
      </div>
      
      <div className="lg:w-[400px] shrink-0 bg-[#1E293B] p-6 lg:p-8 rounded-[32px] lg:rounded-[40px] flex flex-col gap-6 max-h-[50vh] lg:max-h-full shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-blue-500 opacity-30"></div>
         <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-green-400" />
            </div>
            <span className="font-black text-white text-sm">Gênio Explicador</span>
         </div>
         <div className="flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar pb-2 pr-2">
            {messages.length === 0 && <div className="text-slate-400 font-bold text-center py-4 text-xs mt-auto mb-auto">Alguma dúvida sobre o texto ao lado? Pergunte aqui!</div>}
            {messages.map((m: any, i: number) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[88%] p-5 rounded-[24px] text-[13px] leading-relaxed font-bold shadow-sm transition-all ${
                   m.role === 'user' 
                     ? 'bg-[#22C55E] text-white rounded-tr-sm' 
                     : 'bg-white/5 text-slate-200 rounded-tl-sm border border-white/5'
                 }`}>
                   <Markdown>{m.content}</Markdown>
                 </div>
              </div>
            ))}
            {chatLoading && <div className="text-green-500 text-[10px] font-black animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> LENDO DOCUMENTO...</div>}
            <div ref={chatEndRef} />
         </div>
         <form onSubmit={handleSendMessage} className="relative group transition-all shrink-0">
            <input value={input} onChange={e => setInput(e.target.value)} type="text" placeholder="Faça uma pergunta..." className="w-full bg-white/5 border border-white/10 px-6 py-4 rounded-[20px] text-[14px] font-bold text-white shadow-inner outline-none focus:border-green-500/50 focus:bg-white/10 transition-colors" />
            <button type="submit" className="absolute right-2 top-2 p-2.5 bg-[#22C55E] hover:bg-green-400 rounded-xl text-white shadow-xl active:scale-95 transition-all"><Send className="w-4 h-4" /></button>
         </form>
      </div>
    </div>
  );
}

// --- Atomic components ---



function AuthInput({ icon: Icon, placeholder, value }: any) {
  return (
    <div className="relative group">
       <Icon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-green-500 transition-colors" />
       <input type="text" placeholder={placeholder} defaultValue={value} className="w-full bg-slate-50 border-2 border-transparent px-14 py-6 rounded-[24px] font-bold text-[#1E293B] focus:bg-white focus:border-green-500/20 active:outline-none focus:outline-none transition-all placeholder:text-slate-300" />
    </div>
  );
}

function QuickAction({ icon: Icon, label, sub }: any) {
  return (
    <div className="bg-white p-7 rounded-[40px] border border-slate-50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col gap-6">
       <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center"><Icon className="text-white w-6 h-6" /></div>
       <div>
          <span className="text-lg font-black text-[#1E293B] block leading-tight">{label}</span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{sub}</span>
       </div>
    </div>
  );
}

function PlanLi({ text, active, light, danger }: any) {
  return (
    <li className="flex items-center gap-4">
       <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${danger ? 'bg-red-50 text-red-400' : light ? 'bg-green-500/20 text-green-500' : 'bg-green-50 text-green-600'}`}>
          {danger ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
       </div>
       <span className={`text-[15px] font-bold ${light ? 'text-slate-300' : 'text-[#334155]'}`}>{text}</span>
    </li>
  );
}

function CheckoutOption({ icon: Icon, label, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-5 rounded-3xl border-2 flex flex-col items-center gap-3 cursor-pointer transition-all ${active ? 'border-green-500 bg-green-50/20' : 'border-slate-50 bg-white hover:border-slate-100'}`}>
       <Icon className={active ? 'text-green-600' : 'text-slate-300'} />
       <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-green-700' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}
