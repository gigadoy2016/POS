require('dotenv').config();
const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const sqlitePath = path.join(__dirname, 'inv.db');
const db = new sqlite3.Database(sqlitePath);

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '9161133',
  database: process.env.DB_NAME || 'db_pos',
  charset: 'utf8mb4'
};

const TABLE_SCHEMAS = {
  inv_categories: `
    CREATE TABLE IF NOT EXISTS inv_categories (
      category_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      serial_id VARCHAR(100) DEFAULT '',
      detail TEXT,
      \`order\` INT DEFAULT 99,
      pic VARCHAR(255)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_types: `
    CREATE TABLE IF NOT EXISTS inv_types (
      type_id INT AUTO_INCREMENT PRIMARY KEY,
      category_id INT DEFAULT 0,
      serial_id VARCHAR(100) DEFAULT '',
      name VARCHAR(255) NOT NULL,
      detail TEXT,
      eng_name VARCHAR(255),
      pic VARCHAR(255),
      sale_price DECIMAL(12, 2) DEFAULT 0.00,
      cost DECIMAL(12, 2) DEFAULT 0.00,
      \`order\` INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_products: `
    CREATE TABLE IF NOT EXISTS inv_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(100) NOT NULL,
      product VARCHAR(255) NOT NULL,
      product_eng VARCHAR(255),
      type_id INT DEFAULT 0,
      category_id INT DEFAULT 0,
      stock_id INT DEFAULT 22,
      invoice_id INT,
      owner_id INT,
      promotion_id VARCHAR(100),
      quantity INT DEFAULT 0,
      unit VARCHAR(50) DEFAULT '',
      sale_price DECIMAL(12, 2) DEFAULT 0.00,
      cost DECIMAL(12, 2) DEFAULT 0.00,
      detail TEXT,
      unit_price INT DEFAULT 0,
      code VARCHAR(100) DEFAULT '',
      time VARCHAR(50),
      pic MEDIUMTEXT,
      INDEX idx_product_id (product_id),
      INDEX idx_type_id (type_id),
      INDEX idx_category_id (category_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_stocks: `
    CREATE TABLE IF NOT EXISTS inv_stocks (
      stock_id INT AUTO_INCREMENT PRIMARY KEY,
      stock_name VARCHAR(255) NOT NULL,
      detail TEXT,
      limit_stock INT DEFAULT 0,
      unit_id INT DEFAULT 0,
      pic VARCHAR(255),
      time VARCHAR(50) DEFAULT '',
      status INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_units: `
    CREATE TABLE IF NOT EXISTS inv_units (
      unit_id INT AUTO_INCREMENT PRIMARY KEY,
      unit_name VARCHAR(255) NOT NULL,
      ratio DECIMAL(10, 2) DEFAULT 0.00,
      status INT DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_promotions: `
    CREATE TABLE IF NOT EXISTS inv_promotions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      promotion_id VARCHAR(100) DEFAULT '',
      type_id VARCHAR(100) DEFAULT '',
      name VARCHAR(255),
      class_id INT DEFAULT 0,
      price DECIMAL(12, 2) DEFAULT 0.00,
      \`limit\` INT DEFAULT 0,
      detail TEXT,
      INDEX idx_promo_id (promotion_id),
      INDEX idx_promo_type (type_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_bills: `
    CREATE TABLE IF NOT EXISTS inv_bills (
      bill_id INT AUTO_INCREMENT PRIMARY KEY,
      book_no INT DEFAULT 0,
      customer_id INT DEFAULT 0,
      date VARCHAR(50) DEFAULT '0',
      c_licence VARCHAR(255),
      result DECIMAL(14, 2) DEFAULT 0.00,
      collector_id INT DEFAULT 0,
      detail TEXT,
      profit DECIMAL(14, 2) DEFAULT 0.00,
      status INT DEFAULT 0,
      INDEX idx_bill_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_orders: `
    CREATE TABLE IF NOT EXISTS inv_orders (
      order_id INT AUTO_INCREMENT PRIMARY KEY,
      bill_id INT NOT NULL DEFAULT 0,
      type_id VARCHAR(100) DEFAULT '',
      product_id VARCHAR(100) NOT NULL DEFAULT '',
      quantity DECIMAL(12, 2) DEFAULT 0.00,
      unit_price DECIMAL(12, 2) DEFAULT 0.00,
      result DECIMAL(14, 2) DEFAULT 0.00,
      cost DECIMAL(14, 2) DEFAULT 0.00,
      profit DECIMAL(14, 2) DEFAULT 0.00,
      INDEX idx_order_bill (bill_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `,
  inv_limitcheck: `
    CREATE TABLE IF NOT EXISTS inv_limitcheck (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(100) NOT NULL,
      min INT DEFAULT 0,
      max INT DEFAULT 0,
      INDEX idx_limit_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `
};

function getSqliteRows(sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function migrate() {
  console.log(`Connecting to MariaDB (${DB_CONFIG.host}:${DB_CONFIG.port}, database: ${DB_CONFIG.database})...`);
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('Connected to MariaDB successfully!');

  // Ensure database charset
  await conn.query(`ALTER DATABASE \`${DB_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

  const tables = Object.keys(TABLE_SCHEMAS);

  for (const tableName of tables) {
    console.log(`\n--- Migrating table: ${tableName} ---`);
    // Create table if not exists
    await conn.query(TABLE_SCHEMAS[tableName]);

    // Truncate table to ensure fresh copy
    await conn.query(`SET FOREIGN_KEY_CHECKS = 0;`);
    await conn.query(`TRUNCATE TABLE \`${tableName}\`;`);
    await conn.query(`SET FOREIGN_KEY_CHECKS = 1;`);

    // Fetch data from SQLite
    const rows = await getSqliteRows(`SELECT * FROM ${tableName}`);
    console.log(`Found ${rows.length} rows in SQLite.`);

    if (rows.length === 0) continue;

    const cols = Object.keys(rows[0]);
    const quotedCols = cols.map(c => `\`${c}\``).join(', ');
    const batchSize = 500;

    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const values = [];
      const placeholders = chunk.map(row => {
        cols.forEach(col => {
          let val = row[col];
          if (val === undefined) val = null;
          values.push(val);
        });
        return `(${cols.map(() => '?').join(', ')})`;
      }).join(', ');

      const insertSql = `INSERT INTO \`${tableName}\` (${quotedCols}) VALUES ${placeholders}`;
      await conn.query(insertSql, values);
      process.stdout.write(`\rImported ${Math.min(i + batchSize, rows.length)} / ${rows.length} rows...`);
    }
    console.log(`\nTable ${tableName} migrated successfully!`);
  }

  console.log('\n=======================================');
  console.log('Verifying table row counts in MariaDB:');
  console.log('=======================================');
  for (const tableName of tables) {
    const [result] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    console.log(`- ${tableName.padEnd(20)}: ${result[0].cnt} rows`);
  }

  await conn.end();
  db.close();
  console.log('\nMigration from SQLite to MariaDB finished successfully!');
}

migrate().catch(err => {
  console.error('\nMigration failed:', err);
  process.exit(1);
});
