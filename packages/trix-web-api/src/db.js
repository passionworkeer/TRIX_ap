import './env.js';
import mysql from 'mysql2/promise';

const numberEnv = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) ? value : fallback;
};

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? '127.0.0.1',
  port: numberEnv('MYSQL_PORT', 3306),
  user: process.env.MYSQL_USER ?? 'root',
  password: process.env.MYSQL_PASSWORD ?? '',
  database: process.env.MYSQL_DATABASE ?? 'trix_companion',
  waitForConnections: true,
  connectionLimit: numberEnv('MYSQL_CONNECTION_LIMIT', 10),
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: true,
});

export async function pingDatabase() {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    return rows?.[0]?.ok === 1;
  } catch {
    return false;
  }
}

export async function withTransaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
