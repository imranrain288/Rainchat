import express from 'express';
import { chatWithGemini } from '../controllers/ai.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/chat', protectRoute, chatWithGemini);

export default router;