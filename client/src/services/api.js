const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE_URL = `${API_ORIGIN}/api`;

export const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'An unexpected error occurred');
  }

  return data;
};

export const api = {
  // Auth
  signup: (userData) =>
    apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  login: (credentials) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getMe: () => apiRequest('/auth/me'),

  updateProfile: (profileData) =>
    apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  deleteAccount: () => apiRequest('/auth/account', { method: 'DELETE' }),

  // Users & Conversations
  getUsers: (search = '') =>
    apiRequest(`/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  createGroup: (name, memberIds) =>
    apiRequest('/users/groups', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    }),

  getEncryptionKey: () => apiRequest('/users/encryption-key'),

  registerEncryptionKey: (publicKey) =>
    apiRequest('/users/encryption-key', {
      method: 'PUT',
      body: JSON.stringify({ publicKey }),
    }),

  resetEncryptionKey: (publicKey) =>
    apiRequest('/users/encryption-key/reset', {
      method: 'POST',
      body: JSON.stringify({ publicKey, confirmReset: true }),
    }),

  getUserProfile: (id) => apiRequest(`/users/${id}`),

  setUserBlocked: (id, blocked) =>
    apiRequest(`/users/${id}/block`, {
      method: 'PUT',
      body: JSON.stringify({ blocked }),
    }),

  // Messages
  getMessages: (userId, isGroup = false) => apiRequest(`/messages/${isGroup ? 'group/' : ''}${userId}`),

  getFavoriteMessages: () => apiRequest('/messages/favorites'),

  sendMessage: (userId, messageData, isGroup = false) =>
    apiRequest(`/messages/${isGroup ? 'group/' : 'send/'}${userId}`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    }),

  editMessage: (messageId, messageData) =>
    apiRequest(`/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify(messageData),
    }),

  deleteMessage: (messageId) =>
    apiRequest(`/messages/${messageId}`, { method: 'DELETE' }),

  toggleFavoriteMessage: (messageId) =>
    apiRequest(`/messages/${messageId}/favorite`, { method: 'PUT' }),

  toggleConversationPin: (userId) =>
    apiRequest(`/users/${userId}/conversation/pin`, { method: 'PUT' }),

  removeConversationFromList: (userId) =>
    apiRequest(`/users/${userId}/conversation`, { method: 'DELETE' }),

  clearChatHistory: (userId) =>
    apiRequest(`/messages/conversation/${userId}/history`, { method: 'DELETE' }),

  deleteConversationHistory: (userId) =>
    apiRequest(`/messages/conversation/${userId}`, { method: 'DELETE' }),

  markAsRead: (userId) =>
    apiRequest(`/messages/read/${userId}`, {
      method: 'PUT',
    }),

  chatWithGemini: (messages) =>
    apiRequest('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
};
