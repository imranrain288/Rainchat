import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Map of userId -> socketId
const userSocketMap = {};

export const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId?.toString()];
};

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  socket.data.userId = userId && userId !== 'undefined' ? userId : null;

  if (userId && userId !== 'undefined') {
    userSocketMap[userId] = socket.id;
    console.log(`\x1b[36m⚡ Socket connected: User ${userId} (Socket: ${socket.id})\x1b[0m`);
  }

  // Broadcast online user IDs to all connected clients
  io.emit('getOnlineUsers', Object.keys(userSocketMap));

  // User typing indicator
  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userTyping', { senderId });
    }
  });

  // User stopped typing
  socket.on('stopTyping', ({ senderId, receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('userStoppedTyping', { senderId });
    }
  });

  // User read messages event
  socket.on('markAsRead', ({ senderId, receiverId }) => {
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      io.to(senderSocketId).emit('messagesReadNotification', { readBy: receiverId });
    }
  });

  const relayCallSignal = (eventName, payload = {}) => {
    const recipientSocketId = getReceiverSocketId(payload.to);
    if (!socket.data.userId || typeof payload.to !== 'string' || !recipientSocketId) {
      if (socket.data.userId && payload.callId) socket.emit('call:unavailable', { callId: payload.callId });
      return;
    }
    const { to, ...signal } = payload;
    io.to(recipientSocketId).emit(eventName, { ...signal, from: socket.data.userId });
  };

  ['call:offer', 'call:answer', 'call:ice-candidate', 'call:decline', 'call:end', 'call:busy'].forEach((eventName) => {
    socket.on(eventName, (payload) => relayCallSignal(eventName, payload));
  });

  // Disconnection handler
  socket.on('disconnect', () => {
    if (userId && userId !== 'undefined') {
      delete userSocketMap[userId];
      console.log(`\x1b[33m⚡ Socket disconnected: User ${userId}\x1b[0m`);
    }
    io.emit('getOnlineUsers', Object.keys(userSocketMap));
  });
});

export { app, io, server };
