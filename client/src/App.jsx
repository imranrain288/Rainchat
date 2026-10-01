import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import { CallProvider } from './context/CallContext';
import { EncryptionProvider } from './context/EncryptionContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { MessageSquare } from 'lucide-react';

const MainApp = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'signup'

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          gap: '1rem',
        }}
      >
        <div className="brand-icon-box" style={{ width: 56, height: 56, borderRadius: 16 }}>
          <MessageSquare size={32} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="typing-dot" style={{ animationDelay: '0s' }} />
          <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
          <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading RainChat...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'signup') {
      return <SignupPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToSignup={() => setAuthView('signup')} />;
  }

  return (
    <EncryptionProvider>
      <SocketProvider>
        <ChatProvider>
          <CallProvider>
            <DashboardPage />
          </CallProvider>
        </ChatProvider>
      </SocketProvider>
    </EncryptionProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
