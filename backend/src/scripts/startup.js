/**
 * Production startup script
 * Runs migrations then starts the server
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '../..');

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`[Startup] Running: ${command} ${args.join(' ')}`);

    const proc = spawn(command, args, {
      cwd: backendDir,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

async function startup() {
  try {
    // Run migrations
    console.log('[Startup] Running database migrations...');
    await runCommand('node', ['src/scripts/migrate.js', 'up']);
    console.log('[Startup] Migrations complete');

    // Start the server
    console.log('[Startup] Starting server...');
    await runCommand('node', ['src/index.js']);
  } catch (error) {
    console.error('[Startup] Failed:', error.message);
    process.exit(1);
  }
}

startup();
