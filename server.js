require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Directory for uploaded product images
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
}

// Serve frontend static files and uploads
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

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
  if (filename.startsWith('data:image')) return filename;
  if (filename.startsWith('/uploads/')) return filename;

  const cleanPic = filename.replace(/^\/?(img\/|uploads\/)/, '').replace(/^products\//, '').trim();
  if (!cleanPic) return null;
  const base = path.basename(cleanPic);
  if (!base || base === '.' || base === '/') return null;

  // 1. Check local public/uploads
  const p0 = path.join(UPLOADS_DIR, base);
  if (fs.existsSync(p0) && fs.statSync(p0).isFile()) {
    return `/uploads/${base}`;
  }
  
  // 2. Check INV_PRODUCTS_DIR
  const p1 = path.join(INV_PRODUCTS_DIR, base);
  if (fs.existsSync(p1) && fs.statSync(p1).isFile()) {
    return `/img/products/${base}`;
  }

  // 3. Check INV_IMG_ROOT
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

async function saveUploadedBase64Image(imageBase64, prefix = 'img') {
  if (imageBase64 && typeof imageBase64 === 'string' && imageBase64.startsWith('data:image')) {
    const match = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (match) {
      let ext = match[1].toLowerCase();
      if (ext === 'jpeg') ext = 'jpg';
      const base64Data = match[2];
      const fileName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, fileName);
      await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));

      // Also copy to INV_PRODUCTS_DIR if it exists
      if (fs.existsSync(INV_PRODUCTS_DIR)) {
        try {
          await fs.promises.copyFile(filePath, path.join(INV_PRODUCTS_DIR, fileName));
        } catch (e) {}
      }
      return `/uploads/${fileName}`;
    }
  }
  return null;
}

// ---------------------- API: Categories & Types ----------------------

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT c.category_id, c.name, c.serial_id, c.detail, c."order", c.pic,
             (SELECT COUNT(*) FROM inv_types t WHERE t.category_id = c.category_id) as type_count,
             (SELECT COUNT(*) FROM inv_products p WHERE p.category_id = c.category_id) as product_count
      FROM inv_categories c 
      ORDER BY c."order" ASC, c.category_id ASC
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

// Create new category (matching INVapp /categories/add)
app.post('/api/categories', async (req, res) => {
  try {
    const { name, serial_id, detail } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อประเภท/หมวดหมู่สินค้า' });
    }
    const cleanName = name.trim();
    const cleanSerial = (serial_id || '').trim();
    const cleanDetail = (detail || '').trim();

    const existing = await db.get('SELECT category_id FROM inv_categories WHERE name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ success: false, error: `หมวดหมู่ "${cleanName}" มีอยู่ในระบบแล้ว` });
    }

    const result = await db.run(`
      INSERT INTO inv_categories (name, serial_id, detail, "order")
      VALUES (?, ?, ?, 99)
    `, [cleanName, cleanSerial, cleanDetail]);

    res.json({
      success: true,
      message: 'เพิ่มหมวดหมู่สินค้าใหม่เรียบร้อย',
      data: {
        category_id: result.lastID,
        name: cleanName,
        serial_id: cleanSerial,
        detail: cleanDetail
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get types by category
app.get('/api/types', async (req, res) => {
  try {
    const { category_id, q } = req.query;
    let sql = `
      SELECT t.type_id, t.category_id, t.serial_id, t.name, t.detail, t.eng_name, t.pic, t.sale_price, t.cost, t."order",
             c.name as category_name,
             (SELECT COUNT(*) FROM inv_products p WHERE p.type_id = t.type_id) as product_count,
             (SELECT COUNT(*) FROM inv_products p LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id WHERE p.type_id = t.type_id AND p.quantity <= COALESCE(l.min, 5)) as low_stock_count
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE 1=1
    `;
    const params = [];
    if (category_id) {
      sql += ' AND t.category_id = ?';
      params.push(category_id);
    }
    if (q) {
      sql += ' AND (t.name LIKE ? OR t.serial_id LIKE ? OR t.eng_name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
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

// Get single type with full details (matching INVapp /types/edit/:id)
app.get('/api/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const type = await db.get(`
      SELECT t.type_id, t.category_id, t.serial_id, t.name, t.detail, t.eng_name, t.pic, t.sale_price, t.cost, t."order",
             c.name as category_name
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE t.type_id = ?
    `, [id]);

    if (!type) {
      return res.status(404).json({ success: false, error: 'ไม่พบประเภทสินค้า' });
    }

    let resolved = null;
    if (type.pic) resolved = resolveProductImage(type.pic);
    if (!resolved && TYPE_IMG_MAP[type.name]) resolved = resolveProductImage(TYPE_IMG_MAP[type.name]);
    if (!resolved && type.category_name && CATEGORY_IMG_MAP[type.category_name]) resolved = resolveProductImage(CATEGORY_IMG_MAP[type.category_name]);
    type.resolved_pic = resolved;

    const countRow = await db.get('SELECT COUNT(*) as prod_count FROM inv_products WHERE type_id = ?', [id]);
    type.product_count = countRow ? countRow.prod_count : 0;

    res.json({ success: true, data: type });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new Type (matching INVapp /types/add)
app.post('/api/types', async (req, res) => {
  try {
    const { category_id, serial_id, name, eng_name, sale_price = 0, cost = 0, detail = '', image_base64 } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อสินค้า / Type (เช่น นกยูง 500ม.)' });
    }
    if (!category_id) {
      return res.status(400).json({ success: false, error: 'กรุณาเลือกหมวดหมู่สินค้า' });
    }

    const cleanName = name.trim();
    const cleanEng = (eng_name || '').trim();
    const cleanSerial = (serial_id || '').trim();
    const cleanDetail = (detail || '').trim();
    const numPrice = parseFloat(sale_price) || 0;
    const numCost = parseFloat(cost) || 0;

    if (cleanSerial) {
      const exist = await db.get('SELECT type_id FROM inv_types WHERE serial_id = ?', [cleanSerial]);
      if (exist) {
        return res.status(400).json({ success: false, error: `รหัสสินค้า (Serial ID) "${cleanSerial}" มีอยู่แล้ว` });
      }
    }

    let savedPic = null;
    if (image_base64) {
      savedPic = await saveUploadedBase64Image(image_base64, 'type');
    }

    const result = await db.run(`
      INSERT INTO inv_types (category_id, serial_id, name, detail, eng_name, pic, sale_price, cost, "order")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 99)
    `, [category_id, cleanSerial, cleanName, cleanDetail, cleanEng, savedPic, numPrice, numCost]);

    const created = await db.get(`
      SELECT t.*, c.name as category_name
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE t.type_id = ?
    `, [result.lastID]);
    created.resolved_pic = savedPic ? resolveProductImage(savedPic) : null;

    res.json({
      success: true,
      message: 'เพิ่มประเภทสินค้า (Type) สำเร็จ',
      data: created
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update Type (matching INVapp /types/edit/:id)
app.put('/api/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, serial_id, name, eng_name, sale_price, cost, detail, image_base64, remove_image, update_all_items_price } = req.body;

    const currentType = await db.get('SELECT * FROM inv_types WHERE type_id = ?', [id]);
    if (!currentType) {
      return res.status(404).json({ success: false, error: 'ไม่พบประเภทสินค้านี้' });
    }

    let savedPic = undefined;
    if (image_base64) {
      savedPic = await saveUploadedBase64Image(image_base64, `type_${id}`);
    } else if (remove_image) {
      savedPic = null;
    }

    const cleanName = name !== undefined ? name.trim() : currentType.name;
    const cleanEng = eng_name !== undefined ? eng_name.trim() : currentType.eng_name;
    const cleanSerial = serial_id !== undefined ? serial_id.trim() : currentType.serial_id;
    const cleanDetail = detail !== undefined ? detail : currentType.detail;
    const numPrice = sale_price !== undefined ? (parseFloat(sale_price) || 0) : currentType.sale_price;
    const numCost = cost !== undefined ? (parseFloat(cost) || 0) : currentType.cost;
    const catId = category_id !== undefined ? (parseInt(category_id) || currentType.category_id) : currentType.category_id;

    if (savedPic !== undefined) {
      await db.run(`
        UPDATE inv_types
        SET category_id = ?, serial_id = ?, name = ?, detail = ?, eng_name = ?, pic = ?, sale_price = ?, cost = ?
        WHERE type_id = ?
      `, [catId, cleanSerial, cleanName, cleanDetail, cleanEng, savedPic, numPrice, numCost, id]);
    } else {
      await db.run(`
        UPDATE inv_types
        SET category_id = ?, serial_id = ?, name = ?, detail = ?, eng_name = ?, sale_price = ?, cost = ?
        WHERE type_id = ?
      `, [catId, cleanSerial, cleanName, cleanDetail, cleanEng, numPrice, numCost, id]);
    }

    if (update_all_items_price) {
      await db.run(`
        UPDATE inv_products
        SET sale_price = ?, cost = ?
        WHERE type_id = ?
      `, [numPrice, numCost, id]);
    }

    const updated = await db.get(`
      SELECT t.*, c.name as category_name
      FROM inv_types t
      LEFT JOIN inv_categories c ON t.category_id = c.category_id
      WHERE t.type_id = ?
    `, [id]);
    updated.resolved_pic = updated.pic ? resolveProductImage(updated.pic) : null;

    res.json({
      success: true,
      message: 'บันทึกข้อมูลประเภทสินค้าเรียบร้อย',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------- API: Stocks / Shelves (ชั้นวางสินค้า) ----------------------

// Get all stocks / shelves with product counts & total quantities
app.get('/api/stocks', async (req, res) => {
  try {
    const stocks = await db.query(`
      SELECT s.stock_id, s.stock_name, s.detail, s.pic, s.limit_stock,
             COUNT(p.product_id) as total_items,
             COALESCE(SUM(p.quantity), 0) as total_quantity
      FROM inv_stocks s
      LEFT JOIN inv_products p ON s.stock_id = p.stock_id
      GROUP BY s.stock_id, s.stock_name, s.detail, s.pic, s.limit_stock
      ORDER BY s.stock_name ASC
    `);
    res.json({ success: true, data: stocks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single stock details
app.get('/api/stocks/:stock_id', async (req, res) => {
  try {
    const { stock_id } = req.params;
    let stock = null;
    if (!isNaN(stock_id)) {
      stock = await db.get('SELECT * FROM inv_stocks WHERE stock_id = ?', [stock_id]);
    }
    if (!stock) {
      stock = await db.get('SELECT * FROM inv_stocks WHERE stock_name = ?', [stock_id]);
    }
    if (!stock) {
      return res.status(404).json({ success: false, error: 'ไม่พบคลังสินค้าหรือชั้นวางนี้' });
    }
    const stats = await db.get(`
      SELECT COUNT(product_id) as total_items, COALESCE(SUM(quantity), 0) as total_quantity
      FROM inv_products WHERE stock_id = ?
    `, [stock.stock_id]);
    res.json({
      success: true,
      data: {
        ...stock,
        total_items: stats.total_items || 0,
        total_quantity: stats.total_quantity || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all products in a specific stock / shelf (matching INVapp /stocks/view/:id)
app.get('/api/stocks/:stock_id/products', async (req, res) => {
  try {
    const { stock_id } = req.params;
    let stock = null;
    if (!isNaN(stock_id)) {
      stock = await db.get('SELECT * FROM inv_stocks WHERE stock_id = ?', [stock_id]);
    }
    if (!stock) {
      stock = await db.get('SELECT * FROM inv_stocks WHERE stock_name = ?', [stock_id]);
    }
    if (!stock) {
      return res.status(404).json({ success: false, error: 'ไม่พบคลังสินค้าหรือชั้นวางนี้' });
    }

    const { order = 'quantity', dir = 'ASC', q } = req.query;
    let orderClause = 'ORDER BY p.quantity ASC, p.code ASC';
    if (order === 'product') {
      orderClause = `ORDER BY p.product ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    } else if (order === 'code') {
      orderClause = `ORDER BY p.code ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    } else if (order === 'product_id') {
      orderClause = `ORDER BY p.product_id ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    } else if (order === 'quantity') {
      orderClause = `ORDER BY p.quantity ${dir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}`;
    }

    let filterSql = '';
    const params = [stock.stock_id];
    if (q) {
      filterSql = ' AND (p.product LIKE ? OR p.code LIKE ? OR p.product_id LIKE ? OR t.name LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const products = await db.query(`
      SELECT p.id, p.product_id, p.code, p.product, p.quantity, p.unit, p.sale_price, p.cost,
             p.type_id, p.category_id, p.pic as product_pic, p.detail,
             t.name as type_name, t.pic as type_pic,
             c.name as category_name,
             l.min as limit_min, l.max as limit_max
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      LEFT JOIN inv_categories c ON p.category_id = c.category_id
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id
      WHERE p.stock_id = ? ${filterSql}
      ${orderClause}
    `, params);

    products.forEach(p => {
      let resolved = null;
      if (p.product_pic) resolved = resolveProductImage(p.product_pic);
      if (!resolved && TYPE_IMG_MAP[p.type_name]) resolved = resolveProductImage(TYPE_IMG_MAP[p.type_name]);
      if (!resolved && p.type_pic) resolved = resolveProductImage(p.type_pic);
      if (!resolved && p.category_name && CATEGORY_IMG_MAP[p.category_name]) resolved = resolveProductImage(CATEGORY_IMG_MAP[p.category_name]);
      p.resolved_pic = resolved;
    });

    const stats = await db.get(`
      SELECT COUNT(product_id) as total_items, COALESCE(SUM(quantity), 0) as total_quantity
      FROM inv_products WHERE stock_id = ?
    `, [stock.stock_id]);

    res.json({
      success: true,
      stock: {
        ...stock,
        total_items: stats.total_items || 0,
        total_quantity: stats.total_quantity || 0
      },
      products
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create new stock / shelf
app.post('/api/stocks', async (req, res) => {
  try {
    const { stock_name, detail, limit_stock = 0, image_base64 } = req.body;
    if (!stock_name || !stock_name.trim()) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อคลังสินค้า / ชั้นวาง' });
    }
    const cleanName = stock_name.trim();
    const existing = await db.get('SELECT stock_id FROM inv_stocks WHERE stock_name = ?', [cleanName]);
    if (existing) {
      return res.status(400).json({ success: false, error: `ชื่อคลังสินค้า/ชั้นวาง "${cleanName}" มีอยู่ในระบบแล้ว` });
    }

    let savedPic = null;
    if (image_base64 && typeof image_base64 === 'string' && image_base64.startsWith('data:image')) {
      savedPic = await saveUploadedBase64Image(image_base64, `stock_${cleanName}`);
    }

    const result = await db.run(
      'INSERT INTO inv_stocks (stock_name, detail, limit_stock, unit_id, pic, time, status) VALUES (?, ?, ?, 0, ?, datetime("now"), 0)',
      [cleanName, detail ? detail.trim() : '', parseInt(limit_stock) || 0, savedPic]
    );

    const newStock = await db.get('SELECT * FROM inv_stocks WHERE stock_id = ?', [result.lastID]);
    res.json({
      success: true,
      message: 'เพิ่มคลังสินค้า / ชั้นวางใหม่เรียบร้อย',
      data: newStock
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update stock / shelf
app.put('/api/stocks/:stock_id', async (req, res) => {
  try {
    const { stock_id } = req.params;
    const { stock_name, detail, limit_stock = 0, image_base64, remove_image } = req.body;
    if (!stock_name || !stock_name.trim()) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อคลังสินค้า / ชั้นวาง' });
    }
    const cleanName = stock_name.trim();
    const current = await db.get('SELECT * FROM inv_stocks WHERE stock_id = ?', [stock_id]);
    if (!current) {
      return res.status(404).json({ success: false, error: 'ไม่พบคลังสินค้าที่ต้องการแก้ไข' });
    }

    const duplicate = await db.get('SELECT stock_id FROM inv_stocks WHERE stock_name = ? AND stock_id != ?', [cleanName, stock_id]);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `ชื่อคลังสินค้า/ชั้นวาง "${cleanName}" ซ้ำกับรายการอื่น` });
    }

    let savedPic = undefined;
    if (image_base64 && typeof image_base64 === 'string' && image_base64.startsWith('data:image')) {
      savedPic = await saveUploadedBase64Image(image_base64, `stock_${stock_id}`);
    } else if (remove_image) {
      savedPic = null;
    }

    if (savedPic !== undefined) {
      await db.run(
        'UPDATE inv_stocks SET stock_name = ?, detail = ?, limit_stock = ?, pic = ? WHERE stock_id = ?',
        [cleanName, detail !== undefined ? detail.trim() : current.detail, parseInt(limit_stock) || 0, savedPic, stock_id]
      );
    } else {
      await db.run(
        'UPDATE inv_stocks SET stock_name = ?, detail = ?, limit_stock = ? WHERE stock_id = ?',
        [cleanName, detail !== undefined ? detail.trim() : current.detail, parseInt(limit_stock) || 0, stock_id]
      );
    }

    const updated = await db.get('SELECT * FROM inv_stocks WHERE stock_id = ?', [stock_id]);
    res.json({
      success: true,
      message: 'บันทึกการแก้ไขคลังสินค้าเรียบร้อย',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete stock / shelf
app.delete('/api/stocks/:stock_id', async (req, res) => {
  try {
    const { stock_id } = req.params;
    const count = await db.get('SELECT count(*) as count FROM inv_products WHERE stock_id = ?', [stock_id]);
    if (count && count.count > 0) {
      return res.status(400).json({
        success: false,
        error: `ไม่สามารถลบชั้นวางนี้ได้ เนื่องจากมีสินค้าอยู่ในชั้นวางนี้ ${count.count} รายการ กรุณาย้ายสินค้าออกก่อน`
      });
    }
    await db.run('DELETE FROM inv_stocks WHERE stock_id = ?', [stock_id]);
    res.json({ success: true, message: 'ลบคลังสินค้า / ชั้นวางเรียบร้อย' });
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
             p.detail, p.stock_id, s.stock_name, s.detail as stock_detail,
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
      let resolved = null;
      if (p.product_pic) resolved = resolveProductImage(p.product_pic);
      if (!resolved && p.pic) resolved = resolveProductImage(p.pic);
      if (!resolved && type && type.pic) resolved = resolveProductImage(type.pic);
      if (!resolved && TYPE_IMG_MAP[p.product]) resolved = resolveProductImage(TYPE_IMG_MAP[p.product]);
      p.resolved_pic = resolved;

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
             p.quantity, p.unit, p.sale_price, p.cost, p.detail, p.code, p.pic as product_pic,
             s.stock_name, s.detail as stock_detail,
             t.name as type_name, t.pic as type_pic,
             c.name as category_name,
             l.min as limit_min, l.max as limit_max
      FROM inv_products p
      LEFT JOIN inv_stocks s ON p.stock_id = s.stock_id
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

    products.forEach(p => {
      let resolved = null;
      if (p.product_pic) resolved = resolveProductImage(p.product_pic);
      if (!resolved && TYPE_IMG_MAP[p.type_name]) resolved = resolveProductImage(TYPE_IMG_MAP[p.type_name]);
      if (!resolved && p.type_pic) resolved = resolveProductImage(p.type_pic);
      if (!resolved && p.category_name && CATEGORY_IMG_MAP[p.category_name]) resolved = resolveProductImage(CATEGORY_IMG_MAP[p.category_name]);
      p.resolved_pic = resolved;
    });

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
             p.quantity, p.unit, p.sale_price, p.cost, p.detail, p.code, p.promotion_id, p.pic as product_pic,
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

    // Resolve picture
    let resolved = null;
    if (product.product_pic) resolved = resolveProductImage(product.product_pic);
    if (!resolved && TYPE_IMG_MAP[product.type_name]) resolved = resolveProductImage(TYPE_IMG_MAP[product.type_name]);
    if (!resolved && product.type_pic) resolved = resolveProductImage(product.type_pic);
    if (!resolved && product.category_name && CATEGORY_IMG_MAP[product.category_name]) resolved = resolveProductImage(CATEGORY_IMG_MAP[product.category_name]);
    product.resolved_pic = resolved;

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

// Add new product item / variant (matching INVapp /products/add)
app.post('/api/products', async (req, res) => {
  try {
    const {
      type_id,
      code,
      product,
      product_eng,
      sale_price,
      cost,
      quantity = 0,
      unit = '',
      stock_id = 22,
      limit_min = 5,
      detail = '',
      image_base64
    } = req.body;

    if (!type_id) {
      return res.status(400).json({ success: false, error: 'กรุณาเลือกประเภทสินค้า (Type)' });
    }

    const type = await db.get('SELECT * FROM inv_types WHERE type_id = ?', [type_id]);
    if (!type) {
      return res.status(404).json({ success: false, error: 'ไม่พบประเภทสินค้าที่ระบุ' });
    }

    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุรหัสสินค้า / เบอร์สี (Code)' });
    }

    // Product ID generation: type.serial_id + code (matching INVapp pattern, e.g. A02 + 6780 -> A026780)
    const typeSerial = (type.serial_id || '').trim();
    const finalProductId = typeSerial ? `${typeSerial}${cleanCode}` : cleanCode;

    // Check duplicate product_id
    const duplicate = await db.get('SELECT id FROM inv_products WHERE product_id = ?', [finalProductId]);
    if (duplicate) {
      return res.status(400).json({ success: false, error: `รหัสสินค้า "${finalProductId}" มีอยู่ในระบบแล้ว` });
    }

    const finalName = product && product.trim() ? product.trim() : type.name;
    const finalPrice = sale_price !== undefined && sale_price !== '' ? (parseFloat(sale_price) || 0) : type.sale_price;
    const finalCost = cost !== undefined && cost !== '' ? (parseFloat(cost) || 0) : type.cost;
    const finalQty = parseInt(quantity) || 0;
    const finalUnit = (unit || '').trim();
    const finalStock = parseInt(stock_id) || 22;
    const finalDetail = (detail || '').trim();

    let savedPic = null;
    if (image_base64) {
      savedPic = await saveUploadedBase64Image(image_base64, 'prod');
    }

    const result = await db.run(`
      INSERT INTO inv_products (
        product_id, product, product_eng, type_id, category_id, stock_id,
        quantity, unit, sale_price, cost, detail, code, time, pic
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      finalProductId, finalName, product_eng || type.eng_name || '', type_id, type.category_id, finalStock,
      finalQty, finalUnit, finalPrice, finalCost, finalDetail, cleanCode, Math.floor(Date.now() / 1000).toString(), savedPic
    ]);

    // Insert safety min if provided
    if (limit_min !== undefined) {
      await db.run(`
        INSERT INTO inv_limitcheck (product_id, min, max)
        VALUES (?, ?, 0)
      `, [finalProductId, parseInt(limit_min) || 5]);
    }

    const newProd = await db.get(`
      SELECT p.*, t.name as type_name, c.name as category_name, l.min as limit_min
      FROM inv_products p
      LEFT JOIN inv_types t ON p.type_id = t.type_id
      LEFT JOIN inv_categories c ON p.category_id = c.category_id
      LEFT JOIN inv_limitcheck l ON p.product_id = l.product_id
      WHERE p.id = ?
    `, [result.lastID]);

    newProd.resolved_pic = savedPic ? resolveProductImage(savedPic) : (type.pic ? resolveProductImage(type.pic) : null);

    res.json({
      success: true,
      message: 'เพิ่มสินค้าใหม่เรียบร้อย',
      data: newProd
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update product stock / price / image / detail
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { product, sale_price, cost, quantity, unit, limit_min, limit_max, detail, image_base64, remove_image, update_type_image, stock_id } = req.body;

    let savedPic = undefined;

    // Handle new uploaded image
    if (image_base64 && typeof image_base64 === 'string' && image_base64.startsWith('data:image')) {
      savedPic = await saveUploadedBase64Image(image_base64, `prod_${id}`);
    } else if (remove_image) {
      savedPic = null;
    }

    const numStockId = stock_id !== undefined && stock_id !== '' ? parseInt(stock_id) : null;

    if (savedPic !== undefined) {
      await db.run(`
        UPDATE inv_products
        SET product = COALESCE(?, product),
            sale_price = COALESCE(?, sale_price),
            cost = COALESCE(?, cost),
            quantity = COALESCE(?, quantity),
            unit = COALESCE(?, unit),
            detail = COALESCE(?, detail),
            stock_id = COALESCE(?, stock_id),
            pic = ?
        WHERE id = ?
      `, [product, sale_price, cost, quantity, unit, detail, numStockId, savedPic, id]);
    } else {
      await db.run(`
        UPDATE inv_products
        SET product = COALESCE(?, product),
            sale_price = COALESCE(?, sale_price),
            cost = COALESCE(?, cost),
            quantity = COALESCE(?, quantity),
            unit = COALESCE(?, unit),
            detail = COALESCE(?, detail),
            stock_id = COALESCE(?, stock_id)
        WHERE id = ?
      `, [product, sale_price, cost, quantity, unit, detail, numStockId, id]);
    }

    // If update_type_image requested and product has type_id
    const prod = await db.get('SELECT product_id, type_id FROM inv_products WHERE id = ?', [id]);
    if (prod && prod.type_id && update_type_image && savedPic !== undefined) {
      const typePicVal = savedPic ? path.basename(savedPic) : null;
      await db.run('UPDATE inv_types SET pic = ? WHERE type_id = ?', [typePicVal, prod.type_id]);
    }

    // Update safety stock if provided
    if (prod && (limit_min !== undefined || limit_max !== undefined)) {
      const exists = await db.get('SELECT id FROM inv_limitcheck WHERE product_id = ?', [prod.product_id]);
      if (exists) {
        await db.run('UPDATE inv_limitcheck SET min = ?, max = ? WHERE product_id = ?', [limit_min || 0, limit_max || 0, prod.product_id]);
      } else {
        await db.run('INSERT INTO inv_limitcheck (product_id, min, max) VALUES (?, ?, ?)', [prod.product_id, limit_min || 0, limit_max || 0]);
      }
    }

    const resolvedPic = savedPic ? resolveProductImage(savedPic) : null;
    res.json({
      success: true,
      message: 'บันทึกข้อมูลสินค้าและรูปภาพเรียบร้อย',
      pic: savedPic,
      resolved_pic: resolvedPic
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Upload standalone image endpoint
app.post('/api/upload-image', async (req, res) => {
  try {
    const { image_base64, name = 'img' } = req.body;
    if (!image_base64 || !image_base64.startsWith('data:image')) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุข้อมูลรูปภาพ' });
    }
    const match = image_base64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ success: false, message: 'รูปแบบรูปภาพไม่ถูกต้อง' });
    }
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    const fileName = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);
    await fs.promises.writeFile(filePath, Buffer.from(match[2], 'base64'));

    if (fs.existsSync(INV_PRODUCTS_DIR)) {
      try {
        await fs.promises.copyFile(filePath, path.join(INV_PRODUCTS_DIR, fileName));
      } catch (e) {}
    }

    res.json({ success: true, url: `/uploads/${fileName}`, fileName });
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
  console.log(`📦 Database: MariaDB ${process.env.DB_NAME || 'db_pos'} (${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306})`);
  console.log(`===============================================`);
});
