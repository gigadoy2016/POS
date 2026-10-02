const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve existing product images from INVapp webroot
app.use('/img', express.static('D:/01_DOCKER/cakephp2/www/INVapp/app/webroot/img'));

// ---------------------- API: Categories & Types ----------------------

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT category_id, name, serial_id, detail, "order", pic 
      FROM inv_categories 
      ORDER BY "order" ASC, category_id ASC
    `);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get types by category
app.get('/api/types', async (req, res) => {
  try {
    const { category_id } = req.query;
    let sql = `
      SELECT t.type_id, t.category_id, t.serial_id, t.name, t.detail, t.eng_name, t.pic, t.sale_price, t.cost, t."order",
             c.name as category_name
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
    `;
    const params = [];
    if (category_id) {
      sql += ' WHERE t.category_id = ?';
      params.push(category_id);
    }
    sql += ' ORDER BY t."order" ASC, t.type_id ASC';
    const types = await db.query(sql, params);
    res.json({ success: true, data: types });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Products ----------------------

// Search products (for instant search / grid)
app.get('/api/products', async (req, res) => {
  try {
    const { q, category_id, type_id, limit = 50, offset = 0, low_stock } = req.query;
    let sql = `
      SELECT p.id, p.product_id, p.product, p.product_eng, p.type_id, p.category_id, p.stock_id,
             p.quantity, p.unit, p.sale_price, p.cost, p.detail, p.code,
             t.name as type_name, t.pic as type_pic,
             c.name as category_name,
             l.min as limit_min, l.max as limit_max
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      LEFT JOIN inv_categories c ON p.category_id = c.category_id
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      sql += ` AND (p.product_id LIKE ? OR p.product LIKE ? OR p.code LIKE ? OR p.product_eng LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term, term);
    }

    if (category_id) {
      sql += ` AND p.category_id = ?`;
      params.push(category_id);
    }

    if (type_id) {
      sql += ` AND p.type_id = ?`;
      params.push(type_id);
    }

    if (low_stock === 'true') {
      sql += ` AND (p.quantity <= COALESCE(l.min, 5))`;
    }

    sql += ` ORDER BY p.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const products = await db.query(sql, params);
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Lookup product by exact Barcode / Product Code
app.get('/api/products/lookup/:code', async (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const product = await db.get(`
      SELECT p.id, p.product_id, p.product, p.product_eng, p.type_id, p.category_id, p.stock_id,
             p.quantity, p.unit, p.sale_price, p.cost, p.detail, p.code,
             t.name as type_name, t.pic as type_pic, t.serial_id as type_serial,
             c.name as category_name,
             l.min as limit_min, l.max as limit_max
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      LEFT JOIN inv_categories c ON p.category_id = c.category_id
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id
      WHERE p.product_id = ? OR p.code = ?
      LIMIT 1
    `, [code, code]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบรหัสสินค้านี้' });
    }

    // Check promotions for this type or product
    const promotions = await db.query(`
      SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
      FROM inv_promotions
      WHERE type_id = ? OR promotion_id = ?
      ORDER BY "limit" ASC
    `, [product.type_id.toString(), product.product_id]);

    res.json({ success: true, data: { ...product, promotions } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update product stock / price
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product, sale_price, cost, quantity, unit, limit_min, limit_max } = req.body;

    await db.run(`
      UPDATE inv_products
      SET product = COALESCE(?, product),
          sale_price = COALESCE(?, sale_price),
          cost = COALESCE(?, cost),
          quantity = COALESCE(?, quantity),
          unit = COALESCE(?, unit)
      WHERE id = ?
    `, [product, sale_price, cost, quantity, unit, id]);

    // Update safety stock if provided
    const prod = await db.get('SELECT product_id FROM inv_products WHERE id = ?', [id]);
    if (prod && (limit_min !== undefined || limit_max !== undefined)) {
      const exists = await db.get('SELECT id FROM inv_limitcheck WHERE product_id = ?', [prod.product_id]);
      if (exists) {
        await db.run('UPDATE inv_limitcheck SET min = ?, max = ? WHERE product_id = ?', [limit_min || 0, limit_max || 0, prod.product_id]);
      } else {
        await db.run('INSERT INTO inv_limitcheck (product_id, min, max) VALUES (?, ?, ?)', [prod.product_id, limit_min || 0, limit_max || 0]);
      }
    }

    res.json({ success: true, message: 'บันทึกข้อมูลสินค้าเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Checkout & Bills ----------------------

// Checkout & Create Bill
app.post('/api/checkout', async (req, res) => {
  try {
    const { items, discount = 0, received_amount = 0, customer_id = 0, detail = '' } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'ไม่มีรายการสินค้าในบิล' });
    }

    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      const lineTotal = (item.unit_price * item.quantity);
      const lineCost = (item.cost * item.quantity);
      totalAmount += lineTotal;
      totalCost += lineCost;
    }

    const netAmount = Math.max(0, totalAmount - parseFloat(discount || 0));
    const profit = netAmount - totalCost;
    const nowUnix = Math.floor(Date.now() / 1000).toString();

    // 1. Insert into inv_bills
    const billRes = await db.run(`
      INSERT INTO inv_bills (date, result, profit, status, customer_id, detail)
      VALUES (?, ?, ?, 3, ?, ?)
    `, [nowUnix, netAmount, profit, customer_id, detail || '']);

    const billId = billRes.lastID;

    // 2. Insert orders & Deduct stock
    for (const item of items) {
      const lineTotal = item.unit_price * item.quantity;
      const lineCost = (item.cost || 0) * item.quantity;
      const lineProfit = lineTotal - lineCost;

      await db.run(`
        INSERT INTO inv_orders (bill_id, type_id, product_id, quantity, unit_price, result, cost, profit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [billId, item.type_id || '', item.product_id || '', item.quantity, item.unit_price, lineTotal, lineCost, lineProfit]);

      // Deduct stock
      await db.run(`
        UPDATE inv_products
        SET quantity = quantity - ?
        WHERE product_id = ?
      `, [item.quantity, item.product_id]);
    }

    const change = Math.max(0, parseFloat(received_amount || 0) - netAmount);

    res.json({
      success: true,
      data: {
        bill_id: billId,
        date: new Date().toLocaleString('th-TH'),
        total: totalAmount,
        discount: parseFloat(discount || 0),
        net_amount: netAmount,
        received_amount: parseFloat(received_amount || 0),
        change: change,
        profit: profit,
        items: items
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hold Bill storage (in-memory or SQLite status=2)
let heldBills = [];

app.post('/api/bills/hold', (req, res) => {
  const { title, items, discount = 0 } = req.body;
  const holdId = Date.now().toString();
  const heldBill = {
    id: holdId,
    title: title || `บิลพัก #${heldBills.length + 1}`,
    time: new Date().toLocaleTimeString('th-TH'),
    items,
    discount
  };
  heldBills.push(heldBill);
  res.json({ success: true, data: heldBill });
});

app.get('/api/bills/held', (req, res) => {
  res.json({ success: true, data: heldBills });
});

app.delete('/api/bills/held/:id', (req, res) => {
  heldBills = heldBills.filter(b => b.id !== req.params.id);
  res.json({ success: true, message: 'ลบบิลพักเรียบร้อย' });
});

// Get bills list
app.get('/api/bills', async (req, res) => {
  try {
    const { limit = 20, offset = 0, date } = req.query;
    let sql = 'SELECT * FROM inv_bills';
    const params = [];
    if (date) {
      // date is stored as unix timestamp
      const startOfDay = Math.floor(new Date(date).setHours(0, 0, 0, 0) / 1000);
      const endOfDay = Math.floor(new Date(date).setHours(23, 59, 59, 999) / 1000);
      sql += ' WHERE CAST(date AS INTEGER) BETWEEN ? AND ?';
      params.push(startOfDay, endOfDay);
    }
    sql += ' ORDER BY bill_id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const bills = await db.query(sql, params);
    res.json({ success: true, data: bills });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get bill details with orders
app.get('/api/bills/:id', async (req, res) => {
  try {
    const bill = await db.get('SELECT * FROM inv_bills WHERE bill_id = ?', [req.params.id]);
    if (!bill) return res.status(404).json({ success: false, message: 'ไม่พบบิลนี้' });

    const orders = await db.query(`
      SELECT o.*, p.product as product_name, p.unit
      FROM inv_orders o
      LEFT JOIN inv_products p ON o.product_id = p.product_id
      WHERE o.bill_id = ?
    `, [req.params.id]);

    res.json({ success: true, data: { ...bill, items: orders } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Dashboard / Reports ----------------------

app.get('/api/reports/dashboard', async (req, res) => {
  try {
    const totalProducts = await db.get('SELECT count(*) as count FROM inv_products');
    const totalCategories = await db.get('SELECT count(*) as count FROM inv_categories');
    const lowStock = await db.get(`
      SELECT count(*) as count 
      FROM inv_products p 
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id 
      WHERE p.quantity <= COALESCE(l.min, 5)
    `);

    // Today bills & sales
    const startOfToday = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayStats = await db.get(`
      SELECT count(*) as count, COALESCE(SUM(result), 0) as total_sales, COALESCE(SUM(profit), 0) as total_profit
      FROM inv_bills
      WHERE CAST(date AS INTEGER) >= ?
    `, [startOfToday]);

    // Recent 5 bills
    const recentBills = await db.query('SELECT * FROM inv_bills ORDER BY bill_id DESC LIMIT 5');

    res.json({
      success: true,
      data: {
        total_products: totalProducts.count,
        total_categories: totalCategories.count,
        low_stock_count: lowStock.count,
        today_bills_count: todayStats.count,
        today_sales: todayStats.total_sales,
        today_profit: todayStats.total_profit,
        recent_bills: recentBills
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 Modern POS Server running at http://localhost:${PORT}`);
  console.log(`⚡ Memory footprint: ~35MB RAM`);
  console.log(`📦 Database: SQLite inv.db (3,537 products)`);
  console.log(`===============================================`);
});
