import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (user?._id) {
      // Connect to server (using relative path which is proxied by Vite or absolute if needed)
      const socketConnection = io('/', {
        query: {
          userId: user._id,
        },
        transports: ['websocket', 'polling'],
      });

      setSocket(socketConnection);

      socketConnection.on('getOnlineUsers', (users) => {
        setOnlineUsers(users);
      });

      return () => {
        socketConnection.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      setOnlineUsers([]);
    }
  }, [user?._id]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
