/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Upload, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  MessageSquare, 
  Send, 
  Loader2,
  X,
  FileSearch,
  BookOpen,
  Scale,
  Stethoscope
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { analyzeDocument, askQuestion } from './services/geminiService';

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
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError("Ocorreu um erro ao analisar o documento. Tente novamente.");
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
      setMessages(prev => [...prev, { role: 'assistant', content: response || "Desculpe, não consegui processar sua pergunta." }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Erro ao buscar resposta. Verifique sua conexão." }]);
    } finally {
      setChatLoading(false);
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <FileSearch className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">ExplicaFácil</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Analisador de Documentos</p>
            </div>
          </div>
          {file && (
            <button 
              onClick={reset}
              className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-1 transition-colors"
            >
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">
        {!analysis ? (
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-3xl font-bold text-slate-900 mb-3">Entenda qualquer documento em segundos</h2>
              <p className="text-slate-600">Envie contratos, exames, bulas ou termos de uso e receba uma explicação simples e direta.</p>
            </motion.div>

            <div 
              {...getRootProps()} 
              className={`w-full aspect-video max-h-80 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
                ${isDragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:border-slate-400'}`}
            >
              <input {...getInputProps()} />
              <div className="bg-slate-100 p-4 rounded-full">
                <Upload className={`w-8 h-8 ${isDragActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-900">
                  {file ? file.name : 'Arraste um arquivo ou clique para selecionar'}
                </p>
                <p className="text-sm text-slate-500 mt-1">PDF, Imagens ou Texto</p>
              </div>
            </div>

            {file && !loading && (
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleAnalyze}
                className="mt-8 bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                Analisar Documento <Search className="w-5 h-5" />
              </motion.button>
            )}

            {loading && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <p className="text-slate-600 font-medium animate-pulse">Analisando documento com IA...</p>
              </div>
            )}

            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 w-full">
              {[
                { icon: Scale, label: 'Contratos', color: 'bg-blue-50 text-blue-600' },
                { icon: Stethoscope, label: 'Exames', color: 'bg-rose-50 text-rose-600' },
                { icon: BookOpen, label: 'Bulas', color: 'bg-amber-50 text-amber-600' },
                { icon: CheckCircle2, label: 'Termos', color: 'bg-emerald-50 text-emerald-600' },
              ].map((item, i) => (
                <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col items-center gap-2 shadow-sm">
                  <div className={`p-2 rounded-lg ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
            {/* Analysis Panel */}
            <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
              >
                <div className="markdown-body">
                  <Markdown>{analysis}</Markdown>
                </div>
              </motion.div>
            </div>

            {/* Q&A Panel */}
            <div className="lg:col-span-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-12rem)] sticky top-24">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Tire suas dúvidas</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
                {messages.length === 0 && (
                  <div className="text-center py-8 px-4">
                    <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                      <MessageSquare className="w-6 h-6 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-500">
                      Faça perguntas específicas como:<br/>
                      <span className="italic">"Qual a multa de cancelamento?"</span> ou <span className="italic">"Como devo tomar este remédio?"</span>
                    </p>
                  </div>
                )}
                
                <AnimatePresence initial={false}>
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                        msg.role === 'user' 
                          ? 'bg-emerald-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 text-slate-800 rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-slate-50">
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Pergunte algo sobre o documento..."
                    className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || chatLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
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
      `}</style>
    </div>
  );
}
