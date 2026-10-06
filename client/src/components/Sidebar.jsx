import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { ConversationList } from './ConversationList';
import { UserProfileModal } from './UserProfileModal';
import { Search, LogOut, Settings, Sparkles, Sun, Moon, UsersRound, X } from 'lucide-react';

export const Sidebar = ({ isMobileOpen, onSelectUser, onOpenAssistant, isAssistantOpen, theme, onToggleTheme }) => {
  const { user, logout } = useAuth();
  const { users, createGroup } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [groupError, setGroupError] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    setGroupError('');
    try {
      setCreatingGroup(true);
      await createGroup(groupName, selectedMemberIds);
      setIsGroupModalOpen(false);
      setGroupName('');
      setSelectedMemberIds([]);
    } catch (error) {
      setGroupError(error.message || 'Could not create this group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <aside className={`sidebar ${isMobileOpen ? '' : 'hidden-mobile'}`}>
      {/* Top User Profile Header */}
      <div className="sidebar-header">
        <div className="user-profile-bar">
          <div
            className="profile-avatar-info"
            onClick={() => setIsProfileModalOpen(true)}
            title="Edit profile & avatar"
          >
            <div className="avatar-wrapper">
              <img
                src={
                  user?.avatar ||
                  `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.username}&backgroundColor=b6e3f4`
                }
                alt={user?.fullName}
                className="avatar-img"
              />
              <span className="status-badge online" />
            </div>
            <div className="user-text-info">
              <span className="user-name">{user?.fullName}</span>
              <span className="user-username">@{user?.username}</span>
            </div>
          </div>

          <div className="profile-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              aria-pressed={theme === 'light'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsProfileModalOpen(true)}
              title="Profile Settings"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              className="icon-btn danger"
              onClick={logout}
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Search registered users */}
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search registered members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`assistant-launcher ${isAssistantOpen ? 'active' : ''}`}
          onClick={onOpenAssistant}
          aria-pressed={isAssistantOpen}
        >
          <Sparkles size={17} />
          <span>Gemini assistant</span>
        </button>
      </div>

      {/* Conversation List Header */}
      <div className="conversation-list-header">
        <span className="section-title">Registered Members</span>
        <div className="conversation-header-tools">
          <span className="registered-count-badge">{users.length}</span>
          <button type="button" className="icon-btn" onClick={() => setIsGroupModalOpen(true)} title="Create group" aria-label="Create group">
            <UsersRound size={17} />
          </button>
        </div>
      </div>

      {/* Scrollable Conversation List */}
      <ConversationList
        searchQuery={searchQuery}
        onSelectUser={onSelectUser}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
      {isGroupModalOpen && (
        <div className="group-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsGroupModalOpen(false);
        }}>
          <form className="group-modal" onSubmit={handleCreateGroup} aria-labelledby="create-group-title">
            <div className="group-modal-heading">
              <div><h2 id="create-group-title">Create a group</h2><p>Start a conversation with your people.</p></div>
              <button type="button" className="icon-btn" onClick={() => setIsGroupModalOpen(false)} aria-label="Close group form"><X size={18} /></button>
            </div>
            <label className="form-label" htmlFor="group-name">Group name</label>
            <input id="group-name" className="text-input group-name-input" value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} required />
            <span className="form-label group-members-label">Choose at least two members. Everyone must sign in once to set up encryption.</span>
            <div className="group-member-options">
              {users.filter((person) => !person.isGroup).map((person) => (
                <label key={person._id} className="group-member-option">
                  <input
                    type="checkbox"
                    disabled={!person.encryptionPublicKey}
                    checked={selectedMemberIds.includes(person._id)}
                    onChange={(event) => setSelectedMemberIds((current) => event.target.checked ? [...current, person._id] : current.filter((id) => id !== person._id))}
                  />
                  <img src={person.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${person.username}`} alt="" />
                  <span>{person.fullName}{!person.encryptionPublicKey && ' (encryption not set up)'}</span>
                </label>
              ))}
            </div>
            {groupError && <p className="composer-error" role="alert">{groupError}</p>}
            <button type="submit" className="btn-primary" disabled={creatingGroup || groupName.trim().length < 2 || selectedMemberIds.length < 2}>
              {creatingGroup ? 'Creating…' : 'Create group'}
            </button>
          </form>
        </div>
      )}
    </aside>
  );
};
