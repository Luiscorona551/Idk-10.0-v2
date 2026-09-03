import { accountDbEnabled, getAccountPool } from './idk-account-server.js';

export async function databaseStatus() {
  if (!accountDbEnabled()) return { configured: false, connected: false, tablesReady: false };
  const pool = getAccountPool();
  try {
    await pool.query('SELECT 1');
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('idk_users','idk_state','idk_programs','idk_files','idk_room_messages','idk_friend_requests','idk_friendships')`);
    return { configured: true, connected: true, tablesReady: Number(rows[0]?.count || 0) >= 7 };
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    return { configured: true, connected: false, tablesReady: false };
  }
}
