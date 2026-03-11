import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import './LoginScreen.css';

const LoginScreen = () => {
  const { signInWithGoogle, skipVerification, authError } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    // Page will reload via OAuth redirect
    setLoading(false);
  };

  const handleBypass = async () => {
    setLoading(true);
    await skipVerification();
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-content">
        <header className="login-header">
          <span className="login-logo">📄✨</span>
          <h1>Explica Fácil</h1>
          <p>Inteligência para descomplicar qualquer documento</p>
        </header>

        <div className="login-form">
          <p style={{textAlign: 'center', fontSize: '14px', color: 'var(--text-muted)'}}>
            Faça login para salvar seu histórico e desbloquear recursos premium.
          </p>

          <button className="google-btn" onClick={handleGoogle} disabled={loading}>
            {loading ? 'Aguarde...' : (
              <><span className="google-icon">🌐</span> Entrar com Google</>
            )}
          </button>

          <div className="divider">ou testar agora</div>

          <div style={{textAlign: 'center'}}>
            <span onClick={handleBypass} className="bypass-link">
              Pular Login (Modo Teste)
            </span>
          </div>
        </div>

        {authError && (
          <div className="auth-error">
            <span>⚠️</span> {authError}
          </div>
        )}

        <footer className="login-footer">
          <p>Ao continuar, você aceita nossos termos de uso.</p>
        </footer>
      </div>
    </div>
  );
};

export default LoginScreen;
