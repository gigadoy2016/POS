const mysql = require('mysql2/promise');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const sqlitePath = path.join(__dirname, 'inv.db');
const db = new sqlite3.Database(sqlitePath);

async function run() {
  console.log('Connecting to MySQL (localhost:3306)...');
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '9161133',
    database: 'inv',
    charset: 'utf8'
  });

  console.log('Connected! Creating SQLite schema...');

  const exec = (sql) => new Promise((resolve, reject) => {
    db.run(sql, (err) => err ? reject(err) : resolve());
  });

  await exec('PRAGMA journal_mode = WAL;');
  await exec('PRAGMA foreign_keys = OFF;');

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_categories (
      category_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      serial_id TEXT DEFAULT '',
      detail TEXT DEFAULT '',
      "order" INTEGER DEFAULT 99,
      pic TEXT
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_types (
      type_id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER DEFAULT 0,
      serial_id TEXT DEFAULT '',
      name TEXT NOT NULL,
      detail TEXT DEFAULT '',
      eng_name TEXT,
      pic TEXT,
      sale_price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      "order" INTEGER DEFAULT 0
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      product TEXT NOT NULL,
      product_eng TEXT,
      type_id INTEGER DEFAULT 0,
      category_id INTEGER DEFAULT 0,
      stock_id INTEGER DEFAULT 22,
      invoice_id INTEGER,
      owner_id INTEGER,
      promotion_id TEXT,
      quantity INTEGER DEFAULT 0,
      unit TEXT DEFAULT '',
      sale_price REAL DEFAULT 0,
      cost REAL DEFAULT 0,
      detail TEXT,
      unit_price INTEGER DEFAULT 0,
      code TEXT DEFAULT '',
      time TEXT
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_stocks (
      stock_id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_name TEXT NOT NULL,
      detail TEXT,
      limit_stock INTEGER DEFAULT 0,
      unit_id INTEGER DEFAULT 0,
      pic TEXT,
      time TEXT DEFAULT '',
      status INTEGER DEFAULT 0
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_units (
      unit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_name TEXT NOT NULL,
      ratio REAL DEFAULT 0,
      status INTEGER DEFAULT 0
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promotion_id TEXT DEFAULT '',
      type_id TEXT DEFAULT '',
      name TEXT,
      class_id INTEGER DEFAULT 0,
      price REAL DEFAULT 0,
      "limit" INTEGER DEFAULT 0,
      detail TEXT
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_bills (
      bill_id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_no INTEGER DEFAULT 0,
      customer_id INTEGER DEFAULT 0,
      date TEXT DEFAULT '0',
      c_licence TEXT,
      result REAL DEFAULT 0.00,
      collector_id INTEGER DEFAULT 0,
      detail TEXT,
      profit REAL DEFAULT 0.00,
      status INTEGER DEFAULT 0
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL DEFAULT 0,
      type_id TEXT DEFAULT '',
      product_id TEXT NOT NULL DEFAULT '',
      quantity REAL DEFAULT 0,
      unit_price REAL DEFAULT 0.00,
      result REAL DEFAULT 0.00,
      cost REAL DEFAULT 0.00,
      profit REAL DEFAULT 0.00
    );
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS inv_limitcheck (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      min INTEGER DEFAULT 0,
      max INTEGER DEFAULT 0
    );
  `);

  // Clear existing
  for (const t of ['inv_categories', 'inv_types', 'inv_products', 'inv_stocks', 'inv_units', 'inv_promotions', 'inv_limitcheck', 'inv_bills']) {
    await exec(`DELETE FROM ${t}`);
  }

  // Copy tables
  const tables = [
    { name: 'inv_categories', cols: ['category_id', 'name', 'serial_id', 'detail', 'order', 'pic'] },
    { name: 'inv_types', cols: ['type_id', 'category_id', 'serial_id', 'name', 'detail', 'eng_name', 'pic', 'sale_price', 'cost', 'order'] },
    { name: 'inv_products', cols: ['id', 'product_id', 'product', 'product_eng', 'type_id', 'category_id', 'stock_id', 'invoice_id', 'owner_id', 'promotion_id', 'quantity', 'unit', 'sale_price', 'cost', 'detail', 'unit_price', 'code', 'time'] },
    { name: 'inv_stocks', cols: ['stock_id', 'stock_name', 'detail', 'limit_stock', 'unit_id', 'pic', 'time', 'status'] },
    { name: 'inv_units', cols: ['unit_id', 'unit_name', 'ratio', 'status'] },
    { name: 'inv_promotions', cols: ['id', 'promotion_id', 'type_id', 'name', 'class_id', 'price', 'limit', 'detail'] },
    { name: 'inv_limitcheck', cols: ['id', 'product_id', 'min', 'max'] },
    { name: 'inv_bills', cols: ['bill_id', 'book_no', 'customer_id', 'date', 'c_licence', 'result', 'collector_id', 'detail', 'profit', 'status'] }
  ];

  for (const tbl of tables) {
    const [rows] = await conn.query(`SELECT * FROM ${tbl.name}`);
    console.log(`Syncing ${tbl.name}: ${rows.length} rows...`);
    if (rows.length === 0) continue;

    const colNames = tbl.cols.map(c => `"${c}"`).join(', ');
    const placeholders = tbl.cols.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${tbl.name} (${colNames}) VALUES (${placeholders})`);

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        for (const row of rows) {
          const vals = tbl.cols.map(c => row[c] !== undefined ? row[c] : null);
          stmt.run(vals);
        }
        db.run('COMMIT', (err) => err ? reject(err) : resolve());
      });
    });
    stmt.finalize();
  }

  await conn.end();
  console.log('Sync to SQLite completed successfully!');
  db.close();
}

run().catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});
