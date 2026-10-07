import express from 'express';
import {
	getUsersForSidebar,
	getUserProfile,
	toggleConversationPin,
	removeConversationFromList,
	setUserBlocked,
	createGroup,
	getEncryptionPublicKey,
	registerEncryptionPublicKey,
	resetEncryptionPublicKey,
} from '../controllers/user.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protectRoute, getUsersForSidebar);
router.post('/groups', protectRoute, createGroup);
router.get('/encryption-key', protectRoute, getEncryptionPublicKey);
router.post('/encryption-key/reset', protectRoute, resetEncryptionPublicKey);
router.put('/encryption-key', protectRoute, registerEncryptionPublicKey);
router.put('/:id/conversation/pin', protectRoute, toggleConversationPin);
router.delete('/:id/conversation', protectRoute, removeConversationFromList);
router.put('/:id/block', protectRoute, setUserBlocked);
router.get('/:id', protectRoute, getUserProfile);

export default router;
