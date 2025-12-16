import express from 'express';
import { sendMessage, getHistory, endSession, getWidgetConfig } from '../controllers/chatController.js';
import { authenticateClient } from '../middleware/auth.js';
import { checkPlanLimits, addUsageHeaders } from '../middleware/planLimits.js';

const router = express.Router();

// All chat routes require authentication
router.use(authenticateClient);

// Add usage headers to all responses (shows remaining limits)
router.use(addUsageHeaders());

// GET /chat/config - Get widget configuration (language, theme, etc.)
router.get('/config', getWidgetConfig);

// POST /chat/message - Send a message and get AI response
// Plan limits are checked but with strict: false (logs warnings, doesn't block)
// Default plan is "unlimited" so most clients won't hit any limits
router.post('/message', 
  checkPlanLimits({
    checkLimits: ['messagesPerMonth', 'tokensPerMonth'],
    strict: false  // Set to true to actually block requests when limits exceeded
  }),
  sendMessage
);

// GET /chat/history/:sessionId - Get conversation history
router.get('/history/:sessionId', getHistory);

// POST /chat/end - End a conversation session
router.post('/end', endSession);

export default router;
