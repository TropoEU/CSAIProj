import express from 'express';
import { sendMessage, getHistory, endSession } from '../controllers/chatController.js';
import { authenticateClient } from '../middleware/auth.js';

const router = express.Router();

// All chat routes require authentication
router.use(authenticateClient);

// POST /chat/message - Send a message and get AI response
router.post('/message', sendMessage);

// GET /chat/history/:sessionId - Get conversation history
router.get('/history/:sessionId', getHistory);

// POST /chat/end - End a conversation session
router.post('/end', endSession);

export default router;
