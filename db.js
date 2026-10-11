require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '9161133',
  database: process.env.DB_NAME || 'db_pos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true
});

// Helper to normalize double-quoted identifiers (e.g. "order", "limit") to backticks
function normalizeSql(sql) {
  if (typeof sql !== 'string') return sql;
  return sql.replace(/"([a-zA-Z0-9_]+)"/g, '`$1`');
}

// Test connection on boot
pool.getConnection()
  .then((conn) => {
    console.log(`Connected to MariaDB [${process.env.DB_NAME || 'db_pos'}] at ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306}`);
    conn.release();
  })
  .catch((err) => {
    console.error('Failed to connect to MariaDB:', err.message);
  });

async function query(sql, params = []) {
  const [rows] = await pool.query(normalizeSql(sql), params);
  return rows;
}

async function get(sql, params = []) {
  const [rows] = await pool.query(normalizeSql(sql), params);
  return rows && rows.length > 0 ? rows[0] : null;
}

async function run(sql, params = []) {
  const [result] = await pool.query(normalizeSql(sql), params);
  return {
    lastID: result ? result.insertId : 0,
    insertId: result ? result.insertId : 0,
    changes: result ? result.affectedRows : 0,
    affectedRows: result ? result.affectedRows : 0
  };
}

module.exports = {
  pool,
  query,
  get,
  run
};
