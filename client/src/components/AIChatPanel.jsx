import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Send, Sparkles } from 'lucide-react';
import { api } from '../services/api';

const INITIAL_MESSAGE = {
  role: 'model',
  text: 'Hi! I’m your Gemini assistant. What would you like help with?',
};

export const AIChatPanel = ({ onBackToSidebar }) => {
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isLoading) return;

    const nextMessages = [...messages, { role: 'user', text }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setIsLoading(true);

    try {
      const response = await api.chatWithGemini(nextMessages.slice(1));
      setMessages([...nextMessages, { role: 'model', text: response.reply }]);
    } catch (requestError) {
      setMessages(messages);
      setDraft(text);
      setError(requestError.message || 'Gemini could not answer. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([INITIAL_MESSAGE]);
    setError('');
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <main className="ai-chat-panel chat-area active-mobile">
      <header className="ai-chat-header">
        <div className="ai-chat-title-wrap">
          <button type="button" className="back-to-sidebar-btn" onClick={onBackToSidebar} title="Back to conversations" aria-label="Back to conversations">
            <ArrowLeft size={20} />
          </button>
          <div className="ai-chat-mark"><Sparkles size={19} /></div>
          <div>
            <h1>Gemini assistant</h1>
            <span>Powered by Google Gemini</span>
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={clearConversation} title="Clear conversation" aria-label="Clear conversation">
          <RotateCcw size={17} />
        </button>
      </header>

      <section className="ai-chat-messages" aria-live="polite" aria-label="Assistant conversation">
        {messages.map((message, index) => (
          <article className={`ai-message ${message.role === 'user' ? 'from-user' : 'from-model'}`} key={`${index}-${message.role}`}>
            {message.role === 'model' && <Sparkles size={15} aria-hidden="true" />}
            <p>{message.text}</p>
          </article>
        ))}
        {isLoading && (
          <div className="ai-thinking" role="status">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span>Thinking</span>
          </div>
        )}
        {error && <p className="ai-chat-error" role="alert">{error}</p>}
        <div ref={messagesEndRef} />
      </section>

      <form className="ai-chat-form" onSubmit={sendMessage}>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleInputKeyDown}
          rows={2}
          maxLength={4000}
          placeholder="Ask Gemini anything..."
          aria-label="Message Gemini"
          disabled={isLoading}
        />
        <button type="submit" disabled={!draft.trim() || isLoading} title="Send message" aria-label="Send message">
          <Send size={18} />
        </button>
      </form>
    </main>
  );
};