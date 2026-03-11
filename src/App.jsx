import React from 'react';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/useAuth';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import './styles/global.css';

function AppContent() {
  const { isAuthenticated, needsVerification, loading, session } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '16px',
        background: '#f0f4f8'
      }}>
        <div style={{
          width: '48px', height: '48px', border: '4px solid #e2e8f0',
          borderTopColor: '#a67c52', borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ color: '#627d98', fontSize: '16px' }}>Carregando...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Se estiver logado e NÃO precisar de verificação por email, mostra o Dashboard
  if (session && !needsVerification) {
    return <Dashboard />;
  }

  // Caso contrário, mostra a LoginScreen (para Google ou Verificação de Email)
  return <LoginScreen />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
