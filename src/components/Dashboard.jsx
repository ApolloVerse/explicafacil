import React, { useState, useRef } from 'react';
import { useAuth } from '../auth/useAuth';
import { analyzeDocument, answerQuestion } from '../logic/analyzer';
import { readDocument, ACCEPT_STRING } from '../logic/documentReader';
import { canAnalyze, incrementUsage, setPlan, FREE_ANALYSIS_LIMIT } from '../logic/userService';
import './Dashboard.css';

const PremiumModal = ({ onClose, onUpgrade, isLoading }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <span className="modal-icon">✨</span>
        <h2>Seja Premium</h2>
        <p>Desbloqueie o poder total do Explica Fácil</p>
      </div>
      <div className="modal-features">
        <div className="plan-card free">
          <h3>Gratuito</h3>
          <p className="price">R$ 0/mês</p>
          <ul>
            <li>✅ {FREE_ANALYSIS_LIMIT} análises por mês</li>
            <li>✅ Resumo simplificado</li>
            <li>✅ Alertas de risco</li>
            <li>❌ Perguntas e respostas</li>
            <li>❌ Análises ilimitadas</li>
            <li>❌ Glossário de termos</li>
          </ul>
        </div>
        <div className="plan-card premium">
          <div className="popular-tag">Mais Popular</div>
          <h3>Premium</h3>
          <p className="price">R$ 19,90/mês</p>
          <ul>
            <li>✅ Análises ilimitadas</li>
            <li>✅ Resumo simplificado</li>
            <li>✅ Alertas de risco</li>
            <li>✅ Perguntas e respostas</li>
            <li>✅ Glossário de termos</li>
            <li>✅ Todos os formatos</li>
          </ul>
          <button className="btn-primary upgrade-btn" onClick={onUpgrade} disabled={isLoading}>
            {isLoading ? 'Ativando...' : '✨ Assinar Premium'}
          </button>
        </div>
      </div>
      <button className="close-btn" onClick={onClose}>Fechar</button>
    </div>
  </div>
);

const Dashboard = () => {
  const { profile, setProfile, session, signOut } = useAuth();
  const [inputText, setInputText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isReading, setIsReading] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const [readStatusMsg, setReadStatusMsg] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // For bottom nav
  const fileInputRef = useRef(null);

  const isPremium = profile?.plan === 'premium';
  const usageCount = profile?.analysis_count || 0;
  const isAtLimit = !isPremium && usageCount >= FREE_ANALYSIS_LIMIT;

  const categories = [
    { id: 'contracts', name: 'Contratos', icon: '📝', sample: 'CONTRATO DE LOCAÇÃO RESIDENCIAL\nO locador cede o imóvel ao locatário pelo prazo de 30 meses, com valor mensal de R$ 2.500,00, vencimento no dia 10 de cada mês. Em caso de rescisão antecipada, será devida multa de 3 aluguéis proporcionais ao tempo restante de contrato. Reajuste anual pelo IGP-M. O locatário deve dar aviso prévio de 30 dias.' },
    { id: 'medical', name: 'Remédios', icon: '💊', sample: 'BULA - DIPIRONA SÓDICA 500mg\nIndicado para dor e febre. Posologia: 1 comprimido a cada 6 horas. Efeitos adversos: pode causar sonolência e reações alérgicas. Não dirigir após tomar. Contraindicação: gestantes e alérgicos. Não combinar com álcool.' },
    { id: 'exams', name: 'Exames', icon: '🔬', sample: 'RESULTADO DE EXAME LABORATORIAL\nHemoglobina: 11.5 g/dL (Referência: 12.0 - 16.0) - BAIXO.\nGlicose: 105 mg/dL (Referência: 70 - 100) - ALTO.\nColesterol LDL: 140 mg/dL (Referência: < 130) - ALTO.\nPlaquetas: 250.000 (Referência: 150.000 - 400.000) - NORMAL.' },
    { id: 'bills', name: 'Faturas', icon: '💰', sample: 'FATURA DE ENERGIA ELÉTRICA - Competência: 02/2026. Vencimento: 15/03/2026. Consumo: 350 kWh. Custo da energia: R$ 280,00. Tributos: R$ 98,00. Total: R$ 403,00. Após vencimento: juros de 0,33% ao dia + multa de 2%.' },
  ];

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat.id);
    setInputText(cat.sample);
    setFileName('');
    setAnalysisResult(null);
  };

  const handleFileLoad = async (file) => {
    if (!file) return;
    setIsReading(true);
    setReadProgress(0);
    setReadStatusMsg('Carregando arquivo...');
    setInputText('');
    setFileName(file.name);
    setAnalysisResult(null);
    setActiveCategory(null);

    try {
      const text = await readDocument(file, (pct, msg) => {
        setReadProgress(pct);
        setReadStatusMsg(msg);
      });
      setInputText(text);
    } catch (err) {
      setReadStatusMsg('Erro: ' + err.message);
    } finally {
      setIsReading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() || inputText.length < 20) return;
    if (isAtLimit) { setShowPremiumModal(true); return; }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnswer('');
    setQuestion('');

    await new Promise(r => setTimeout(r, 800)); // brief UX pause
    const result = analyzeDocument(inputText);
    if (result) {
      setAnalysisResult(result);
      const { profile: updated } = await incrementUsage(profile.id, usageCount);
      if (updated) setProfile(updated);
    }
    setIsAnalyzing(false);
  };

  const handleAskQuestion = () => {
    if (!question.trim() || !analysisResult) return;
    if (!isPremium) { setShowPremiumModal(true); return; }
    setAnswer(answerQuestion(question, analysisResult));
  };

  const handleUpgrade = async () => {
    setUpgradingPlan(true);
    const { profile: updated } = await setPlan(profile.id, 'premium');
    if (updated) setProfile(updated);
    setUpgradingPlan(false);
    setShowPremiumModal(false);
  };

  const usagePercent = isPremium ? 5 : Math.min((usageCount / FREE_ANALYSIS_LIMIT) * 100, 100);
  const userName = session?.user?.user_metadata?.full_name || session?.user?.email?.split('@')[0] || 'Usuário';

  return (
    <div className="dashboard">
      {showPremiumModal && (
        <PremiumModal onClose={() => setShowPremiumModal(false)} onUpgrade={handleUpgrade} isLoading={upgradingPlan} />
      )}

      <header className="dash-header">
        <div className="header-left">
          <div className="user-avatar">{userName[0]?.toUpperCase()}</div>
          <div className="user-info">
            <h3>Olá, {userName}</h3>
            <p>{profile?.plan === 'premium' ? 'Plano Premium ✨' : 'Plano Gratuito'}</p>
          </div>
        </div>
        <div className="header-right">
          {!isPremium && (
            <button className="premium-badge" onClick={() => setShowPremiumModal(true)}>
              🔓 Upgrade
            </button>
          )}
          <button className="logout-btn" onClick={signOut}>Sair</button>
        </div>
      </header>

      <main className="dash-content">
        {/* Categories Horizontal Scroll */}
        <section className="section-block">
          <h2 className="section-title">O que vamos analisar?</h2>
          <div className="categories-scroll">
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`category-card ${activeCategory === cat.id ? 'active-cat' : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Smart Input Card */}
        <section className="section-block">
          <div
            className={`card upload-area ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileLoad(e.dataTransfer.files[0]); }}
          >
            {isReading && (
              <div className="reading-progress">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${readProgress}%`, background: 'var(--primary)' }} /></div>
                <p>{readStatusMsg}</p>
              </div>
            )}

            {fileName && !isReading && (
              <div className="file-badge">📎 {fileName} <span onClick={() => { setFileName(''); setInputText(''); }}>✕</span></div>
            )}

            <textarea
              placeholder="Cole o texto aqui ou carregue um arquivo..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="doc-textarea"
              rows={6}
            />

            <div className="upload-actions">
              <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>
                📎 Arquivo
              </button>
              <input ref={fileInputRef} type="file" accept={ACCEPT_STRING} hidden onChange={e => handleFileLoad(e.target.files[0])} />
              
              <button
                className="btn-primary analyze-btn"
                onClick={handleAnalyze}
                disabled={isAnalyzing || isReading || inputText.length < 20}
              >
                {isAnalyzing ? 'Processando...' : '🔍 Analisar'}
              </button>
            </div>
          </div>

          {/* Usage Visual */}
          <div className="card usage-bar-wrapper">
            <div className="usage-labels">
              <span>{isPremium ? '✨ Uso Ilimitado' : `Uso: ${usageCount}/${FREE_ANALYSIS_LIMIT}`}</span>
              {!isPremium && <span className="upgrade-link" onClick={() => setShowPremiumModal(true)}>Upgrade →</span>}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: `${usagePercent}%`,
                background: usagePercent >= 90 ? 'var(--error)' : 'var(--primary)'
              }} />
            </div>
          </div>
        </section>

        {/* Results Sections */}
        {analysisResult && !isAnalyzing && (
          <div className="result-container">
            <div className="result-header-bar">
              <div className="result-type-badge">
                <span>{analysisResult.docType.icon}</span>
                <span>{analysisResult.docType.type}</span>
              </div>
              <h2 className="section-title" style={{marginBottom: 0}}>Análise Concluída</h2>
            </div>

            <div className="result-grid">
              <div className="card result-card">
                <h4>📋 Resumo</h4>
                <p>{analysisResult.summary}</p>
              </div>

              <div className="card result-card risk-card">
                <h4>⚠️ Alertas</h4>
                <ul className="points-list">
                  {analysisResult.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>

              <div className="card result-card">
                <h4>📌 Pontos Chave</h4>
                <ul className="points-list">
                  {analysisResult.points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>

              <div className="card result-card">
                <h4>💵 Valores/Prazos</h4>
                <ul className="points-list">
                  {analysisResult.values.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              </div>
            </div>

            <div className="card detail-card">
              <h4>📖 Explicação Detalhada</h4>
              <div className="detail-text">{analysisResult.detailed}</div>
            </div>

            {/* Q&A Smart Card */}
            <div className="card qa-card">
              <h4>💬 Chat sobre o Documento</h4>
              {isPremium ? (
                <div className="qa-input-row" style={{display:'flex', gap:'8px', marginTop:'12px'}}>
                  <input
                    type="text"
                    placeholder="Tire suas dúvidas..."
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAskQuestion()}
                  />
                  <button className="btn-primary" onClick={handleAskQuestion}>Enviar</button>
                </div>
              ) : (
                <div className="premium-upsell" onClick={() => setShowPremiumModal(true)} style={{textAlign:'center', padding:'12px'}}>
                  <p>A dúvida é sua, a resposta é Premium. ✨</p>
                </div>
              )}
              {answer && <div className="qa-answer" style={{marginTop:'12px', padding:'12px', background:'#F0F7FF', borderRadius:'8px', borderLeft:'4px solid var(--primary)'}}><p>{answer}</p></div>}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        <div className={`nav-link ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <span className="nav-icon">🏠</span>
          <span>Início</span>
        </div>
        <div className={`nav-link ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="nav-icon">📜</span>
          <span>Histórico</span>
        </div>
        <div className={`nav-link ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
          <span className="nav-icon">👤</span>
          <span>Perfil</span>
        </div>
      </nav>
    </div>
  );
};

export default Dashboard;
