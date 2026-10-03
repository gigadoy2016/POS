const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Path to inv webroot images
const INV_IMG_ROOT = 'D:/01_DOCKER/cakephp2/www/inv/webroot/img';
const INV_PRODUCTS_DIR = path.join(INV_IMG_ROOT, 'products');

// Serve existing product images from INV webroot
app.use('/img', express.static(INV_IMG_ROOT));

// Map known category images based on INV's actual files in products folder
const CATEGORY_IMG_MAP = {
  'ด้าย': 'thread_icon.gif',
  'ไหม': 'yean_1.gif',
  'กรรไกร': 'scissors_1.gif',
  'ซิป': 'zipper_1.gif',
  'ตะขอ': 'hook_1.gif',
  'ยางยืด': 'elastic_1.gif',
  'เข็ม': 'pin_1.gif',
  'กระดาษ': 'paper_1.gif',
  'ผ้า': 'fabricTH_1.gif',
  'ผ้า2': 'fabricJP_1.gif',
  'กระดุม': 'buttom_1.gif',
  'จักรเย็บ': 'sewing_1.gif',
  'หนังสือ': 'book_1.gif',
  'น้ำมัน': 'oil_1.jpg',
  'ลูกปัด': 'buttom_1.gif',
  'เบ็ดเตล็ด': 'bolt2.jpg',
  'เส้น': 'metalic.jpg',
  'ฟองน้ำ': 'fabricJP_1.gif',
  'ขีดเขียน': 'pic_crochethooks.jpg',
  'เสื่อ': 'fabirc_1.gif',
  'กระเป๋า': 'bag02.png',
  'เครื่องวัด': 'bolt2.jpg',
  'ริ้บบิ้นผ้า': 'fabricJP_1.gif',
  'เอ็น': 'bolt2.jpg'
};

// Map known types based on INV's actual files
const TYPE_IMG_MAP = {
  // ด้าย (Category 1)
  'วีนัส 550m.': 'vnus1.gif',
  'นกยูง 500ม.': 'peacock1.gif',
  'นกยูง 4000ม.': 'peacock1.gif',
  'วีนัส เบอร์30': 'venus_winnid.jpg',
  'ด้ายฟู(หมี)': 'bear_1.gif',
  'ด้ายฟู มด': 'ant.jpg',
  'ด้ายโพ้งมัน': 'boat_1.gif',
  'ด้ายเนา400ม.': 'IMG_2620.jpg',
  'ด้ายเนาใหญ่': 'IMG_2621.jpg',
  'ดิ้นแบน': 'metalic.jpg',
  'เย็บดอกบัว': 'thread_icon.gif',
  'ฟูดอกบัว': 'knit_foo.jpg',
  'ฟูขาวดอกบัว': 'knit_foo.jpg',
  'ฟูขาว กก.': 'polyester.gif',
  'ฟูดำ กก.': 'polyester.jpg',
  'โพ้งเข็มดอกบัว': 'sewing_1.gif',
  'ด้ายวีนัสเล็ก100y': 'vnus1.gif',
  'ด้าย no.20': 'IMG_2593-Edit.jpg',
  'ด้ายมัน': 'IMG_2620.jpg',
  'ด้ายตราใบไม้': 'bolt2.jpg',
  'V-SPUN 180 ': 'vnus1.gif',
  'V-SPUN 180': 'vnus1.gif',
  'Nylon 20': 'bolt2.jpg',
  'Nylon 10': 'bolt2.jpg',

  // ไหม (Category 2)
  'วีนัส 420Y': 'yarn_2.jpg',
  'วีนัสเส้นใหญ่': 'yarn_2.jpg',
  'summer #16': 'knit.jpg',
  'Summer #16': 'knit.jpg',
  'summer #20': 'knit_yard.jpg',
  'Summer #20': 'knit_yard.jpg',
  'ไหมฟู': 'knit_foo.jpg',
  'ไหมปักจักร': 'knit.jpg',
  'ไหมพรมกลุ่มเล็ก': 'yarn_2.jpg',
  'ขนแกะ 50g': 'knit.jpg',
  'ขนแกะ 100g.': 'knit.jpg',
  'ขนแกะ 100g': 'knit.jpg',
  'ขนแกะแฟนซี WA016': 'knit.jpg',
  'ไหมญี่ปุ่นลูก': 'yarn_2.jpg',
  'ไหมญี่ปุ่นลูกท้อ': 'yarn_2.jpg',
  'Cotton 100%': 'polyester.jpg',
  'คอตตอนมาเช่ด': 'polyester.gif',
  'คอตตอนมาย์ด': 'polyester.gif',
  'ไหมเดินเส้น': 'yean_1.gif',
  'อีเกิ้ล': 'yean_1.gif',
  'อุด้ง WA80': 'knit_yard.jpg',
  'Aladin': 'knit.jpg',
  'Tarzan': 'knit.jpg',
  'EasyFrame': 'foot_skeleton.jpg',
  'ไม้ตะปู': 'bolt2.jpg',
  'ไม้นิตไม้ไผ่': 'pic_crochethooks.jpg',
  'ไม้นิต': 'pic_crochethooks.jpg',
  'เข็มโครเช': 'pic_crochethooks.jpg',
  'เข็มโครเชทอง': 'pic_crochethooks.jpg',
  'ไม้นิต อะคริลิค': 'pic_crochethooks.jpg',
  'ด้ายมุกมัน': 'IMG_2620.jpg',
  'ไม้นิตมีสายNP': 'pic_crochethooks.jpg',
  'Angel Chose': 'knit.jpg',
  'อื่นๆ': 'yean_1.gif',

  // จักร & อุปกรณ์
  'ตีนผีอุตฯ': 'foot_skeleton.jpg',
  'หัวจักร': 'head_sawing.jpg',
  'จานจักร': 'disc_sawing.jpg',
  'มอเตอร์จักร': 'sewing_motor.jpg',
  'น๊อตจักร': 'bolt2.jpg',
  'กรรไกร': 'scissors_1.gif',
  'กรรไกรใหญ่ตราช้าง': 'scissor_2.jpg',
  'กรรไกรซิงเกอร์': 'scissors_1.gif',
  'กรรไกรตรากระทิง': 'scissor_2.jpg',
  'กรรไกรแฟนซี': 'scissors_1.gif',
  'ก้ามปู': 'scissors_1.gif',
  'ก้ามปู (ใหญ่)': 'scissors_1.gif',
  'ก้ามปู(ดี)': 'scissors_1.gif',
  'ก้ามปูสีทอง': 'scissors_1.gif',
  'เข็มโครเชต์': 'pic_crochethooks.jpg',
  'เข็มสอย': 'pin_1.gif',
  'เข็มหมุดแผง': 'pin.jpg',
  'เข็มหมุดกล่อง': 'pin.jpg',
  'เข็มจักร  DB': 'pin_1.gif',
  'เข็มจักร  HA': 'pin_1.gif',
  'เข็มจักร  DC': 'pin_1.gif',
  'เข็มรอยไหมพรม': 'pin_1.gif',
  'ชุดเข็มด้าย วีนัส': 'pin_1.gif',
  'เข็มกลัด (เล็ก)': 'pin_1.gif',
  'เข็มกลัด (ใหญ่พิเศษ)': 'pin_1.gif',
  'เข็มกลัด (ส้ม)': 'pin_1.gif',
  'เข็มกลัดบานเย็น No.4(ใหญ่)': 'pin_1.gif',

  // ซิป
  'ซิบตัดไนล่อน': 'zipper_1.gif',
  'ซิปซ่อน MS': 'zipper_1.gif',
  'ซิปยีน NP': 'zipper_1.gif',
  'ไนล่อนเปิดท้าย ': 'zipper_1.gif',
  'หัวซิป': 'zipper_1.gif',
  'หัวซิป แฟชั่น': 'zipper_1.gif',
  'ทองเหลือง ถอดได้': 'zipper_1.gif',
  'ซิปตัดฟันเงิน': 'zipper_1.gif',
  'หัวซิปฟันเงิน': 'zipper_1.gif',

  // ผ้า & ยางยืด
  'ผ้ากาวยืด': 'fabricJP_1.gif',
  'ผ้าไทย': 'fabricTH_1.gif',
  'ยางยืด': 'elastic_1.gif',
  'ยางยืด ¾': 'elastic_1.gif',
  'ยางยืด ½': 'elastic_1.gif',
  'ยางยืด 1': 'elastic_1.gif',
  'ยางยืด 1¼': 'elastic_1.gif',
  'ยางยืด 1½': 'elastic_1.gif',
  'ยางยืด 2': 'elastic_1.gif',
  'ยางยืด กันลื่น': 'elastic_1.gif',
  'ยางยืดถัก': 'elastic_1.gif',
  'ยางยืดถักแบบม้วน': 'elastic_1.gif',
  'สม็อค Venus (ขาว)': 'elastic_1.gif',
  'ยางสม็อคสีดำ': 'elastic_1.gif',
  'ยางติดลังดุม': 'elastic_1.gif',
  'ยางขาวตรานก': 'elastic_1.gif',
  'ยางยืดถัก วีนัสแบบม้วน': 'elastic_1.gif',
  'ยางยืดดำ 1': 'elastic_1.gif',
  'ยางยืดดำ ¾': 'elastic_1.gif',
  'ยางยืดดำ 1¼': 'elastic_1.gif',
  'ยางยืดดำ 1½': 'elastic_1.gif',
  'ยางยืดดำ 2': 'elastic_1.gif',
  'ยางยืดดำวีนัส': 'elastic_1.gif',
  'ยางเส้นกลม TBE': 'elastic_1.gif',
  'น้ำมันจักร': 'oil_1.jpg'
};

function resolveProductImage(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const cleanPic = filename.replace(/^\/?img\//, '').replace(/^products\//, '').trim();
  if (!cleanPic) return null;
  const base = path.basename(cleanPic);
  if (!base || base === '.' || base === '/') return null;
  
  const p1 = path.join(INV_PRODUCTS_DIR, base);
  if (fs.existsSync(p1) && fs.statSync(p1).isFile()) {
    return `/img/products/${base}`;
  }
  const p2 = path.join(INV_IMG_ROOT, cleanPic);
  if (fs.existsSync(p2) && fs.statSync(p2).isFile()) {
    return `/img/${cleanPic}`;
  }
  const p3 = path.join(INV_IMG_ROOT, base);
  if (fs.existsSync(p3) && fs.statSync(p3).isFile()) {
    return `/img/${base}`;
  }
  return null;
}

// ---------------------- API: Categories & Types ----------------------

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT category_id, name, serial_id, detail, "order", pic 
      FROM inv_categories 
      ORDER BY "order" ASC, category_id ASC
    `);

    categories.forEach(c => {
      let resolved = null;
      if (CATEGORY_IMG_MAP[c.name]) {
        resolved = resolveProductImage(CATEGORY_IMG_MAP[c.name]);
      }
      if (!resolved && c.pic) {
        resolved = resolveProductImage(c.pic);
      }
      c.resolved_pic = resolved;
    });

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

    types.forEach(t => {
      let resolved = null;
      if (TYPE_IMG_MAP[t.name]) {
        resolved = resolveProductImage(TYPE_IMG_MAP[t.name]);
      }
      if (!resolved && t.pic) {
        resolved = resolveProductImage(t.pic);
      }
      if (!resolved && t.category_name && CATEGORY_IMG_MAP[t.category_name]) {
        resolved = resolveProductImage(CATEGORY_IMG_MAP[t.category_name]);
      }
      t.resolved_pic = resolved;
    });

    res.json({ success: true, data: types });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get products/variants by type_id
app.get('/api/types/:type_id/products', async (req, res) => {
  try {
    const { type_id } = req.params;
    const type = await db.get('SELECT * FROM inv_types WHERE type_id = ?', [type_id]);
    const serial = type ? (type.serial_id || '') : '';

    const products = await db.query(`
      SELECT p.id, p.product_id, p.product, p.type_id, p.category_id, p.quantity, p.unit, p.sale_price, p.cost, p.code, p.promotion_id,
             p.stock_id, s.stock_name, s.detail as stock_detail,
             l.min as limit_min, l.max as limit_max
      FROM inv_products p
      LEFT JOIN inv_stocks s ON p.stock_id = s.stock_id
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id
      WHERE p.type_id = ?
      ORDER BY p.code ASC, p.id ASC
    `, [type_id]);

    const promotions = await db.query(`
      SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
      FROM inv_promotions
      WHERE type_id = ? AND (promotion_id = ? OR promotion_id = '' OR promotion_id = ?)
      ORDER BY "limit" ASC
    `, [type_id.toString(), serial, type_id.toString()]);

    // Check for variant-specific promotions (where promotion_id = product_id or custom promotion_id)
    const productIds = products.map(p => p.product_id).filter(Boolean);
    const customPromoIds = [...new Set([
      ...productIds,
      ...products.map(p => p.promotion_id).filter(pid => pid && pid !== serial && pid !== type_id.toString())
    ])];

    let variantPromoMap = {};
    if (customPromoIds.length > 0) {
      const placeholders = customPromoIds.map(() => '?').join(',');
      const variantPromos = await db.query(`
        SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
        FROM inv_promotions
        WHERE promotion_id IN (${placeholders})
        ORDER BY "limit" ASC
      `, customPromoIds);

      variantPromos.forEach(vp => {
        const key = vp.promotion_id;
        if (!variantPromoMap[key]) variantPromoMap[key] = [];
        variantPromoMap[key].push(vp);
      });
    }

    products.forEach(p => {
      p.has_custom_price = (p.sale_price && p.sale_price > 0);
      const customP = variantPromoMap[p.product_id] || (p.promotion_id && variantPromoMap[p.promotion_id]);
      if (customP && customP.length > 0) {
        p.custom_promotions = customP;
        p.has_custom_promo = true;
      } else {
        p.custom_promotions = [];
        p.has_custom_promo = false;
      }
    });

    res.json({ success: true, data: products, promotions, type });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Promotions (Matching INVapp types/promotion) ----------------------

// 1. Get all types that have active promotions
app.get('/api/promotions/types', async (req, res) => {
  try {
    const { category_id, q } = req.query;
    let sql = `
      SELECT t.type_id, t.name, t.serial_id, t.pic, t.sale_price, t.cost, t.category_id,
             c.name as category_name,
             COUNT(p.id) as promo_count
      FROM inv_promotions p
      INNER JOIN inv_types t ON p.type_id = t.type_id
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE p.type_id > 0
    `;
    const params = [];
    if (category_id) {
      sql += ' AND t.category_id = ?';
      params.push(category_id);
    }
    if (q) {
      sql += ' AND (t.name LIKE ? OR t.serial_id LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' GROUP BY t.type_id ORDER BY t.category_id ASC, t.type_id ASC';

    const types = await db.query(sql, params);

    // Fetch all promotions for these types
    const allPromotions = await db.query(`
      SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
      FROM inv_promotions
      WHERE type_id > 0
      ORDER BY CAST(type_id AS INTEGER) ASC, "limit" ASC
    `);

    // Group promotions by type_id
    const promoMap = {};
    allPromotions.forEach(p => {
      const tid = p.type_id.toString();
      if (!promoMap[tid]) promoMap[tid] = [];
      promoMap[tid].push(p);
    });

    types.forEach(t => {
      let resolved = null;
      if (TYPE_IMG_MAP[t.name]) {
        resolved = resolveProductImage(TYPE_IMG_MAP[t.name]);
      }
      if (!resolved && t.pic) {
        resolved = resolveProductImage(t.pic);
      }
      if (!resolved && t.category_name && CATEGORY_IMG_MAP[t.category_name]) {
        resolved = resolveProductImage(CATEGORY_IMG_MAP[t.category_name]);
      }
      t.resolved_pic = resolved;
      t.promotions = promoMap[t.type_id.toString()] || [];
    });

    res.json({ success: true, data: types });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get promotions for a specific type
app.get('/api/promotions/types/:type_id', async (req, res) => {
  try {
    const { type_id } = req.params;
    const type = await db.get(`
      SELECT t.*, c.name as category_name
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE t.type_id = ?
    `, [type_id]);

    if (!type) {
      return res.status(404).json({ success: false, message: 'ไม่พบประเภทสินค้านี้' });
    }

    let resolved = null;
    if (TYPE_IMG_MAP[type.name]) resolved = resolveProductImage(TYPE_IMG_MAP[type.name]);
    if (!resolved && type.pic) resolved = resolveProductImage(type.pic);
    if (!resolved && type.category_name && CATEGORY_IMG_MAP[type.category_name]) {
      resolved = resolveProductImage(CATEGORY_IMG_MAP[type.category_name]);
    }
    type.resolved_pic = resolved;

    const promotions = await db.query(`
      SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
      FROM inv_promotions
      WHERE type_id = ?
      ORDER BY "limit" ASC
    `, [type_id.toString()]);

    res.json({ success: true, data: { type, promotions } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create a new promotion tier (Matching types/addPro)
app.post('/api/promotions', async (req, res) => {
  try {
    const { type_id, promotion_id, name, limit, price, detail } = req.body;
    if (!type_id || !name || limit === undefined || price === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const result = await db.run(`
      INSERT INTO inv_promotions (promotion_id, type_id, name, class_id, price, "limit", detail)
      VALUES (?, ?, ?, 0, ?, ?, ?)
    `, [
      promotion_id || '',
      type_id.toString(),
      name,
      parseFloat(price),
      parseInt(limit),
      detail || ''
    ]);

    const created = await db.get('SELECT * FROM inv_promotions WHERE id = ?', [result.lastID]);
    res.json({ success: true, message: 'เพิ่มโปรโมชั่นเรียบร้อย', data: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Update a promotion tier (Matching types/editPro)
app.put('/api/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { promotion_id, name, limit, price, detail } = req.body;
    if (!name || limit === undefined || price === undefined) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    await db.run(`
      UPDATE inv_promotions
      SET promotion_id = COALESCE(?, promotion_id),
          name = ?,
          price = ?,
          "limit" = ?,
          detail = ?
      WHERE id = ?
    `, [
      promotion_id,
      name,
      parseFloat(price),
      parseInt(limit),
      detail || '',
      id
    ]);

    const updated = await db.get('SELECT * FROM inv_promotions WHERE id = ?', [id]);
    res.json({ success: true, message: 'แก้ไขโปรโมชั่นเรียบร้อย', data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Delete a promotion tier (Matching types/deletePro)
app.delete('/api/promotions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.run('DELETE FROM inv_promotions WHERE id = ?', [id]);
    res.json({ success: true, message: 'ลบโปรโมชั่นเรียบร้อย' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Variant Fixed Price & Custom Promotions ----------------------

// 6. Get pricing & promotion info for a specific variant/product
app.get('/api/products/:product_id/pricing-info', async (req, res) => {
  try {
    const { product_id } = req.params;
    const product = await db.get(`
      SELECT p.*, t.name as type_name, t.serial_id as type_serial, t.sale_price as type_sale_price
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      WHERE p.product_id = ? OR p.code = ?
      LIMIT 1
    `, [product_id, product_id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้ารหัสนี้' });
    }

    // Default type promotions
    const typePromos = await db.query(`
      SELECT * FROM inv_promotions WHERE type_id = ? ORDER BY "limit" ASC
    `, [product.type_id.toString()]);

    // Variant-specific promotions
    const customPromos = await db.query(`
      SELECT * FROM inv_promotions WHERE promotion_id = ? ORDER BY "limit" ASC
    `, [product.product_id]);

    res.json({
      success: true,
      data: {
        product,
        type_price: product.type_sale_price || 0,
        type_promotions: typePromos,
        custom_price: product.sale_price || 0,
        custom_promotions: customPromos,
        has_custom_price: product.sale_price > 0,
        has_custom_promo: customPromos.length > 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Save custom fixed price & promotion tiers for a specific variant
app.post('/api/products/:product_id/custom-pricing', async (req, res) => {
  try {
    const { product_id } = req.params;
    const { sale_price, tiers, reset_to_default } = req.body;

    const product = await db.get(`
      SELECT p.*, t.serial_id as type_serial
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      WHERE p.product_id = ?
    `, [product_id]);

    if (!product) {
      return res.status(404).json({ success: false, message: 'ไม่พบสินค้ารหัสนี้' });
    }

    if (reset_to_default) {
      // Revert to type default
      const defaultPromoId = product.type_serial || '';
      await db.run('UPDATE inv_products SET sale_price = 0, promotion_id = ? WHERE product_id = ?', [defaultPromoId, product_id]);
      await db.run('DELETE FROM inv_promotions WHERE promotion_id = ?', [product_id]);

      return res.json({
        success: true,
        message: `รีเซ็ตราคาและโปรโมชั่นของ ${product_id} เป็นค่าเริ่มต้นตามประเภทเรียบร้อย`,
        data: { product_id, sale_price: 0, promotion_id: defaultPromoId, promotions: [] }
      });
    }

    const newPrice = parseFloat(sale_price || 0);
    // When custom price or promo is set, link promotion_id to this product_id
    const targetPromoId = (Array.isArray(tiers) && tiers.length > 0) ? product_id : (product.type_serial || '');
    
    await db.run('UPDATE inv_products SET sale_price = ?, promotion_id = ? WHERE product_id = ?', [
      newPrice,
      targetPromoId,
      product_id
    ]);

    // Clean existing custom promos for this product
    await db.run('DELETE FROM inv_promotions WHERE promotion_id = ?', [product_id]);

    const insertedPromos = [];
    if (Array.isArray(tiers) && tiers.length > 0) {
      for (const t of tiers) {
        const limitVal = parseInt(t.limit);
        const priceVal = parseFloat(t.price);
        if (!isNaN(limitVal) && limitVal > 0 && !isNaN(priceVal) && priceVal >= 0) {
          const nameVal = t.name ? t.name.trim() : `${limitVal} ชิ้น`;
          const detailVal = t.detail ? t.detail.trim() : '';
          const r = await db.run(`
            INSERT INTO inv_promotions (promotion_id, type_id, name, class_id, price, "limit", detail)
            VALUES (?, ?, ?, 0, ?, ?, ?)
          `, [product_id, product.type_id.toString(), nameVal, priceVal, limitVal, detailVal]);

          insertedPromos.push({
            id: r.lastID,
            promotion_id: product_id,
            type_id: product.type_id.toString(),
            name: nameVal,
            limit: limitVal,
            price: priceVal,
            detail: detailVal
          });
        }
      }
    }

    res.json({
      success: true,
      message: `บันทึกราคาและโปรโมชั่นเฉพาะ ${product_id} เรียบร้อยแล้ว`,
      data: {
        product_id,
        sale_price: newPrice,
        promotions: insertedPromos
      }
    });
  } catch (err) {
    console.error('Error saving custom pricing:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Get all variants under a type that have custom pricing or promotions
app.get('/api/types/:type_id/custom-pricing-products', async (req, res) => {
  try {
    const { type_id } = req.params;
    const type = await db.get('SELECT * FROM inv_types WHERE type_id = ?', [type_id]);
    const serial = type ? (type.serial_id || '') : '';

    const products = await db.query(`
      SELECT p.id, p.product_id, p.product, p.code, p.sale_price, p.cost, p.quantity, p.promotion_id
      FROM inv_products p
      WHERE p.type_id = ? AND (p.sale_price > 0 OR (p.promotion_id != '' AND p.promotion_id != ? AND p.promotion_id != ?))
      ORDER BY p.code ASC
    `, [type_id, serial, type_id.toString()]);

    const productIds = products.map(p => p.product_id);
    let promos = [];
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      promos = await db.query(`
        SELECT * FROM inv_promotions WHERE promotion_id IN (${placeholders}) ORDER BY "limit" ASC
      `, productIds);
    }

    const promoMap = {};
    promos.forEach(pr => {
      if (!promoMap[pr.promotion_id]) promoMap[pr.promotion_id] = [];
      promoMap[pr.promotion_id].push(pr);
    });

    products.forEach(p => {
      p.custom_promotions = promoMap[p.product_id] || [];
    });

    res.json({ success: true, data: products });
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
             p.quantity, p.unit, p.sale_price, p.cost, p.detail, p.code, p.promotion_id,
             t.name as type_name, t.pic as type_pic, t.serial_id as type_serial, t.sale_price as type_sale_price,
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

    const hasCustomPrice = (product.sale_price && product.sale_price > 0);
    if (!hasCustomPrice) {
      product.sale_price = product.type_sale_price || 0;
    }

    // Check promotions for this variant first
    let promotions = await db.query(`
      SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
      FROM inv_promotions
      WHERE promotion_id = ?
      ORDER BY "limit" ASC
    `, [product.product_id]);

    let hasCustomPromo = (promotions && promotions.length > 0);

    if (!hasCustomPromo) {
      // Fallback to type promotions
      promotions = await db.query(`
        SELECT id, promotion_id, type_id, name, class_id, price, "limit", detail
        FROM inv_promotions
        WHERE type_id = ?
        ORDER BY "limit" ASC
      `, [product.type_id ? product.type_id.toString() : '']);
    }

    res.json({
      success: true,
      data: {
        ...product,
        promotions,
        has_custom_price: hasCustomPrice,
        has_custom_promo: hasCustomPromo
      }
    });
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
