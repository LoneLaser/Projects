import sql from 'mssql';
import db from '../../db/client';
import { encrypt, decrypt } from '../encryption';

export interface ConnectionConfig {
  name: string;
  server: string;
  database_name: string;
  username: string;
  password: string;
  port?: number;
  encrypt?: boolean;
}

export interface ConnectionRow {
  id: number;
  name: string;
  server: string;
  database_name: string;
  username: string;
  password_encrypted: string;
  password_iv: string;
  password_tag: string;
  port: number;
  encrypt: number;
  created_at: string;
  updated_at: string;
}

export function createConnection(config: ConnectionConfig): ConnectionRow {
  const { encrypted, iv, tag } = encrypt(config.password);

  const stmt = db.prepare(`
    INSERT INTO connections (name, server, database_name, username, password_encrypted, password_iv, password_tag, port, encrypt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    config.name,
    config.server,
    config.database_name,
    config.username,
    encrypted,
    iv,
    tag,
    config.port ?? 1433,
    config.encrypt ? 1 : 0
  );

  return getConnectionById(result.lastInsertRowid as number)!;
}

export function getAllConnections(): Omit<ConnectionRow, 'password_encrypted' | 'password_iv' | 'password_tag'>[] {
  const stmt = db.prepare(`
    SELECT id, name, server, database_name, username, port, encrypt, created_at, updated_at
    FROM connections ORDER BY name
  `);
  return stmt.all() as any[];
}

export function getConnectionById(id: number): ConnectionRow | undefined {
  const stmt = db.prepare('SELECT * FROM connections WHERE id = ?');
  return stmt.get(id) as ConnectionRow | undefined;
}

export function deleteConnection(id: number): boolean {
  const stmt = db.prepare('DELETE FROM connections WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export async function testConnection(id: number): Promise<{ success: boolean; message: string }> {
  const conn = getConnectionById(id);
  if (!conn) {
    return { success: false, message: 'Connection not found' };
  }

  const password = decrypt(conn.password_encrypted, conn.password_iv, conn.password_tag);

  const sqlConfig: sql.config = {
    server: conn.server,
    database: conn.database_name,
    user: conn.username,
    password,
    port: conn.port,
    options: {
      encrypt: conn.encrypt === 1,
      trustServerCertificate: true,
    },
    connectionTimeout: 10000,
    requestTimeout: 10000,
  };

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await sql.connect(sqlConfig);
    await pool.request().query('SELECT 1 AS test');
    return { success: true, message: 'Connection successful' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Unknown error' };
  } finally {
    if (pool) {
      try { await pool.close(); } catch { /* ignore */ }
    }
  }
}

export async function getMssqlPool(id: number): Promise<sql.ConnectionPool> {
  const conn = getConnectionById(id);
  if (!conn) {
    throw new Error('Connection not found');
  }

  const password = decrypt(conn.password_encrypted, conn.password_iv, conn.password_tag);

  const sqlConfig: sql.config = {
    server: conn.server,
    database: conn.database_name,
    user: conn.username,
    password,
    port: conn.port,
    options: {
      encrypt: conn.encrypt === 1,
      trustServerCertificate: true,
    },
    connectionTimeout: 15000,
    requestTimeout: 30000,
  };

  return sql.connect(sqlConfig);
}
