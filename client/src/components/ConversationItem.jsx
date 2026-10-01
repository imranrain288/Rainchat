import React from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Check, CheckCheck, Star, Pin, PinOff, Trash2, UsersRound } from 'lucide-react';

export const ConversationItem = ({ targetUser, isSelected, onClick, onPinToggle, onRemove }) => {
  const { onlineUsers } = useSocket();
  const { user: currentUser } = useAuth();

  const isOnline = !targetUser.isGroup && onlineUsers.includes(targetUser._id);
  const lastMsg = targetUser.lastMessage;
  const unreadCount = targetUser.unreadCount || 0;
  const isFavorite = lastMsg?.favoritedBy?.some((userId) => userId === currentUser?._id);

  // Format timestamp helper
  const formatTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const isSentByMe = lastMsg && lastMsg.senderId === currentUser?._id;

  return (
    <div className={`conversation-item ${isSelected ? 'active' : ''}`}>
      <button type="button" className="conversation-main" onClick={onClick}>
        <div className="avatar-wrapper">
          {targetUser.isGroup ? <UsersRound size={22} /> : <img
            src={targetUser.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${targetUser.username}&backgroundColor=b6e3f4`}
            alt={targetUser.fullName}
            className="avatar-img"
          />}
          {!targetUser.isGroup && <span className={`status-badge ${isOnline ? 'online' : 'offline'}`} />}
        </div>

        <div className="conversation-content">
          <div className="conversation-top-row">
            <span className="contact-name">{targetUser.fullName}</span>
            {lastMsg && (
              <span className="message-timestamp">
                {formatTime(lastMsg.createdAt)}
              </span>
            )}
          </div>

          <div className="conversation-bottom-row">
            <p className={`last-message-text ${unreadCount > 0 ? 'unread-text' : ''}`}>
              {lastMsg ? (
                <>
                  {isSentByMe && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '4px', verticalAlign: 'middle' }}>
                      {lastMsg.read ? (
                        <CheckCheck size={14} style={{ color: 'var(--accent-cyan)' }} />
                      ) : (
                        <Check size={14} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </span>
                  )}
                  {isSentByMe ? 'You: ' : ''}
                  {lastMsg.messageType === 'image' ? 'Photo' : lastMsg.messageType === 'document' ? 'Document' : lastMsg.messageType === 'audio' ? 'Voice message' : lastMsg.messageType === 'call' ? `Missed ${lastMsg.callType} call` : lastMsg.messageType === 'deleted' ? 'Message deleted' : lastMsg.content}
                  {isFavorite && <Star size={13} className="conversation-favorite-mark" fill="currentColor" title="Favorite message" />}
                </>
              ) : (
                <span style={{ fontStyle: 'italic', opacity: 0.65 }}>
                  {targetUser.bio || 'New member • Say hello! 👋'}
                </span>
              )}
            </p>

            {unreadCount > 0 && (
              <span className="unread-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="conversation-item-actions">
        <button
          type="button"
          className={targetUser.isPinned ? 'pinned' : ''}
          onClick={onPinToggle}
          title={targetUser.isPinned ? 'Unpin conversation' : 'Pin conversation to top'}
          aria-label={targetUser.isPinned ? 'Unpin conversation' : 'Pin conversation to top'}
        >
          {targetUser.isPinned ? <PinOff size={15} /> : <Pin size={15} />}
        </button>
        <button
          type="button"
          className="remove-conversation-btn"
          onClick={onRemove}
          title="Remove from conversation list"
          aria-label={`Remove ${targetUser.fullName} from conversation list`}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
