import express from 'express';
import {
  getMessages,
  getFavoriteMessages,
  sendMessage,
  getGroupMessages,
  sendGroupMessage,
  editMessage,
  deleteMessage,
  deleteConversation,
  clearChat,
  markMessagesAsRead,
  toggleFavoriteMessage,
} from '../controllers/message.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/favorites', protectRoute, getFavoriteMessages);
router.get('/group/:id', protectRoute, getGroupMessages);
router.post('/group/:id', protectRoute, sendGroupMessage);
router.get('/:id', protectRoute, getMessages);
router.post('/send/:id', protectRoute, sendMessage);
router.put('/:id', protectRoute, editMessage);
router.put('/:id/favorite', protectRoute, toggleFavoriteMessage);
router.delete('/:id', protectRoute, deleteMessage);
router.delete('/conversation/:id/history', protectRoute, clearChat);
router.delete('/conversation/:id', protectRoute, deleteConversation);
router.put('/read/:id', protectRoute, markMessagesAsRead);

export default router;
