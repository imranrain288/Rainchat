import express from 'express';
import { signup, login, getMe, updateProfile, deleteAccount } from '../controllers/auth.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', protectRoute, getMe);
router.put('/profile', protectRoute, updateProfile);
router.delete('/account', protectRoute, deleteAccount);

export default router;
