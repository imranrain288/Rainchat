import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessageSquare, User, AtSign, Mail, Lock, Eye, EyeOff, Sparkles, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
];

export const SignupPage = ({ onSwitchToLogin }) => {
  const { signup } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [bio, setBio] = useState('Hey there! I am using RainChat.');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setSelectedAvatar(`https://api.dicebear.com/7.x/notionists/svg?seed=${randomSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setError('Please fill in all mandatory fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await signup({
        fullName,
        username,
        email,
        password,
        avatar: selectedAvatar,
        bio,
      });
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card" style={{ maxWidth: '480px' }}>
        <div className="auth-brand">
          <div className="brand-icon-box">
            <MessageSquare size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Rain<span style={{ color: 'var(--accent-purple)' }}>Chat</span>
            </h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Join the platform</p>
          </div>
        </div>

        <h2 className="auth-title">Create an Account</h2>
        <p className="auth-subtitle">Register to discover users and start messaging</p>

        {error && (
          <div className="alert-box alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Avatar Selection Picker */}
          <div className="form-group" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <label className="form-label" style={{ textAlign: 'center' }}>
              Choose Your Profile Avatar
            </label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <div className="avatar-wrapper" style={{ width: 64, height: 64 }}>
                <img src={selectedAvatar} alt="Selected profile" className="avatar-img" />
              </div>
              <button
                type="button"
                className="demo-pill"
                onClick={handleRandomizeAvatar}
                title="Generate playful custom avatar"
              >
                <RefreshCw size={14} />
                <span>Randomize</span>
              </button>
            </div>

            </div>
          <div className="form-group">
            <label className="form-label" htmlFor="signup-fullname">
              Full Name
            </label>
            <div className="input-container">
              <User className="input-icon" size={18} />
              <input
                id="signup-fullname"
                type="text"
                className="text-input"
                placeholder="e.g. imran rain"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-username">
              Username
            </label>
            <div className="input-container">
              <AtSign className="input-icon" size={18} />
              <input
                id="signup-username"
                type="text"
                className="text-input"
                placeholder="e.g. imranr"

                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-email">
              Email Address
            </label>
            <div className="input-container">
              <Mail className="input-icon" size={18} />
              <input
                id="signup-email"
                type="email"
                className="text-input"
                placeholder="e.g. imran@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="signup-password">
              Password (min. 6 characters)
            </label>
            <div className="input-container">
              <Lock className="input-icon" size={18} />
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                className="text-input"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
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

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1.25rem' }}>
            {loading ? (
              <span>Creating your profile...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Already Account registered?
          <button
            type="button"
            className="auth-link"
            onClick={onSwitchToLogin}
            style={{ background: 'none', border: 'none', font: 'inherit' }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};
