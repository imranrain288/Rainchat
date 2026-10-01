import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

export const LoginPage = ({ onSwitchToSignup }) => {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!identifier.trim() || !password) {
      setError('Please provide your username/email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(identifier, password);
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = (email, pass) => {
    setIdentifier(email);
    setPassword(pass);
    setError('');
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon-box">
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Rain<span style={{ color: 'var(--accent-purple)' }}>Chat</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>messaging Platform</p>
          </div>
        </div>

        <h2 className="auth-title">Welcome back</h2>
        <p className="auth-subtitle">Sign in to your account to continue chatting</p>

        {error && (
          <div className="alert-box alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-identifier">
              Email or Username
            </label>
            <div className="input-container">
              <Mail className="input-icon" size={18} />
              <input
                id="login-identifier"
                type="text"
                className="text-input"
                placeholder="e.g. imran@example.com or imranr"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <div className="input-container">
              <Lock className="input-icon" size={18} />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Dashboard </span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account yet?
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToSignup}
            style={{ background: 'none', border: 'none', font: 'inherit' }}
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  );
};
