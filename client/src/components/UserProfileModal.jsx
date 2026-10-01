import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Save, RefreshCw, CheckCircle2, Trash2, AlertCircle } from 'lucide-react';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
];

export const UserProfileModal = ({ isOpen, onClose }) => {
  const { user, updateProfile, deleteAccount } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!isOpen || !user) return null;

  const handleRandomize = () => {
    const seed = Math.random().toString(36).substring(7);
    setAvatar(`https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,ffd5dc`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      await updateProfile({ fullName, bio, avatar });
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => {
        setSuccessMsg('');
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleteError('');
    setDeleting(true);
    try {
      await deleteAccount();
      onClose();
    } catch (err) {
      setDeleteError(err.message || 'Could not delete the account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title"> Profile Settings</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <X size={10} />
          </button>
        </div>

        {successMsg && (
          <div className="alert-box alert-success">
            <CheckCircle2 size={10} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Avatar Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div className="avatar-wrapper" style={{ width: 72, height: 72, marginBottom: '0.75rem' }}>
              <img src={avatar} alt={fullName} className="avatar-img" />
            </div>
            <button type="button" className="demo-pill" onClick={handleRandomize}>
              <RefreshCw size={14} />
              <span>Random Avatar</span>
            </button>
          </div>

          {/* Preset Avatars */}
          

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="text-input"
              style={{ paddingLeft: '1rem' }}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Username (Immutable)</label>
            <input
              type="text"
              className="text-input"
              style={{ paddingLeft: '1rem', opacity: 0.6 }}
              value={`@${user.username}`}
              disabled
            />
          </div>

<div className="form-group">
            <label className="form-label">email (Immutable)</label>
            <input
              type="text"
              className="text-input"
              style={{ paddingLeft: '1rem', opacity: 0.6 }}
              value={`@${user.email}`}
              disabled
            />
          </div>
          <div className="form-group">
            <label className="form-label"> Status</label>
            <input
              type="text"
              className="text-input"
              style={{ paddingLeft: '1rem' }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={120}
              placeholder="What's on your mind?"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={18} />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </form>

        <section className="account-danger-zone">
          <button
            type="button"
            className="account-delete-button"
            onClick={handleDeleteAccount}
            disabled={saving || deleting}
          >
            <Trash2 size={17} />
            <span>{deleting ? 'Deleting account...' : 'Delete account'}</span>
          </button>
          {deleteError && (
            <div className="alert-box alert-error" role="alert" style={{ marginTop: '0.75rem' }}>
              <AlertCircle size={18} />
              <span>{deleteError}</span>
            </div>
          )}
</section>
</div>
</div>
)};
