import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useEncryption } from './EncryptionContext';

const ChatContext = createContext(null);

const sortConversations = (conversations) => [...conversations].sort((a, b) => {
  if (Boolean(a.isPinned) !== Boolean(b.isPinned)) return Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned));
  const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
  const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
  return timeB - timeA || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
});

export const ChatProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { encryptContent, decryptMessage, status: encryptionStatus } = useEncryption();

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: boolean }

  // Fetch registered users with conversation snippet
  const loadUsers = useCallback(async (search = '') => {
    if (!user) return;
    try {
      setLoadingUsers(true);
      const res = await api.getUsers(search);
      if (res.success) {
        setUsers(sortConversations(res.users));
      }
    } catch (err) {
      console.error('Failed to load registered users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [user]);

  // Initial fetch of registered users
  useEffect(() => {
    if (user && encryptionStatus !== 'loading') {
      loadUsers();
    } else if (!user) {
      setUsers([]);
      setSelectedUser(null);
      setMessages([]);
    }
  }, [user, loadUsers, encryptionStatus]);

  // Load messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser?._id) {
      setMessages([]);
      return;
    }
    if (encryptionStatus === 'loading') return;

    const loadConversationMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await api.getMessages(selectedUser._id, selectedUser.isGroup);
        if (res.success) {
          setMessages(await Promise.all(res.messages.map(decryptMessage)));

          // Clear unread count for this user in sidebar list
          setUsers((prevUsers) =>
            prevUsers.map((u) =>
              u._id === selectedUser._id ? { ...u, unreadCount: 0 } : u
            )
          );
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadConversationMessages();
  }, [selectedUser?._id, selectedUser?.isGroup, encryptionStatus, decryptMessage]);

  // Socket.io Real-time Event Subscriptions
  useEffect(() => {
    if (!socket || encryptionStatus !== 'ready') return;

    // Handle incoming new message
    const handleNewMessage = async (incomingMessage) => {
      const newMsg = await decryptMessage(incomingMessage);
      // If message is from currently open chat partner
      if (selectedUser && selectedUser._id === newMsg.senderId) {
        setMessages((prev) => [...prev, newMsg]);
        // Notify sender that message is read
        socket.emit('markAsRead', {
          senderId: newMsg.senderId,
          receiverId: user._id,
        });
      } else if (selectedUser?.isGroup && selectedUser._id === newMsg.conversationId) {
        setMessages((prev) => [...prev, newMsg]);
      }

      // Update sidebar conversation list order and snippet
      setUsers((prevUsers) => {
        const userIndex = prevUsers.findIndex(
          (u) => u._id === newMsg.conversationId || u._id === newMsg.senderId || u._id === newMsg.receiverId
        );

        if (userIndex !== -1) {
          const targetUser = prevUsers[userIndex];
          const isCurrentlyActiveChat = selectedUser?._id === targetUser._id;

          const updatedTargetUser = {
            ...targetUser,
            lastMessage: {
              _id: newMsg._id,
              content: newMsg.messageType === 'image' ? 'Photo' : newMsg.messageType === 'document' ? 'Document' : newMsg.messageType === 'audio' ? 'Voice message' : newMsg.messageType === 'call' ? `Missed ${newMsg.callType} call` : newMsg.messageType === 'deleted' ? 'Message deleted' : newMsg.content,
              senderId: newMsg.senderId,
              createdAt: newMsg.createdAt,
              read: newMsg.read,
              messageType: newMsg.messageType,
              callType: newMsg.callType,
              favoritedBy: newMsg.favoritedBy,
            },
            unreadCount:
              !isCurrentlyActiveChat && (targetUser.isGroup || newMsg.senderId === targetUser._id)
                ? (targetUser.unreadCount || 0) + 1
                : 0,
          };

          return sortConversations(prevUsers.map((existingUser) => (
            existingUser._id === updatedTargetUser._id ? updatedTargetUser : existingUser
          )));
        }

        // If new registered user sent message not in state yet, refresh list
        loadUsers();
        return prevUsers;
      });
    };

    const handleGroupCreated = (group) => {
      setUsers((previous) => sortConversations([group, ...previous.filter((entry) => entry._id !== group._id)]));
    };

    // Handle real-time read receipt notification
    const handleMessagesRead = ({ readBy }) => {
      if (selectedUser && selectedUser._id === readBy) {
        setMessages((prev) =>
          prev.map((m) => (m.senderId === user._id ? { ...m, read: true } : m))
        );
      }
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u._id === readBy && u.lastMessage && u.lastMessage.senderId === user._id
            ? { ...u, lastMessage: { ...u.lastMessage, read: true } }
            : u
        )
      );
    };

    const handleMessageUpdated = async (encryptedMessage) => {
      const updatedMessage = await decryptMessage(encryptedMessage);
      setMessages((prev) => prev.map((message) =>
        message._id === updatedMessage._id ? updatedMessage : message
      ));
      const otherUserId = updatedMessage.conversationId || (updatedMessage.senderId === user?._id
        ? updatedMessage.receiverId
        : updatedMessage.senderId);
      setUsers((prev) => prev.map((conversationUser) => {
        if (conversationUser._id !== otherUserId || conversationUser.lastMessage?._id !== updatedMessage._id) {
          return conversationUser;
        }
        return {
          ...conversationUser,
          lastMessage: {
            ...conversationUser.lastMessage,
              content: updatedMessage.messageType === 'image' ? 'Photo' : updatedMessage.messageType === 'document' ? 'Document' : updatedMessage.messageType === 'audio' ? 'Voice message' : updatedMessage.messageType === 'call' ? `Missed ${updatedMessage.callType} call` : updatedMessage.messageType === 'deleted' ? 'Message deleted' : updatedMessage.content,
            edited: updatedMessage.edited,
            favoritedBy: updatedMessage.favoritedBy,
          },
        };
      }));
    };

    const handleMessageDeleted = ({ messageId, message: deletedMessage }) => {
      if (deletedMessage) {
        setMessages((prev) => prev.map((message) => message._id === messageId ? deletedMessage : message));
      } else {
        setMessages((prev) => prev.filter((message) => message._id !== messageId));
      }
      loadUsers();
    };

    const handleConversationPinUpdated = ({ userId, isPinned }) => {
      setUsers((prev) => sortConversations(prev.map((conversationUser) => (
        conversationUser._id === userId ? { ...conversationUser, isPinned } : conversationUser
      ))));
    };

    const handleConversationRemovedFromList = ({ userId }) => {
      setUsers((prev) => prev.filter((conversationUser) => conversationUser._id !== userId));
      setSelectedUser((prev) => prev?._id === userId ? null : prev);
      if (selectedUser?._id === userId) setMessages([]);
    };

    const handleUserBlockStatusUpdated = ({ userId, blocked }) => {
      setUsers((prev) => prev.map((conversationUser) => (
        conversationUser._id === userId ? { ...conversationUser, hasBlockedMe: blocked } : conversationUser
      )));
      setSelectedUser((prev) => prev?._id === userId ? { ...prev, hasBlockedMe: blocked } : prev);
    };

    const handleChatHistoryCleared = ({ chatWithId }) => {
      if (selectedUser?._id === chatWithId) setMessages([]);
      setUsers((prev) => prev.map((conversationUser) => (
        conversationUser._id === chatWithId
          ? { ...conversationUser, lastMessage: null, unreadCount: 0 }
          : conversationUser
      )));
    };

    const handleChatHistoryDeleted = ({ actorId, chatWithId }) => {
      if (selectedUser?._id === chatWithId) setMessages([]);
      if (actorId === user?._id) {
        setUsers((prev) => prev.filter((conversationUser) => conversationUser._id !== chatWithId));
        setSelectedUser((prev) => prev?._id === chatWithId ? null : prev);
      } else {
        setUsers((prev) => prev.map((conversationUser) => (
          conversationUser._id === chatWithId
            ? { ...conversationUser, lastMessage: null, unreadCount: 0 }
            : conversationUser
        )));
      }
    };

    // Handle typing indicators
    const handleUserTyping = ({ senderId }) => {
      setTypingUsers((prev) => ({ ...prev, [senderId]: true }));
    };

    const handleUserStoppedTyping = ({ senderId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    };

    socket.on('newMessage', handleNewMessage);
    socket.on('groupCreated', handleGroupCreated);
    socket.on('messagesReadNotification', handleMessagesRead);
    socket.on('messageUpdated', handleMessageUpdated);
    socket.on('messageDeleted', handleMessageDeleted);
    socket.on('conversationPinUpdated', handleConversationPinUpdated);
    socket.on('conversationRemovedFromList', handleConversationRemovedFromList);
    socket.on('userBlockStatusUpdated', handleUserBlockStatusUpdated);
    socket.on('chatHistoryCleared', handleChatHistoryCleared);
    socket.on('chatHistoryDeleted', handleChatHistoryDeleted);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);

    return () => {
      socket.off('newMessage', handleNewMessage);
      socket.off('groupCreated', handleGroupCreated);
      socket.off('messagesReadNotification', handleMessagesRead);
      socket.off('messageUpdated', handleMessageUpdated);
      socket.off('messageDeleted', handleMessageDeleted);
      socket.off('conversationPinUpdated', handleConversationPinUpdated);
      socket.off('conversationRemovedFromList', handleConversationRemovedFromList);
      socket.off('userBlockStatusUpdated', handleUserBlockStatusUpdated);
      socket.off('chatHistoryCleared', handleChatHistoryCleared);
      socket.off('chatHistoryDeleted', handleChatHistoryDeleted);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
    };
  }, [socket, selectedUser, user, loadUsers, encryptionStatus, decryptMessage]);

  // Send message function
  const sendMessage = async (content, messageType = 'text', replyTo = null, attachmentName = '') => {
    if (!selectedUser?._id || !content.trim()) return;

    try {
      const recipients = selectedUser.isGroup ? selectedUser.participants || [] : [selectedUser];
      const encryptedMessage = await encryptContent(content.trim(), recipients, attachmentName);
      const res = await api.sendMessage(selectedUser._id, {
        ...encryptedMessage,
        messageType,
        replyTo: replyTo?._id,
      }, selectedUser.isGroup);

      if (res.success && res.message) {
        const newMsg = await decryptMessage(res.message);
        setMessages((prev) => [...prev, newMsg]);

        // Update sidebar list with newest message snippet and move to top
        setUsers((prevUsers) => {
          const index = prevUsers.findIndex((u) => u._id === selectedUser._id);
          if (index !== -1) {
            const updatedUser = {
              ...prevUsers[index],
              lastMessage: {
                _id: newMsg._id,
                content: newMsg.messageType === 'image' ? 'Photo' : newMsg.messageType === 'document' ? 'Document' : newMsg.messageType === 'audio' ? 'Voice message' : newMsg.messageType === 'call' ? `Missed ${newMsg.callType} call` : newMsg.messageType === 'deleted' ? 'Message deleted' : newMsg.content,
                senderId: newMsg.senderId,
                createdAt: newMsg.createdAt,
                read: false,
                messageType: newMsg.messageType,
                callType: newMsg.callType,
                favoritedBy: newMsg.favoritedBy,
              },
            };
            return sortConversations(prevUsers.map((conversationUser) => (
              conversationUser._id === selectedUser._id ? updatedUser : conversationUser
            )));
          }
          return prevUsers;
        });

        return newMsg;
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      throw err;
    }
  };

  const createGroup = async (name, memberIds) => {
    const response = await api.createGroup(name, memberIds);
    if (response.success && response.group) {
      setUsers((previous) => sortConversations([response.group, ...previous]));
      setSelectedUser(response.group);
      setMessages([]);
    }
    return response;
  };

  const recordMissedCall = useCallback(async (userId, callType) => {
    const recipient = users.find((entry) => entry._id === userId);
    if (!recipient) throw new Error('Could not find this conversation to save the missed call.');
    const encryptedMessage = await encryptContent(`Missed ${callType} call`, [recipient]);
    const response = await api.sendMessage(userId, {
      ...encryptedMessage,
      messageType: 'call',
      callType,
    });
    if (response.success && response.message) {
      const callMessage = await decryptMessage(response.message);
      if (selectedUser?._id === userId) setMessages((previous) => [...previous, callMessage]);
      setUsers((previous) => sortConversations(previous.map((conversationUser) => (
        conversationUser._id === userId
          ? { ...conversationUser, lastMessage: { ...callMessage, content: `Missed ${callType} call` } }
          : conversationUser
      ))));
    }
    return response;
  }, [decryptMessage, encryptContent, selectedUser?._id, users]);

  const editMessage = async (messageId, content) => {
    const recipients = selectedUser?.isGroup ? selectedUser.participants || [] : [selectedUser].filter(Boolean);
    const encryptedMessage = await encryptContent(content.trim(), recipients);
    const response = await api.editMessage(messageId, encryptedMessage);
    const res = response.success ? { ...response, message: await decryptMessage(response.message) } : response;
    if (res.success) {
      setMessages((prev) => prev.map((message) => message._id === messageId ? res.message : message));
      const otherUserId = res.message.senderId === user?._id ? res.message.receiverId : res.message.senderId;
      setUsers((prev) => prev.map((conversationUser) => (
        conversationUser._id === otherUserId && conversationUser.lastMessage?._id === messageId
          ? { ...conversationUser, lastMessage: { ...conversationUser.lastMessage, content: res.message.content, edited: true } }
          : conversationUser
      )));
    }
    return res;
  };

  const deleteMessage = async (messageId) => {
    const res = await api.deleteMessage(messageId);
    if (res.success) {
      if (res.message) {
        setMessages((prev) => prev.map((message) => message._id === messageId ? res.message : message));
      }
      await loadUsers();
    }
    return res;
  };

  const toggleFavoriteMessage = async (messageId) => {
    const response = await api.toggleFavoriteMessage(messageId);
    const res = response.success ? { ...response, message: await decryptMessage(response.message) } : response;
    if (res.success) {
      setMessages((prev) => prev.map((message) => message._id === messageId ? res.message : message));
      const otherUserId = res.message.senderId === user?._id ? res.message.receiverId : res.message.senderId;
      setUsers((prev) => prev.map((conversationUser) => (
        conversationUser._id === otherUserId && conversationUser.lastMessage?._id === messageId
          ? { ...conversationUser, lastMessage: { ...conversationUser.lastMessage, favoritedBy: res.message.favoritedBy } }
          : conversationUser
      )));
    }
    return res;
  };

  const toggleConversationPin = async (userId) => {
    const res = await api.toggleConversationPin(userId);
    if (res.success) {
      setUsers((prev) => sortConversations(prev.map((conversationUser) => (
        conversationUser._id === userId ? { ...conversationUser, isPinned: res.isPinned } : conversationUser
      ))));
    }
    return res;
  };

  const removeConversationFromList = async (userId) => {
    const res = await api.removeConversationFromList(userId);
    if (res.success) {
      setUsers((prev) => prev.filter((conversationUser) => conversationUser._id !== userId));
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setMessages([]);
      }
    }
    return res;
  };

  const setUserBlocked = async (userId, blocked) => {
    const res = await api.setUserBlocked(userId, blocked);
    if (res.success) {
      const updateBlockState = (target) => target?._id === userId
        ? { ...target, isBlockedByMe: res.isBlockedByMe }
        : target;
      setUsers((prev) => prev.map(updateBlockState));
      setSelectedUser((prev) => updateBlockState(prev));
    }
    return res;
  };

  const clearChatHistory = async (userId) => {
    const res = await api.clearChatHistory(userId);
    if (res.success) {
      if (selectedUser?._id === userId) setMessages([]);
      setUsers((prev) => prev.map((conversationUser) => (
        conversationUser._id === userId
          ? { ...conversationUser, lastMessage: null, unreadCount: 0 }
          : conversationUser
      )));
    }
    return res;
  };

  const deleteConversationHistory = async (userId) => {
    const res = await api.deleteConversationHistory(userId);
    if (res.success) {
      setUsers((prev) => prev.filter((conversationUser) => conversationUser._id !== userId));
      if (selectedUser?._id === userId) {
        setSelectedUser(null);
        setMessages([]);
      }
    }
    return res;
  };

  // Emit typing status
  const sendTypingStatus = (isTyping) => {
    if (!socket || !selectedUser?._id || !user?._id) return;
    if (isTyping) {
      socket.emit('typing', { senderId: user._id, receiverId: selectedUser._id });
    } else {
      socket.emit('stopTyping', { senderId: user._id, receiverId: selectedUser._id });
    }
  };

  return (
    <ChatContext.Provider
      value={{
        users,
        selectedUser,
        setSelectedUser,
        messages,
        loadingUsers,
        loadingMessages,
        typingUsers,
        loadUsers,
        createGroup,
        recordMissedCall,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleFavoriteMessage,
        toggleConversationPin,
        removeConversationFromList,
        setUserBlocked,
        clearChatHistory,
        deleteConversationHistory,
        sendTypingStatus,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
