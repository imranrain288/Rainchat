import React, { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { Sidebar } from '../components/Sidebar';
import { ChatWindow } from '../components/ChatWindow';
import { EmptyChat } from '../components/EmptyChat';
import { AIChatPanel } from '../components/AIChatPanel';
import { CallOverlay } from '../components/CallOverlay';

export const DashboardPage = () => {
    const { selectedUser, setSelectedUser } = useChat();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    const [theme, setTheme] = useState(() => (
        localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
    ));

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);

    const handleSelectUser = (user) => {
        setIsAssistantOpen(false);
        setSelectedUser(user);
        setIsMobileSidebarOpen(false);
    };

    const handleBackToSidebar = () => {
        setIsMobileSidebarOpen(true);
        setIsAssistantOpen(false);
        setSelectedUser(null);
    };

    const handleOpenAssistant = () => {
        setIsAssistantOpen(true);
        setIsMobileSidebarOpen(false);
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar with registered user conversation list */}
            <Sidebar
                isMobileOpen={isMobileSidebarOpen || !selectedUser}
                onSelectUser={handleSelectUser}
                onOpenAssistant={handleOpenAssistant}
                isAssistantOpen={isAssistantOpen}
                theme={theme}
                onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
            />

            {/* Main Chat Area or Welcome Screen */}
            {isAssistantOpen ? (
                <AIChatPanel onBackToSidebar={handleBackToSidebar} />
            ) : selectedUser ? (
                <ChatWindow onBackToSidebar={handleBackToSidebar} />
            ) : (
                <EmptyChat />
            )}
            <CallOverlay />
        </div>
    );
};
