import React, { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { api } from '../services/api';
import { useEncryption } from '../context/EncryptionContext';
import { ConversationItem } from './ConversationItem';
import { SearchX, Star } from 'lucide-react';

export const ConversationList = ({ searchQuery, onSelectUser }) => {
    const {
        users,
        selectedUser,
        loadingUsers,
        toggleConversationPin,
        removeConversationFromList,
    } = useChat();
    const { user } = useAuth();
    const { socket } = useSocket();
    const { decryptMessage } = useEncryption();
    const [activeView, setActiveView] = useState('people');
    const [favoriteMessages, setFavoriteMessages] = useState([]);
    const [loadingFavorites, setLoadingFavorites] = useState(false);

    useEffect(() => {
        if (activeView !== 'starred' || !user?._id) return undefined;
        let isActive = true;
        const loadFavorites = async () => {
            try {
                setLoadingFavorites(true);
                const response = await api.getFavoriteMessages();
                if (isActive && response.success) {
                    setFavoriteMessages(await Promise.all(response.messages.map(decryptMessage)));
                }
            } catch (error) {
                console.error('Failed to load favorite messages:', error);
            } finally {
                if (isActive) setLoadingFavorites(false);
            }
        };
        loadFavorites();
        socket?.on('messageUpdated', loadFavorites);
        socket?.on('messageDeleted', loadFavorites);
        socket?.on('chatHistoryCleared', loadFavorites);
        socket?.on('chatHistoryDeleted', loadFavorites);
        return () => {
            isActive = false;
            socket?.off('messageUpdated', loadFavorites);
            socket?.off('messageDeleted', loadFavorites);
            socket?.off('chatHistoryCleared', loadFavorites);
            socket?.off('chatHistoryDeleted', loadFavorites);
        };
    }, [activeView, socket, user?._id, decryptMessage]);

    const filteredUsers = users.filter((u) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
            u.fullName.toLowerCase().includes(q) ||
            u.username.toLowerCase().includes(q) ||
            (u.email && u.email.toLowerCase().includes(q))
        );
    });

    const filteredFavorites = favoriteMessages.filter((message) => {
        if (!searchQuery) return true;
        const otherUser = message.senderId?._id === user?._id ? message.receiverId : message.senderId;
        const query = searchQuery.toLowerCase();
        const preview = message.messageType === 'image' ? 'photo' : message.messageType === 'audio' ? 'voice message' : message.messageType === 'document' ? 'document' : (message.content || '').toLowerCase();
        return preview.includes(query) ||
            (otherUser?.fullName || '').toLowerCase().includes(query) ||
            (otherUser?.username || '').toLowerCase().includes(query);
    });

    return (
        <div className="conversation-list-panel">
            <div className="conversation-list-tabs" role="tablist" aria-label="Conversation list view">
                <button type="button" role="tab" aria-selected={activeView === 'people'} className={activeView === 'people' ? 'active' : ''} onClick={() => setActiveView('people')}>
                    People
                </button>
                <button type="button" role="tab" aria-selected={activeView === 'starred'} className={activeView === 'starred' ? 'active' : ''} onClick={() => setActiveView('starred')}>
                    <Star size={14} /> Starred
                </button>
            </div>

            {activeView === 'people' ? (
                loadingUsers && users.length === 0 ? (
                    <div className="empty-list-box">
                        <div className="typing-dot" style={{ width: 12, height: 12, animation: 'pulseSubtle 1s infinite' }} />
                        <p>Loading registered members...</p>
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div className="empty-list-box">
                        <SearchX size={32} style={{ color: 'var(--text-muted)' }} />
                        <p>{searchQuery ? `No members matching "${searchQuery}"` : 'No registered users found yet.'}</p>
                    </div>
                ) : (
                    <div className="conversations-scroll">
                        {filteredUsers.map((targetUser) => (
                            <ConversationItem
                                key={targetUser._id}
                                targetUser={targetUser}
                                isSelected={selectedUser?._id === targetUser._id}
                                onClick={() => onSelectUser(targetUser)}
                                onPinToggle={() => toggleConversationPin(targetUser._id)}
                                onRemove={() => {
                                    if (window.confirm(`Remove ${targetUser.fullName} from your conversation list? Their message history will be kept.`)) {
                                        removeConversationFromList(targetUser._id);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )
            ) : loadingFavorites ? (
                <div className="empty-list-box"><p>Loading starred messages...</p></div>
            ) : filteredFavorites.length === 0 ? (
                <div className="empty-list-box">
                    <Star size={28} style={{ color: 'var(--text-muted)' }} />
                    <p>{searchQuery ? 'No starred messages match your search.' : 'Star a message to save it here.'}</p>
                </div>
            ) : (
                <div className="conversations-scroll">
                    {filteredFavorites.map((message) => {
                        const otherUser = message.senderId?._id === user?._id ? message.receiverId : message.senderId;
                        return (
                            <div
                                key={message._id}
                                className="favorite-list-item"
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelectUser(otherUser)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') onSelectUser(otherUser);
                                }}
                            >
                                <div className="favorite-list-item-top">
                                    <strong>{otherUser?.fullName || 'Conversation'}</strong>
                                    <Star size={13} fill="currentColor" />
                                </div>
                                <p>{message.messageType === 'image' ? 'Photo' : message.messageType === 'audio' ? 'Voice message' : message.messageType === 'document' ? 'Document' : message.content}</p>
                                <time>{new Date(message.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</time>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
