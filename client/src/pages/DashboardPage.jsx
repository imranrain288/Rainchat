import React, { useEffect, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { Sidebar } from '../components/Sidebar';
import { ChatWindow } from '../components/ChatWindow';
import { EmptyChat } from '../components/EmptyChat';
import { CallOverlay } from '../components/CallOverlay';

export const DashboardPage = () => {
    const { selectedUser, setSelectedUser } = useChat();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true);
    const [theme, setTheme] = useState(() => (
        localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
    ));

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleAndroidBack = () => {
            if (selectedUser || !isMobileSidebarOpen) {
                handleBackToSidebar();
                return true;
            }
            return false;
        };

        window.onAndroidBackButton = handleAndroidBack;

        const handleDocBack = (e) => {
            if (handleAndroidBack()) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('backbutton', handleDocBack);

        return () => {
            delete window.onAndroidBackButton;
            document.removeEventListener('backbutton', handleDocBack);
        };
    }, [selectedUser, isMobileSidebarOpen]);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setIsMobileSidebarOpen(false);
    };

    const handleBackToSidebar = () => {
        setIsMobileSidebarOpen(true);
        setSelectedUser(null);
    };

    return (
        <div className="dashboard-container">
            {/* Sidebar with registered user conversation list */}
            <Sidebar
                isMobileOpen={isMobileSidebarOpen || !selectedUser}
                onSelectUser={handleSelectUser}
                theme={theme}
                onToggleTheme={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
            />

            {/* Main Chat Area or Welcome Screen */}
            {selectedUser ? (
                <ChatWindow onBackToSidebar={handleBackToSidebar} />
            ) : (
                <EmptyChat />
            )}
            <CallOverlay />
        </div>
    );
};
