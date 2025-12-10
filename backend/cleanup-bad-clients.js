import { db } from './src/db.js';

async function cleanup() {
  try {
    const result = await db.query(
      `DELETE FROM clients WHERE domain IS NULL OR name LIKE '{%'`
    );
    console.log(`✅ Deleted ${result.rowCount} bad client records`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanup();
