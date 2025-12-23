#!/usr/bin/env node

/**
 * Stop all processes started by npm run startall
 * Kills processes running on the typical ports used by the app
 */

const { exec } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

// Ports used by the services
const ports = {
  backend: process.env.BACKEND_PORT || 3000,
  widget: 3001,
  admin: 3002,
  customer: 3003
};

console.log('Stopping all services...\n');

if (isWindows) {
  // Windows: Use netstat to find PIDs and taskkill to kill them
  const killPromises = Object.entries(ports).map(([name, port]) => {
    return new Promise((resolve) => {
      console.log(`Finding process on port ${port} (${name})...`);
      
      // Find PID using netstat
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`  No process found on port ${port}`);
          return resolve();
        }
        
        // Extract PIDs from netstat output
        const lines = stdout.trim().split('\n');
        const pids = new Set();
        
        lines.forEach(line => {
          const match = line.trim().split(/\s+/);
          if (match.length > 0) {
            const pid = match[match.length - 1];
            if (pid && /^\d+$/.test(pid)) {
              pids.add(pid);
            }
          }
        });
        
        if (pids.size === 0) {
          console.log(`  No process found on port ${port}`);
          return resolve();
        }
        
        // Kill each PID
        pids.forEach(pid => {
          console.log(`  Killing PID ${pid}...`);
          exec(`taskkill /F /PID ${pid}`, (killError) => {
            if (killError) {
              console.log(`  Failed to kill PID ${pid}: ${killError.message}`);
            } else {
              console.log(`  ✓ Killed PID ${pid}`);
            }
          });
        });
        
        resolve();
      });
    });
  });
  
  Promise.all(killPromises).then(() => {
    console.log('\n✓ All processes stopped');
    // Also try to kill node processes that might be running the scripts
    setTimeout(() => {
      exec('taskkill /F /IM node.exe 2>nul', () => {
        // Ignore errors - some node processes might not be ours
      });
    }, 1000);
  });
  
} else {
  // Unix/Linux/Mac: Use lsof to find PIDs and kill them
  const killPromises = Object.entries(ports).map(([name, port]) => {
    return new Promise((resolve) => {
      console.log(`Finding process on port ${port} (${name})...`);
      
      exec(`lsof -ti :${port}`, (error, stdout) => {
        if (error || !stdout) {
          console.log(`  No process found on port ${port}`);
          return resolve();
        }
        
        const pids = stdout.trim().split('\n').filter(Boolean);
        
        if (pids.length === 0) {
          console.log(`  No process found on port ${port}`);
          return resolve();
        }
        
        pids.forEach(pid => {
          console.log(`  Killing PID ${pid}...`);
          exec(`kill -9 ${pid}`, (killError) => {
            if (killError) {
              console.log(`  Failed to kill PID ${pid}: ${killError.message}`);
            } else {
              console.log(`  ✓ Killed PID ${pid}`);
            }
          });
        });
        
        resolve();
      });
    });
  });
  
  Promise.all(killPromises).then(() => {
    console.log('\n✓ All processes stopped');
  });
}

