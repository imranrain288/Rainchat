import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { MessageSquare, Zap, ShieldCheck, Users, Sparkles } from 'lucide-react';

export const EmptyChat = () => {
  const { user } = useAuth();
  const { users, setSelectedUser } = useChat();

  return (
    <div className="empty-chat-view">
      <div className="empty-chat-graphic">
        <MessageSquare size={44} />
      </div>

      <h2 className="empty-chat-title">
        Hello, {user?.fullName?.split(' ')[0] || 'there'}! 👋
      </h2>
      <p className="empty-chat-description">
        Welcome to RainChat. Select any registered member from the conversation list on the left to start a real-time conversation.
      </p>

    </div>
  );
};
