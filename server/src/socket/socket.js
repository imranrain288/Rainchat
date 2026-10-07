import { Server } from 'socket.io';
import http from 'http';
import express from 'express';

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  ...(process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  'https://localhost',
];

const io = new Server(server, {
  path: process.env.VERCEL ? '/api/socket-io/socket.io' : '/socket.io',
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const userSocketMap = new Map();

export const getUserRoom = (userId) => {
  const normalizedUserId = userId?.toString();
  return normalizedUserId ? `user:${normalizedUserId}` : null;
};

io.on('connection', (socket) => {
  const userId = socket.handshake.query.userId;
  socket.data.userId = userId && userId !== 'undefined' ? userId : null;

  if (socket.data.userId) {
    socket.join(getUserRoom(userId));
    const sockets = userSocketMap.get(userId) || new Set();
    sockets.add(socket.id);
    userSocketMap.set(userId, sockets);
    console.log(`\x1b[36m⚡ Socket connected: User ${userId} (Socket: ${socket.id})\x1b[0m`);
  }
  io.emit('getOnlineUsers', [...userSocketMap.keys()]);

  socket.on('typing', ({ senderId, receiverId }) => {
    const receiverRoom = getUserRoom(receiverId);
    if (receiverRoom) io.to(receiverRoom).emit('userTyping', { senderId });
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    const receiverRoom = getUserRoom(receiverId);
    if (receiverRoom) io.to(receiverRoom).emit('userStoppedTyping', { senderId });
  });

  socket.on('markAsRead', ({ senderId, receiverId }) => {
    const senderRoom = getUserRoom(senderId);
    if (senderRoom) io.to(senderRoom).emit('messagesReadNotification', { readBy: receiverId });
  });

  const relayCallSignal = async (eventName, payload = {}) => {
    const recipientRoom = getUserRoom(payload.to);
    if (!socket.data.userId || !recipientRoom) {
      if (socket.data.userId && payload.callId) socket.emit('call:unavailable', { callId: payload.callId });
      return;
    }
    const recipientSockets = await io.in(recipientRoom).fetchSockets();
    if (!recipientSockets.length) {
      if (payload.callId) socket.emit('call:unavailable', { callId: payload.callId });
      return;
    }
    const { to, ...signal } = payload;
    io.to(recipientRoom).emit(eventName, { ...signal, from: socket.data.userId });
  };

  ['call:offer', 'call:answer', 'call:ice-candidate', 'call:decline', 'call:end', 'call:busy'].forEach((eventName) => {
    socket.on(eventName, (payload) => {
      relayCallSignal(eventName, payload)
        .catch((error) => console.error(`Failed to relay ${eventName}:`, error.message));
    });
  });

  socket.on('disconnect', () => {
    if (socket.data.userId) {
      const sockets = userSocketMap.get(socket.data.userId);
      sockets?.delete(socket.id);
      if (!sockets?.size) userSocketMap.delete(socket.data.userId);
      console.log(`\x1b[33m⚡ Socket disconnected: User ${userId} (Socket: ${socket.id})\x1b[0m`);
    }
    io.emit('getOnlineUsers', [...userSocketMap.keys()]);
  });
});

export { app, io, server };
