import React, { useState } from 'react';
import { useAuth } from '../auth/useAuth';
import './LoginScreen.css';

const STEPS = { WELCOME: 'welcome', SEND_EMAIL: 'send_email', OTP: 'otp' };

const LoginScreen = () => {
  const { signInWithGoogle, sendEmailVerificationOTP, verifyEmailOTP, skipVerification, authError, setAuthError, session, needsVerification } = useAuth();
  const [step, setStep] = useState(needsVerification ? STEPS.SEND_EMAIL : STEPS.WELCOME);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // If user just returned from Google OAuth, go straight to email step
  React.useEffect(() => {
    if (needsVerification && !otpSent) setStep(STEPS.SEND_EMAIL);
  }, [needsVerification, otpSent]);

  const handleGoogle = async () => {
    setLoading(true);
    await signInWithGoogle();
    // Page will reload via OAuth redirect
    setLoading(false);
  };

  const handleSendOTP = async () => {
    setLoading(true);
    setAuthError(null);
    const ok = await sendEmailVerificationOTP();
    if (ok) { setOtpSent(true); setStep(STEPS.OTP); }
    setLoading(false);
  };

  const handleVerifyOTP = async () => {
    setLoading(true);
    setAuthError(null);
    const ok = await verifyEmailOTP(otp.trim());
    if (!ok) setLoading(false);
  };

  const handleBypass = async () => {
    setLoading(true);
    await skipVerification();
    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-overlay">
        <div className="login-content glass-card">
          <div className="login-header">
            <div className="login-logo">📄✨</div>
            <h1>Explica Fácil</h1>
            <p>Inteligência para descomplicar qualquer documento</p>
          </div>

          {/* STEP 1 — Welcome / Google */}
          {step === STEPS.WELCOME && (
            <div className="login-form">
              <p className="step-desc">
                Faça login com sua conta Google para começar.
              </p>
              <button className="btn-social google" onClick={handleGoogle} disabled={loading}>
                {loading ? 'Redirecionando...' : (
                  <><span className="social-icon">🔵</span> Entrar com Google</>
                )}
              </button>
              <div className="login-footer">
                <span onClick={handleBypass} className="bypass-link">Pular Login (Modo Teste)</span>
                <small>Ao continuar, você concorda com nossos <strong>Termos de Uso</strong> e <strong>Política de Privacidade</strong>.</small>
              </div>
            </div>
          )}

          {/* STEP 2 — Email Verification Prompt */}
          {step === STEPS.SEND_EMAIL && (
            <div className="login-form">
              {session?.user?.email && (
                <div className="google-ok-badge">
                  ✅ Conta conectada: <strong>{session.user.email}</strong>
                </div>
              )}
              <p className="step-desc">
                Para sua segurança, vamos enviar um código de acesso de 6 dígitos para o seu email.
              </p>
              <button className="btn-primary" onClick={handleSendOTP} disabled={loading}>
                {loading ? 'Enviando...' : '📧 Enviar Código por Email'}
              </button>
              <div className="login-footer">
                <span onClick={handleBypass} className="bypass-link">Pular Verificação (Modo Teste)</span>
                <span onClick={() => { setStep(STEPS.WELCOME); setAuthError(null); }}>← Voltar</span>
              </div>
            </div>
          )}

          {/* STEP 3 — OTP Verification */}
          {step === STEPS.OTP && (
            <div className="login-form">
              <p className="step-desc">
                Código seguro enviado para o seu Email: <strong>{session?.user?.email}</strong>. Digite o código recebido:
              </p>
              <div className="input-group">
                <label>Código de Verificação</label>
                <input
                  type="text"
                  placeholder="Seu código"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  maxLength={8}
                  className="otp-input"
                  autoFocus
                />
              </div>
              <button className="btn-primary" onClick={handleVerifyOTP} disabled={loading || otp.length < 4}>
                {loading ? 'Verificando...' : '✅ Verificar e Entrar'}
              </button>
              <div className="login-footer">
                <span onClick={handleBypass} className="bypass-link">Pular (Entrar agora)</span>
                <span onClick={handleSendOTP}>Reenviar código</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {authError && (
            <div className="auth-error">
              <span>⚠️</span> {authError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
