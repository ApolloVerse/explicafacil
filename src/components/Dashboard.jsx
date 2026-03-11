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
      // Increment usage in Supabase
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
  const userPhone = profile?.phone ? `📱 ${profile.phone}` : '';

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
            <p>{userPhone}</p>
          </div>
        </div>
        <div className="header-right">
          <button
            className={`premium-badge ${isPremium ? 'active' : ''}`}
            onClick={() => isPremium ? null : setShowPremiumModal(true)}
          >
            {isPremium ? '✨ Premium Ativo' : '🔓 Ver Premium'}
          </button>
          <button className="logout-btn" onClick={signOut}>Sair</button>
        </div>
      </header>

      <div className="dash-content">
        {/* Categories */}
        <section className="section-block">
          <h2 className="section-title">Tipo de Documento</h2>
          <div className="categories-scroll">
            {categories.map(cat => (
              <div
                key={cat.id}
                className={`category-card glass-card ${activeCategory === cat.id ? 'active-cat' : ''}`}
                onClick={() => handleCategoryClick(cat)}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-name">{cat.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Upload Area */}
        <section className="section-block">
          <h2 className="section-title">Carregue ou cole seu documento</h2>

          <div
            className={`upload-area glass-card ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFileLoad(e.dataTransfer.files[0]); }}
          >
            {/* File reading progress */}
            {isReading && (
              <div className="reading-progress">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${readProgress}%` }} /></div>
                <p>{readStatusMsg}</p>
              </div>
            )}

            {fileName && !isReading && (
              <div className="file-badge">📎 {fileName} <span onClick={() => { setFileName(''); setInputText(''); }}>✕</span></div>
            )}

            <textarea
              placeholder="Cole aqui o texto do seu documento, ou arraste um arquivo abaixo..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="doc-textarea"
              rows={8}
            />

            <div className="upload-actions">
              <button className="btn-secondary file-btn" onClick={() => fileInputRef.current.click()}>
                📎 Carregar Arquivo
              </button>
              <div className="supported-formats">
                PDF · JPG · PNG · DOCX · TXT
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                hidden
                onChange={e => handleFileLoad(e.target.files[0])}
              />

              {isAtLimit ? (
                <button className="btn-primary analyze-btn limit-btn" onClick={() => setShowPremiumModal(true)}>
                  🔒 Limite atingido — Premium
                </button>
              ) : (
                <button
                  className="btn-primary analyze-btn"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isReading || inputText.length < 20}
                >
                  {isAnalyzing ? 'Analisando...' : '🔍 Analisar Documento'}
                </button>
              )}
            </div>
          </div>

          {/* Usage bar */}
          <div className="usage-bar-wrapper">
            <div className="usage-labels">
              <span>{isPremium ? '✨ Uso Ilimitado' : `${usageCount}/${FREE_ANALYSIS_LIMIT} análises gratuitas este mês`}</span>
              {!isPremium && (
                <span className="upgrade-link" onClick={() => setShowPremiumModal(true)}>
                  Fazer upgrade →
                </span>
              )}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{
                width: `${usagePercent}%`,
                background: isPremium ? '#a67c52' : usagePercent >= 100 ? '#ef4444' : '#3b82f6'
              }} />
            </div>
          </div>
        </section>

        {/* Loading */}
        {isAnalyzing && (
          <div className="analysis-loading glass-card">
            <div className="spinner" />
            <p>Analisando seu documento com inteligência artificial...</p>
          </div>
        )}

        {/* Results */}
        {analysisResult && !isAnalyzing && (
          <div className="result-container">
            <div className="result-header-bar">
              <div className="result-type-badge">
                <span>{analysisResult.docType.icon}</span>
                <span>{analysisResult.docType.type}</span>
              </div>
              <h2>Resultado da Análise</h2>
            </div>

            <div className="result-grid">
              <div className="result-card glass-card">
                <h4>📋 Resumo Simples</h4>
                <p>{analysisResult.summary}</p>
              </div>

              <div className="result-card glass-card">
                <h4>📌 Pontos Importantes</h4>
                <ul className="points-list">
                  {analysisResult.points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>

              <div className="result-card glass-card">
                <h4>💵 Valores e Prazos</h4>
                <ul className="points-list">
                  {analysisResult.values.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              </div>

              <div className="result-card glass-card risk-card">
                <h4>⚠️ Alertas e Riscos</h4>
                <ul className="points-list">
                  {analysisResult.risks.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            </div>

            <div className="result-card detail-card glass-card">
              <h4>📖 Explicação Passo a Passo</h4>
              <pre className="detail-text">{analysisResult.detailed}</pre>
            </div>

            {analysisResult.terms.length > 0 && (
              <div className="result-card glass-card">
                <h4>📚 Glossário de Termos Técnicos</h4>
                <div className="terms-grid">
                  {analysisResult.terms.map((t, i) => (
                    <div key={i} className="term-item">
                      <span className="term-name">"{t.term}"</span>
                      <span className="term-explanation">= {t.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Q&A */}
            <div className="result-card qa-card glass-card">
              <h4>❓ Pergunte sobre o Documento</h4>
              {isPremium ? (
                <>
                  <div className="qa-input-row">
                    <input
                      type="text"
                      placeholder="Ex: Qual a multa de cancelamento?"
                      value={question}
                      onChange={e => setQuestion(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAskQuestion()}
                    />
                    <button className="btn-primary" onClick={handleAskQuestion}>Perguntar</button>
                  </div>
                  {answer && <div className="qa-answer"><p><strong>Resposta:</strong> {answer}</p></div>}
                </>
              ) : (
                <div className="premium-upsell" onClick={() => setShowPremiumModal(true)}>
                  <p>💡 Perguntas sobre o documento são exclusivas do plano Premium.</p>
                  <button className="btn-primary">✨ Ativar Premium — R$ 19,90/mês</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
