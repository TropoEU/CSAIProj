/**
 * Server Entry Point
 *
 * Imports the Express app and starts the server with scheduled tasks.
 * For testing, import from app.js directly to avoid starting the server.
 */

import app from './app.js';
import conversationService from './services/conversationService.js';
import { emailMonitor } from './services/emailMonitor.js';
import n8nService from './services/n8nService.js';
import { initializePrompts } from './prompts/systemPrompt.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);

  // Initialize prompt configuration from database
  try {
    await initializePrompts();
    console.log('Prompt configuration loaded from database');
  } catch (error) {
    console.warn('Failed to load prompt config from database, using defaults:', error.message);
  }

  // Check n8n connectivity on startup
  const n8nHealth = await n8nService.checkHealth();
  if (n8nHealth.available) {
    console.log(`n8n Connected (version: ${n8nHealth.version})`);
  } else {
    console.warn(`n8n Connection Warning: ${n8nHealth.error}`);
  }

  // Start scheduled tasks
  startScheduledTasks();
});

/**
 * Start scheduled background tasks
 */
function startScheduledTasks() {
  // Auto-end inactive conversations
  // Runs every 5 minutes, ends conversations inactive for 15+ minutes (configurable)
  const INACTIVITY_TIMEOUT_MINUTES = parseInt(
    process.env.CONVERSATION_INACTIVITY_TIMEOUT_MINUTES || '15',
    10
  );
  const CHECK_INTERVAL_MS = parseInt(
    process.env.CONVERSATION_AUTO_END_CHECK_INTERVAL_MS || '300000',
    10
  ); // 5 minutes default

  console.log(
    `[Scheduler] Starting auto-end task: checking every ${CHECK_INTERVAL_MS / 1000}s, ending conversations inactive for ${INACTIVITY_TIMEOUT_MINUTES}+ minutes`
  );

  // Run immediately on startup, then on interval
  runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES);

  setInterval(() => {
    runAutoEndTask(INACTIVITY_TIMEOUT_MINUTES).catch((err) => {
      console.error('[Scheduler] Unhandled error in auto-end task:', err);
    });
  }, CHECK_INTERVAL_MS);

  // Start email monitor for multi-channel AI support
  emailMonitor.start();
}

/**
 * Run the auto-end inactive conversations task
 */
async function runAutoEndTask(inactivityMinutes) {
  try {
    const result = await conversationService.autoEndInactiveConversations(inactivityMinutes);
    if (result.ended > 0) {
      console.log(`[Scheduler] Auto-ended ${result.ended} inactive conversation(s)`);
    }
  } catch (error) {
    console.error('[Scheduler] Error in auto-end task:', error);
  }
}

// Export app for any direct imports (though app.js is preferred for testing)
export default app;
