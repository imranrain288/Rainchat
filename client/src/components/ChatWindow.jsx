import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { MessageInput } from './MessageInput';
import { ChevronLeft, Check, CheckCheck, Reply, Pencil, Trash2, Star, X, MoreVertical, Eraser, Ban, FileText, UsersRound, Phone, Video, PhoneCall, LockKeyhole } from 'lucide-react';
import { useCall } from '../context/CallContext';
import { useEncryption } from '../context/EncryptionContext';

export const ChatWindow = ({ onBackToSidebar }) => {
  const {
    selectedUser,
    messages,
    loadingMessages,
    typingUsers,
    editMessage,
    deleteMessage,
    toggleFavoriteMessage,
    clearChatHistory,
    deleteConversationHistory,
    setUserBlocked,
  } = useChat();
  const { onlineUsers } = useSocket();
  const { call, startCall } = useCall();
  const { status: encryptionStatus, error: encryptionError } = useEncryption();
  const { user: currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const previousStatusRef = useRef({ userId: null, online: false });
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [offlineNotice, setOfflineNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);

  const isOnline = selectedUser && !selectedUser.isGroup && onlineUsers.includes(selectedUser._id);
  const isTyping = selectedUser && !selectedUser.isGroup && typingUsers[selectedUser._id];

  useEffect(() => {
    if (!selectedUser) return;
    const previousStatus = previousStatusRef.current;
    if (previousStatus.userId === selectedUser._id && previousStatus.online && !isOnline) {
      setOfflineNotice(`${selectedUser.fullName} went offline.`);
    }
    previousStatusRef.current = { userId: selectedUser._id, online: Boolean(isOnline) };
  }, [selectedUser, isOnline]);

  useEffect(() => {
    setReplyTo(null);
    setEditingMessageId(null);
    setEditContent('');
  }, [selectedUser?._id]);

  useEffect(() => {
    if (!offlineNotice) return undefined;
    const timeoutId = setTimeout(() => setOfflineNotice(''), 5000);
    return () => clearTimeout(timeoutId);
  }, [offlineNotice]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (left, right) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
    if (sameDay(date, today)) return 'Today';
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const handleSaveEdit = async (messageId) => {
    try {
      setActionError('');
      await editMessage(messageId, editContent);
      setEditingMessageId(null);
      setEditContent('');
    } catch (error) {
      setActionError(error.message || 'Could not edit this message.');
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      setActionError('');
      await deleteMessage(messageId);
    } catch (error) {
      setActionError(error.message || 'Could not delete this message.');
    }
  };

  const handleFavorite = async (messageId) => {
    try {
      setActionError('');
      await toggleFavoriteMessage(messageId);
    } catch (error) {
      setActionError(error.message || 'Could not update this favorite.');
    }
  };

  const handleClearHistory = async () => {
    setIsChatMenuOpen(false);
    if (!window.confirm(`Clear message history with ${selectedUser.fullName} for both participants? This cannot be undone.`)) return;
    try {
      setActionError('');
      await clearChatHistory(selectedUser._id);
    } catch (error) {
      setActionError(error.message || 'Could not clear this chat history.');
    }
  };

  const handleDeleteHistory = async () => {
    setIsChatMenuOpen(false);
    if (!window.confirm(`Delete message history with ${selectedUser.fullName} for both participants and remove this chat from your list? This cannot be undone.`)) return;
    try {
      setActionError('');
      await deleteConversationHistory(selectedUser._id);
    } catch (error) {
      setActionError(error.message || 'Could not delete this chat history.');
    }
  };

  const handleToggleBlock = async () => {
    const blocked = !selectedUser.isBlockedByMe;
    setIsChatMenuOpen(false);
    if (blocked && !window.confirm(`Block ${selectedUser.fullName}? Neither of you will be able to send messages.`)) return;
    try {
      setIsUpdatingBlock(true);
      setActionError('');
      await setUserBlocked(selectedUser._id, blocked);
    } catch (error) {
      setActionError(error.message || 'Could not update block status.');
    } finally {
      setIsUpdatingBlock(false);
    }
  };

  if (!selectedUser) return null;

  return (
    <main className="chat-area active-mobile">
      {/* Chat Top Header */}
      <header className="chat-header">
        <div className="chat-recipient-info">
          <button
            type="button"
            className="back-to-sidebar-btn"
            onClick={onBackToSidebar}
            title="Back to conversation list"
          >
            <ChevronLeft size={24} />
          </button>

          <div className="avatar-wrapper" style={{ width: 42, height: 42 }}>
            {selectedUser.isGroup ? <UsersRound size={22} /> : <img
              src={
                selectedUser.avatar ||
                `https://api.dicebear.com/7.x/notionists/svg?seed=${selectedUser.username}&backgroundColor=b6e3f4`
              }
              alt={selectedUser.fullName}
              className="avatar-img"
            />}
            {!selectedUser.isGroup && <span className={`status-badge ${isOnline ? 'online' : 'offline'}`} />}
          </div>

          <div>
            <div className="chat-recipient-name">
              <span>{selectedUser.fullName}</span>
            </div>
            <div className="chat-recipient-status">
              {encryptionStatus === 'ready' && <span className="encryption-ready-label" title="Messages are end-to-end encrypted"><LockKeyhole size={12} /> Encrypted</span>}
              {!selectedUser.isGroup && <><span className={`status-dot ${isOnline ? 'online' : 'offline'}`} /><span>{isOnline ? 'Active now' : 'Offline'}</span></>}
              {selectedUser.isGroup && <span>{selectedUser.participants?.length || 0} members</span>}
              {!selectedUser.isGroup && selectedUser.bio && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  • {selectedUser.bio}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          {!selectedUser.isGroup && !selectedUser.isBlockedByMe && !selectedUser.hasBlockedMe && (
            <>
              <button type="button" className="icon-btn" onClick={() => startCall(selectedUser, 'audio')} disabled={Boolean(call)} title="Start voice call" aria-label="Start voice call"><Phone size={18} /></button>
              <button type="button" className="icon-btn" onClick={() => startCall(selectedUser, 'video')} disabled={Boolean(call)} title="Start video call" aria-label="Start video call"><Video size={18} /></button>
            </>
          )}
          {/* Subtle online badge */}
          {!selectedUser.isGroup && <span
            style={{
              fontSize: '0.75rem',
              color: isOnline ? 'var(--accent-emerald)' : 'var(--text-muted)',
              background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.05)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-full)',
              fontWeight: 600,
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </span>}
          {!selectedUser.isGroup && <div className="chat-history-menu">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setIsChatMenuOpen((isOpen) => !isOpen)}
              title="Conversation actions"
              aria-label="Conversation actions"
              aria-expanded={isChatMenuOpen}
            >
              <MoreVertical size={19} />
            </button>
            {isChatMenuOpen && (
              <div className="chat-history-menu-panel" role="menu">
                <button type="button" role="menuitem" onClick={handleClearHistory}>
                  <Eraser size={16} /> Clear history
                </button>
                <button type="button" role="menuitem" className="danger" onClick={handleDeleteHistory}>
                  <Trash2 size={16} /> Delete history and remove chat
                </button>
                <button type="button" role="menuitem" className={selectedUser.isBlockedByMe ? '' : 'danger'} onClick={handleToggleBlock} disabled={isUpdatingBlock}>
                  <Ban size={16} /> {selectedUser.isBlockedByMe ? 'Unblock user' : 'Block user'}
                </button>
              </div>
            )}
          </div>}
        </div>
      </header>

      {encryptionStatus !== 'ready' && (
        <div className="encryption-status-banner" role={encryptionStatus === 'error' ? 'alert' : 'status'}>
          {encryptionStatus === 'loading' ? 'Preparing this device’s encryption key…' : encryptionError}
        </div>
      )}

      {offlineNotice && <div className="offline-chat-notice" role="status">{offlineNotice}</div>}
      {actionError && (
        <div className="chat-action-error" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label="Dismiss error"><X size={15} /></button>
        </div>
      )}

      {/* Message Feed Container */}
      <div className="messages-container">
        {loadingMessages ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="typing-dot" style={{ width: 10, height: 10, animation: 'RainSubtle 1s infinite' }} />
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-list-box" style={{ margin: 'auto' }}>
            <p>No messages exchanged with {selectedUser.fullName.split(' ')[0]} yet.</p>
            
          </div>
        ) : (
          messages.map((msg, messageIndex) => {
            const senderId = String(msg.senderId?._id || msg.senderId);
            const isMe = senderId === currentUser?._id;
            const isFavorite = msg.favoritedBy?.some((userId) => userId === currentUser?._id);
            const previousMessage = messages[messageIndex - 1];
            const currentDate = new Date(msg.createdAt);
            const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;
            const startsNewDay = !previousDate || currentDate.toDateString() !== previousDate.toDateString();
            const messageSender = selectedUser.isGroup
              ? selectedUser.participants?.find((participant) => String(participant._id) === senderId)
              : null;
            return (
              <React.Fragment key={msg._id}>
              {startsNewDay && <div className="date-divider"><div className="date-divider-line" /><span className="date-divider-pill">{formatDateDivider(msg.createdAt)}</span></div>}
              <div className={`message-row ${isMe ? 'me' : 'them'} ${msg.messageType === 'call' ? 'call-event-row' : ''}`}>
                {!isMe && msg.messageType !== 'call' && (
                  <div className="avatar-wrapper" style={{ width: 32, height: 32, alignSelf: 'flex-end' }}>
                    <img
                      src={selectedUser.isGroup
                        ? (msg.senderAvatar || messageSender?.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${msg.senderName || senderId}`)
                        : (selectedUser.avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${selectedUser.username}`)}
                      alt={selectedUser.isGroup ? (msg.senderName || messageSender?.fullName || 'Group member') : selectedUser.fullName}
                      className="avatar-img"
                    />
                  </div>
                )}

                <div className="message-bubble-wrapper">
                  <div className={`message-bubble ${msg.messageType === 'call' ? 'call-event-bubble' : ''} ${msg.messageType === 'deleted' ? 'deleted-message-bubble' : ''}`}>
                    {msg.messageType === 'call' ? (
                      <><PhoneCall size={16} /><span>{isMe ? `Missed ${msg.callType} call` : `Missed ${msg.callType} call from ${selectedUser.fullName}`}</span></>
                    ) : msg.messageType === 'deleted' ? (
                      <span className="deleted-message-content">This message was deleted</span>
                    ) : <>
                    {selectedUser.isGroup && !isMe && <span className="group-message-author">{msg.senderName || messageSender?.fullName || 'Group member'}</span>}
                    {msg.replyTo && (
                      <div className="message-reply-preview">
                        <span>{String(msg.replyTo.senderId?._id || msg.replyTo.senderId) === currentUser?._id ? 'You' : selectedUser.fullName}</span>
                        <p>{msg.replyTo.messageType === 'image' ? 'Photo' : msg.replyTo.messageType === 'document' ? 'Document' : msg.replyTo.messageType === 'audio' ? 'Voice message' : msg.replyTo.content}</p>
                      </div>
                    )}
                    {editingMessageId === msg._id ? (
                      <div className="message-edit-form">
                        <textarea value={editContent} onChange={(event) => setEditContent(event.target.value)} autoFocus />
                        <button type="button" onClick={() => handleSaveEdit(msg._id)} disabled={!editContent.trim()}>Save</button>
                        <button type="button" onClick={() => setEditingMessageId(null)}>Cancel</button>
                      </div>
                    ) : msg.decryptionFailed ? (
                      <span className="decryption-warning">Unable to decrypt this message on this device.</span>
                    ) : msg.messageType === 'image' ? (
                      <a href={msg.content} target="_blank" rel="noreferrer" className="message-image-link">
                        <img src={msg.content} alt="Shared image" className="message-image" />
                      </a>
                    ) : msg.messageType === 'document' ? (
                      <a href={msg.content} download={msg.attachmentName || 'shared-file'} className="message-document-link">
                        <FileText size={21} />
                        <span>{msg.attachmentName || 'Download document'}</span>
                      </a>
                    ) : msg.messageType === 'audio' ? (
                      <audio className="message-audio" controls preload="metadata" src={msg.content}>Voice message</audio>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                    </>}
                  </div>
                  {!['call', 'deleted'].includes(msg.messageType) && <div className="message-action-row">
                    <button type="button" onClick={() => setReplyTo(msg)} title="Reply" aria-label="Reply to message">
                      <Reply size={15} />
                    </button>
                    {isMe && !['image', 'document', 'audio'].includes(msg.messageType) && editingMessageId !== msg._id && (
                      <button
                        type="button"
                        onClick={() => { setEditingMessageId(msg._id); setEditContent(msg.content); }}
                        title="Edit message"
                        aria-label="Edit message"
                      >
                        <Pencil size={14} />
                      </button>
                    )}
                    {isMe && (
                      <button type="button" onClick={() => handleDelete(msg._id)} title="Delete message" aria-label="Delete message">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={isFavorite ? 'favorited' : ''}
                      onClick={() => handleFavorite(msg._id)}
                      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star size={14} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>}
                  <div className="message-meta">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {msg.edited && <span>Edited</span>}
                    {isFavorite && <Star size={12} className="favorite-message-mark" fill="currentColor" />}
                    {isMe && (
                      <span>
                        {msg.read ? (
                          <CheckCheck size={14} className="check-icon read" title="Read" />
                        ) : (
                          <Check size={14} className="check-icon" title="Delivered" />
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              </React.Fragment>
            );
          })
        )}

        {/* Real-time Typing Bubble */}
        {isTyping && (
          <div className="message-row them">
            <div className="typing-bubble">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '6px' }}>
              {selectedUser.fullName.split(' ')[0]} is typing...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      {encryptionStatus !== 'ready' ? (
        <div className="blocked-chat-notice" role="status">Messages are locked until end-to-end encryption is ready on this device.</div>
      ) : !selectedUser.isGroup && (selectedUser.isBlockedByMe || selectedUser.hasBlockedMe) ? (
        <div className="blocked-chat-notice" role="status">
          {selectedUser.isBlockedByMe ? 'You blocked this user. Unblock them to send messages.' : 'You cannot message this user.'}
        </div>
      ) : (
        <MessageInput replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      )}
    </main>
  );
};
