import { accountDbEnabled, getAccountPool } from './idk-account-server.js';

export async function databaseStatus() {
  if (!accountDbEnabled()) return { configured: false, connected: false, tablesReady: false };
  const pool = getAccountPool();
  try {
    await pool.query('SELECT 1');
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('idk_users','idk_state','idk_programs','idk_files','idk_room_messages','idk_rooms','idk_room_bans','idk_account_devices','idk_handoff_tokens','idk_vault_backups','idk_vault_transfers','idk_privacy_audit','idk_device_commands','idk_friend_requests','idk_friendships','idk_user_blocks','idk_user_reports','idk_public_programs','idk_public_program_versions','idk_public_program_ratings','idk_public_program_reports')`);
    return { configured: true, connected: true, tablesReady: Number(rows[0]?.count || 0) >= 20 };
  } catch (error) {
    console.error('PostgreSQL health check failed:', error);
    return { configured: true, connected: false, tablesReady: false };
  }
}
