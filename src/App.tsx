import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, CheckCircle2, Loader2, Send, X, History, Home as HomeIcon, Upload, Search, Filter, 
  MoreVertical, PlayCircle, Bell, User, Lock, Mail, Github, LogOut, Star, TrendingUp, ChevronRight,
  ShieldCheck, CreditCard, Zap, Check, ArrowLeft, Camera, Shield, HelpCircle, Trash2, Pill, Stethoscope, Scale, Receipt, QrCode, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDocument, askQuestion, analyzeDocumentStream } from './services/geminiService';
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

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('inicio');
  const [historyTabPreselected, setHistoryTabPreselected] = useState<AnalysisItem | null>(null);
  
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

  const syncUserData = async (authUser: any) => {
    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      const metadata = authUser.user_metadata;
      
      // Se o perfil não existir ou faltar dados básicos, usamos metadados do Google
      if (!data || !data.name || !data.avatar_url) {
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
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
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

        } catch (err) {
          console.error("Stream error:", err);
          setError("Erro na conexão com a IA.");
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

  const handleDeleteAccount = async () => {
    if (window.confirm('⚠️ ATENÇÃO: Deseja excluir permanentemente sua conta e todos os seus dados? Esta ação não pode ser desfeita.')) {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return;

      try {
        setLoading(true);
        // Deleta dados das tabelas públicas
        await supabase.from('analyses').delete().eq('user_id', currentUserId);
        await supabase.from('payments').delete().eq('user_id', currentUserId);
        await supabase.from('profiles').delete().eq('id', currentUserId);
        
        // Log out (O usuário será removido do banco, mas a conta Auth precisa ser removida no painel ou via RPC se configurado)
        await supabase.auth.signOut();
        alert('Seus dados foram excluídos com sucesso.');
      } catch (err) {
        console.error("Erro ao excluir conta:", err);
        alert('Erro ao excluir dados. Por favor, tente novamente.');
      } finally {
        setLoading(false);
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
                  onDeleteAccount={handleDeleteAccount}
                  setProfile={setProfile}
                />;
              case 'planos': return <ScreenPlanos profile={profile} onSelect={() => setActiveTab('pagamento')} onBack={() => setActiveTab('inicio')} />;
              case 'pagamento': return <ScreenPagamento onBack={() => setActiveTab('planos')} onConfirm={async () => {
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
    <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center font-sans">
      {PREFER_MOCK && <div className="fixed top-4 left-4 z-[9999] bg-[#1E293B] text-white text-[10px] px-3 py-1 rounded-full font-black shadow-2xl border border-slate-700">PROTO-LOCAL</div>}
      
      <div className="w-full max-w-[480px] bg-white min-h-screen flex flex-col relative overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.1)]">
        <div className="flex-1 overflow-y-auto pb-28 px-7 pt-12 custom-scrollbar relative">
           {renderScreen()}
        </div>

        {activeTab !== 'explicações' && activeTab !== 'pagamento' && (
          <nav className="absolute bottom-6 left-6 right-6 h-20 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-[32px] flex items-center justify-around px-2 z-50 shadow-[0_10px_30px_rgba(0,0,0,0.05)]">
            <NavItem icon={HomeIcon} label="INÍCIO" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
            <NavItem icon={History} label="HISTÓRICO" active={activeTab === 'historico'} onClick={() => setActiveTab('historico')} />
            <NavItem icon={Zap} label="PLANO" active={activeTab === 'planos'} onClick={() => setActiveTab('planos')} />
            <NavItem icon={User} label="PERFIL" active={activeTab === 'perfil'} onClick={() => setActiveTab('perfil')} />
          </nav>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .dash-border { background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='40' ry='40' stroke='%2322C55E' stroke-width='4' stroke-dasharray='16%2c 16' stroke-dashoffset='0' stroke-linecap='round'/%3e%3c/svg%3e"); border-radius: 40px; }
        .markdown-content h1 { font-size: 1.4rem; font-weight: 800; color: #1E293B; margin-bottom: 1rem; }
        .markdown-content p { color: #64748B; margin-bottom: 1rem; line-height: 1.7; font-size: 1rem; }
        .markdown-content strong { color: #334155; }
      `}</style>
    </div>
  );
}

// --- Screens Components ---

function ScreenAuth({ onLoginGoogle }: any) {
  const [authError] = useState('');

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-10 w-full max-w-[480px]">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-col items-center w-full">
        <div className="w-20 h-20 bg-[#22C55E] rounded-[28px] flex items-center justify-center shadow-2xl shadow-green-200 mb-8 rotate-3">
          <FileText className="text-white w-9 h-9" />
        </div>
        <h1 className="text-4xl font-black text-[#1E293B] mb-2 tracking-tighter uppercase">ExplicaFácil</h1>
        <p className="text-slate-400 font-bold mb-10 text-center px-10 leading-relaxed text-sm">Simplificando o mundo para você, um documento por vez.</p>
        
        <div className="w-full flex flex-col gap-5">
           {authError && <div className="text-red-500 text-sm font-bold text-center px-4 py-2 bg-red-50 rounded-xl">{authError}</div>}
           
           <button onClick={onLoginGoogle} className="w-full bg-[#1E293B] text-white py-7 rounded-[32px] font-black shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4">
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6 grayscale invert" /> CONTINUAR COM GOOGLE
           </button>
        </div>
        
        <p className="mt-12 text-[10px] text-slate-300 font-bold text-center px-12 leading-loose uppercase tracking-widest">Ao continuar, você concorda com nossos <br/> <span className="text-[#22C55E]">Termos de Uso</span> e <span className="text-[#22C55E]">Privacidade</span></p>
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
    <div className="flex flex-col gap-12">
      <header className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg"><FileText className="text-white w-6 h-6" /></div>
          <span className="text-xl font-black text-[#1E293B] tracking-tight">ExplicaFácil</span>
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

      <div>
        <h3 className="text-[14px] font-black text-[#94A3B8] uppercase tracking-[3px] mb-8 px-2">Sugestões de Análise</h3>
        <div className="grid grid-cols-2 gap-6">
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
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-3xl font-black text-[#1E293B]">Histórico</h2>
        <div className="p-3 bg-slate-50 rounded-2xl"><Search className="text-slate-400 w-6 h-6" /></div>
      </div>

      {!isPremium ? (
        <div className="bg-[#1E293B] p-10 rounded-[40px] text-white flex flex-col items-center text-center gap-8 shadow-2xl">
           <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-green-500/20"><Lock className="w-10 h-10" /></div>
           <div className="flex flex-col gap-3">
              <h3 className="text-2xl font-black">Histórico Premium</h3>
              <p className="text-slate-400 font-bold leading-relaxed px-2">No plano Free suas análises não ficam salvas. Mude para o Premium para salvar tudo!</p>
           </div>
           <button onClick={onGoPlans} className="w-full bg-[#22C55E] text-white py-6 rounded-[24px] font-black shadow-lg">LIBERAR AGORA</button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
           {history.length > 0 ? (
              history.map((item: any) => (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={item.id} className="bg-white p-6 rounded-[32px] border border-slate-50 shadow-sm flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex items-center gap-5 overflow-hidden flex-1" onClick={() => onView(item)}>
                    <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center shrink-0"><FileText className="text-green-500 w-8 h-8" /></div>
                    <div className="overflow-hidden">
                       <p className="text-lg font-black text-[#1E293B] truncate">{item.file_name}</p>
                       <p className="text-xs font-bold text-slate-300 mt-1 uppercase">{new Date(item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-3 text-red-300 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all opacity-100 sm:opacity-0 group-hover:opacity-100">
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <ChevronRight className="text-slate-200" onClick={() => onView(item)} />
                  </div>
               </motion.div>
             ))
           ) : (
             <div className="text-center py-20"><p className="text-slate-300 font-black uppercase tracking-widest text-sm">Nenhuma análise salva</p></div>
           )}
           <button onClick={onNew} className="w-full bg-slate-50 text-slate-400 py-6 rounded-[24px] font-black border-2 border-dashed border-slate-100 flex items-center justify-center gap-3 mt-4 hover:bg-slate-100 transition-all"><Upload className="w-6 h-6" /> NOVA ANÁLISE</button>
        </div>
      )}
    </div>
  );
}

function ScreenPerfil({ user, profile, onLogout, onUpgrade, onUpdatePhoto, onDeleteAccount, setProfile }: any) {
  const isPremium = profile?.plan_tier === 'premium';
  const remaining = Math.max(0, (profile?.analysis_limit || 0) - (profile?.analysis_count || 0));
  const [isEditing, setIsEditing] = useState(!profile?.name || !profile?.phone);
  const [editName, setEditName] = useState(profile?.name || '');
  const [editPhone, setEditPhone] = useState(profile?.phone || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza estado interno apenas se NÃO estivermos editando
  useEffect(() => {
    if (profile && !isEditing) {
      setEditName(profile.name || '');
      setEditPhone(profile.phone || '');
    }
    // Se a foto mudou, limpamos o preview local
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
      // Preview imediato
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

    // 1. Salva IMEDIATAMENTE no estado local e localStorage (sem esperar o banco)
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

    // 2. Mostra sucesso imediatamente ao usuário
    setShowSuccess(true);
    setIsSaving(false);
    setTimeout(() => {
      setShowSuccess(false);
      setIsEditing(false);
    }, 800);

    // 3. Tenta sincronizar com o Supabase em segundo plano (não bloqueia a UI)
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
          setProfile(data); // Atualiza com dados confirmados pelo banco
          console.log("[PROFILE] DB sync successful.");
        }
      });
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-[#1E293B]">Meu Perfil</h2>
        <button onClick={onLogout} className="p-3 bg-red-50 text-red-400 rounded-2xl active:scale-95 transition-all"><LogOut className="w-6 h-6" /></button>
      </div>

      <div className="bg-white p-10 rounded-[44px] border border-slate-100 shadow-sm flex flex-col items-center relative">
         <input 
           type="file" 
           ref={fileInputRef} 
           onChange={handleFileChange} 
           className="hidden" 
           accept="image/*" 
         />
         <div onClick={handlePhotoClick} className="w-32 h-32 bg-slate-50 rounded-[40px] flex items-center justify-center mb-8 shadow-inner overflow-hidden border-4 border-white relative cursor-pointer group">
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
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Seu nome" className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl font-bold text-[#1E293B] focus:border-green-500 outline-none transition-all" />
               </div>
               <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black text-slate-300 uppercase px-4">WhatsApp (Telefone)</span>
                  <input type="tel" value={editPhone} onChange={handlePhoneChange} placeholder="(00) 00000-0000" className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl font-bold text-[#1E293B] focus:border-green-500 outline-none transition-all" />
               </div>
                <button 
                  onClick={handleSave} 
                  disabled={isSaving || showSuccess}
                  className={`relative overflow-hidden py-4 rounded-2xl font-black shadow-lg mt-4 active:scale-95 transition-all text-white ${showSuccess ? 'bg-blue-500' : 'bg-[#22C55E] shadow-green-100'}`}
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
                <h3 className="text-3xl font-black text-[#1E293B] mb-1">{profile?.name || 'Seu Nome'}</h3>
                <p className="text-slate-400 font-bold mb-1">{user.email}</p>
                <p className="text-slate-400 font-bold text-sm mb-6">{profile?.phone || '(00) 00000-0000'}</p>
               <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-green-500 uppercase tracking-widest bg-green-50 px-4 py-2 rounded-xl mb-4">Editar Perfil</button>
            </>
         )}
         
         <div className={`mt-2 px-8 py-3 rounded-full font-black text-[10px] tracking-[4px] shadow-sm flex items-center gap-3 ${isPremium ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {isPremium ? <ShieldCheck className="w-4 h-4" /> : <Star className="w-4 h-4" />}
            PLANO {profile?.plan_tier.toUpperCase()}
         </div>

         {isPremium && profile?.premium_expires_at && (
           <div className="mt-4 text-[11px] font-black text-amber-600 flex items-center gap-2 bg-amber-50 px-4 py-2.5 rounded-full uppercase tracking-wider">
             <Star className="w-3.5 h-3.5" /> Expirará em {new Date(profile.premium_expires_at).toLocaleDateString()}
           </div>
         )}
      </div>

      <div className="flex flex-col gap-4">
        {!isPremium && (
          <div className="bg-[#1E293B] p-8 rounded-[40px] text-white shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <span className="text-sm font-black uppercase tracking-widest text-slate-400">Tempo de Uso</span>
                <span className="text-green-500 font-black text-lg">{remaining} restantes</span>
             </div>
             <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-8">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(remaining / 3) * 100}%` }} className="h-full bg-green-500" />
             </div>
             <button onClick={onUpgrade} className="w-full bg-white text-[#1E293B] py-5 rounded-[24px] font-black text-sm shadow-xl flex items-center justify-center gap-2">FAZER UPGRADE AGORA <Zap className="w-4 h-4 fill-[#1E293B]"/></button>
          </div>
        )}

        <button 
          onClick={onDeleteAccount}
          className="w-full py-5 text-red-400 font-black text-[10px] tracking-[3px] uppercase hover:bg-red-50 rounded-3xl transition-all"
        >
          EXCLUIR MINHA CONTA E DADOS
        </button>
      </div>

      {!isPremium && (
        <div className="grid grid-cols-2 gap-6 pb-4">
           <div className="bg-white p-8 rounded-[40px] border border-slate-50 flex flex-col gap-4 shadow-sm">
              <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest">Análises</span>
              <span className="text-4xl font-black text-[#1E293B]">{profile?.analysis_count}</span>
           </div>
           <div onClick={onUpgrade} className="bg-white p-4 rounded-[40px] border border-slate-50 flex items-center justify-center cursor-pointer hover:bg-slate-50 shadow-sm">
              <MoreVertical className="text-slate-200 w-8 h-8" />
           </div>
        </div>
      )}
    </div>
  );
}

function ScreenPlanos({ profile, onSelect, onBack }: any) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-slate-50 rounded-2xl"><ArrowLeft className="text-slate-400" /></button>
        <h2 className="text-3xl font-black text-[#1E293B]">Nossos Planos</h2>
      </div>

      <div className="flex flex-col gap-8">
         <div className={`p-10 rounded-[48px] border-2 bg-white transition-all ${profile?.plan_tier === 'free' ? 'border-blue-100 bg-blue-50/10' : 'border-slate-50 shadow-sm'}`}>
            <span className="text-xs font-black text-blue-400 tracking-[3px] uppercase mb-4 block">Básico</span>
            <div className="text-5xl font-black text-[#1E293B] mb-10 tracking-tighter">Grátis</div>
            <ul className="flex flex-col gap-5 mb-10">
               <PlanLi text="3 análises por mês" active />
               <PlanLi text="IA Gemini 2.5 Flash" active />
               <PlanLi text="Sem histórico salvo" danger />
            </ul>
         </div>

         <div className="p-10 rounded-[48px] border-2 border-[#22C55E] bg-[#1E293B] text-white shadow-2xl shadow-green-200/20 relative scale-[1.03] animate-pulse-subtle">
            <div className="absolute -top-4 -right-2 bg-[#22C55E] text-white px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[2px] shadow-xl">MELHOR VALOR</div>
            <span className="text-xs font-black text-green-500 tracking-[3px] uppercase mb-4 block">Premium</span>
            <div className="flex items-baseline gap-2 mb-10">
               <span className="text-5xl font-black tracking-tighter">R$ 19,90</span>
               <span className="text-slate-400 font-bold text-lg">/mês</span>
            </div>
            <ul className="flex flex-col gap-5 mb-12">
               <PlanLi text="Análises Ilimitadas" active light />
               <PlanLi text="Histórico Vitalício" active light />
               <PlanLi text="Chat Contextual IA" active light />
               <PlanLi text="Prioridade de Resposta" active light />
            </ul>
            {profile?.plan_tier !== 'premium' ? (
              <button onClick={onSelect} className="w-full bg-[#22C55E] text-white py-6 rounded-[28px] font-black flex items-center justify-center gap-3 shadow-2xl shadow-green-500/20 active:scale-95 transition-transform">ASSINAR PREMIUM <Zap className="w-5 h-5 fill-white"/></button>
            ) : (
              <div className="bg-green-500/20 text-green-500 py-6 rounded-[28px] font-black text-center border border-green-500/30 uppercase tracking-widest text-sm">Plano Atual</div>
            )}
         </div>
      </div>
    </div>
  );
}

function ScreenPagamento({ onBack, onConfirm }: any) {
  const [payLoading, setPayLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [cardData, setCardData] = useState({ number: '', name: '', expiry: '', cvv: '' });
  const [error, setError] = useState('');

  const handlePay = () => {
    if (paymentMethod === 'card') {
      if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
        setError('Preencha todos os dados do cartão.');
        return;
      }
    }
    setError('');
    setPayLoading(true);
    setTimeout(onConfirm, 2000); // Simulando o tempo da API
  };

  return (
    <div className="flex flex-col gap-10 h-full">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-slate-50 rounded-2xl"><ArrowLeft className="text-slate-400" /></button>
        <div className="flex flex-col">
          <h2 className="text-2xl font-black text-[#1E293B]">Pagamento</h2>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sua segurança em 1º lugar</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-xl flex flex-col gap-10">
         <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
               <span className="text-sm font-black text-slate-300 uppercase">Total a pagar</span>
               <span className="text-4xl font-black text-[#1E293B]">R$ 19,90</span>
            </div>
            <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center"><CreditCard className="text-green-500 w-8 h-8" /></div>
         </div>

         <div className="flex flex-col gap-4">
            <div className="bg-slate-50 p-6 rounded-3xl flex items-center gap-5 border border-slate-100 border-dashed">
               <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm"><Zap className="text-orange-400 fill-orange-400 w-6 h-6" /></div>
               <div className="flex flex-col">
                  <span className="text-sm font-black text-[#1E293B]">Acesso Premium Vitalício</span>
                  <span className="text-xs font-bold text-slate-400">Ativação imediata após confirmação</span>
               </div>
            </div>
         </div>

         <div className="flex flex-col gap-4">
            <span className="text-xs font-black text-slate-300 uppercase px-1">Método de Checkout</span>
            <div className="grid grid-cols-2 gap-4">
               <CheckoutOption icon={QrCode} label="PIX" active={paymentMethod === 'pix'} onClick={() => setPaymentMethod('pix')} />
               <CheckoutOption icon={CreditCard} label="Cartão" active={paymentMethod === 'card'} onClick={() => setPaymentMethod('card')} />
            </div>
         </div>

         {error && <div className="text-red-500 text-sm font-bold text-center px-4 py-2 bg-red-50 rounded-xl">{error}</div>}

         {paymentMethod === 'pix' ? (
            <div className="flex flex-col items-center gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100 border-dashed">
               <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <QrCode className="w-32 h-32 text-slate-800" />
               </div>
               <p className="text-xs font-bold text-slate-400 text-center px-4 leading-relaxed">
                  Para fins do teste: não é necessário ler este QR code. Apenas pressione o botão abaixo para simular um pagamento bem sucedido.
               </p>
               <button onClick={handlePay} className="w-full bg-[#1E293B] text-white py-5 rounded-[24px] font-black shadow-2xl flex items-center justify-center gap-4 hover:bg-black transition-all">
                  {payLoading ? <Loader2 className="animate-spin" /> : <>SIMULAR PIX <ChevronRight/></>}
               </button>
            </div>
         ) : (
            <div className="flex flex-col gap-4">
               <input type="text" placeholder="Número do Cartão" value={cardData.number} onChange={e => setCardData({...cardData, number: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent px-6 py-5 rounded-[20px] font-bold text-[#1E293B] focus:bg-white focus:border-green-500/20 active:outline-none focus:outline-none transition-all placeholder:text-slate-300" />
               <input type="text" placeholder="Nome Impresso no Cartão" value={cardData.name} onChange={e => setCardData({...cardData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent px-6 py-5 rounded-[20px] font-bold text-[#1E293B] focus:bg-white focus:border-green-500/20 active:outline-none focus:outline-none transition-all placeholder:text-slate-300" />
               <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="Validade (MM/YY)" value={cardData.expiry} onChange={e => setCardData({...cardData, expiry: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent px-6 py-5 rounded-[20px] font-bold text-[#1E293B] focus:bg-white focus:border-green-500/20 active:outline-none focus:outline-none transition-all placeholder:text-slate-300" />
                  <input type="text" placeholder="CVV" value={cardData.cvv} onChange={e => setCardData({...cardData, cvv: e.target.value})} className="w-full bg-slate-50 border-2 border-transparent px-6 py-5 rounded-[20px] font-bold text-[#1E293B] focus:bg-white focus:border-green-500/20 active:outline-none focus:outline-none transition-all placeholder:text-slate-300" />
               </div>
               <button onClick={handlePay} className="w-full bg-[#1E293B] text-white py-7 rounded-[32px] font-black shadow-2xl flex items-center justify-center gap-4 hover:bg-black transition-all mt-2">
                  {payLoading ? <Loader2 className="animate-spin" /> : <>PAGAR AGORA (Simulação) <ChevronRight/></>}
               </button>
            </div>
         )}
      </div>

      <div className="flex items-center justify-center gap-3 text-slate-300 mt-auto pb-6">
         <HelpCircle className="w-4 h-4" />
         <span className="text-[10px] font-bold uppercase tracking-[2px]">Pagamento 100% Criptografado</span>
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
    <div className="flex flex-col h-full gap-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-3 bg-slate-50 rounded-2xl"><ArrowLeft className="text-slate-400" /></button>
        <div className="flex flex-col"><h2 className="text-2xl font-black text-[#1E293B]">Análise</h2><p className="text-[10px] font-black text-green-500 uppercase tracking-widest">Documento Processado</p></div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white border border-slate-50 p-8 rounded-[44px] shadow-sm custom-scrollbar markdown-content">
          <Markdown>{analysis}</Markdown>
      </div>
      <div className="bg-slate-900 p-8 rounded-[44px] flex flex-col gap-6 max-h-[420px] shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-blue-500 opacity-30"></div>
         <div className="flex-1 overflow-y-auto flex flex-col gap-5 custom-scrollbar pb-2">
            {messages.length === 0 && <div className="text-slate-400 font-bold text-center py-4 text-xs">Alguma dúvida sobre o texto acima?</div>}
            {messages.map((m: any, i: number) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 <div className={`max-w-[85%] p-5 rounded-3xl text-[13px] leading-relaxed font-bold shadow-sm ${m.role === 'user' ? 'bg-[#22C55E] text-white rounded-tr-none' : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'}`}>{m.content}</div>
              </div>
            ))}
            {chatLoading && <div className="text-green-500 text-[10px] font-black animate-pulse flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin"/> PENSANDO...</div>}
            <div ref={chatEndRef} />
         </div>
         <form onSubmit={handleSendMessage} className="relative group transition-all">
            <input value={input} onChange={e => setInput(e.target.value)} type="text" placeholder="Pergunte ao gênio..." className="w-full bg-white/5 border border-white/10 px-8 py-5 rounded-2xl text-[14px] font-bold text-white shadow-inner outline-none focus:border-green-500/50" />
            <button type="submit" className="absolute right-2.5 top-2.5 p-3 bg-[#22C55E] rounded-xl text-white shadow-xl active:scale-90 transition-transform"><Send className="w-4 h-4" /></button>
         </form>
      </div>
    </div>
  );
}

// --- Atomic components ---

function NavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`flex flex-col items-center gap-1.5 cursor-pointer transition-all ${active ? 'text-[#22C55E]' : 'text-[#94A3B8]'}`}>
       <motion.div whileTap={{ scale: 0.9 }} className={`p-2.5 rounded-2xl transition-all ${active ? 'bg-green-50 shadow-sm' : ''}`}><Icon className="w-7 h-7" /></motion.div>
       <span className="text-[9px] font-black tracking-[1.5px] uppercase">{label}</span>
    </div>
  );
}

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
