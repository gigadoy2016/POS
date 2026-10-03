// ==========================================================================
// INVENTORY, BILLS HISTORY & REPORTS LOGIC
// ==========================================================================

const Inventory = {
  currentOffset: 0,
  pageSize: 25,
  currentQuery: '',
  isLowStockOnly: false,

  loadProducts: async function() {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;

    let url = `/api/products?limit=${this.pageSize}&offset=${this.currentOffset}`;
    if (this.currentQuery) url += `&q=${encodeURIComponent(this.currentQuery)}`;
    if (this.isLowStockOnly) url += `&low_stock=true`;

    try {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;">กำลังโหลดข้อมูลสต็อก...</td></tr>`;
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success || !json.data.length) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-dim);">ไม่พบรายการสินค้า</td></tr>`;
        return;
      }

      let html = '';
      json.data.forEach(p => {
        const isLow = p.quantity <= (p.limit_min || 5);
        html += `
          <tr style="border-bottom: 1px solid var(--border-color); height: 48px;">
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 600; color: var(--accent-primary);">${p.product_id}</td>
            <td style="padding: 8px 12px; font-weight: 500;">${p.product}</td>
            <td style="padding: 8px 12px; color: var(--text-muted);">${p.category_name || '-'} / ${p.type_name || '-'}</td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right;">฿${(p.cost || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #38bdf8; text-align: right;">฿${(p.sale_price || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; text-align: center;">
              <span class="stock-tag ${isLow ? 'low' : ''}">${p.quantity} ${p.unit || ''}</span>
              ${isLow ? `<span style="font-size: 0.7rem; color: var(--danger); display: block;">ต่ำกว่า Safety Min (${p.limit_min || 5})</span>` : ''}
            </td>
            <td style="padding: 8px 12px; text-align: center;">
              <button class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">แก้ไข</button>
            </td>
          </tr>
        `;
      });
      tableBody.innerHTML = html;
      document.getElementById('inv-page-info').innerText = `รายการที่ ${this.currentOffset + 1} - ${this.currentOffset + json.data.length}`;
    } catch (e) {
      console.error(e);
    }
  },

  nextPage: function() {
    this.currentOffset += this.pageSize;
    this.loadProducts();
  },

  prevPage: function() {
    if (this.currentOffset >= this.pageSize) {
      this.currentOffset -= this.pageSize;
      this.loadProducts();
    }
  },

  search: function(q) {
    this.currentQuery = q;
    this.currentOffset = 0;
    this.loadProducts();
  },

  toggleLowStock: function(checkbox) {
    this.isLowStockOnly = checkbox.checked;
    this.currentOffset = 0;
    this.loadProducts();
  },

  openEditModal: function(p) {
    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-code').value = p.product_id;
    document.getElementById('edit-prod-name').value = p.product;
    document.getElementById('edit-prod-price').value = p.sale_price;
    document.getElementById('edit-prod-cost').value = p.cost;
    document.getElementById('edit-prod-qty').value = p.quantity;
    document.getElementById('edit-prod-unit').value = p.unit || '';
    document.getElementById('edit-prod-min').value = p.limit_min || 5;

    document.getElementById('edit-product-modal').classList.add('active');
  },

  saveProduct: async function() {
    const id = document.getElementById('edit-prod-id').value;
    const payload = {
      product: document.getElementById('edit-prod-name').value,
      sale_price: parseFloat(document.getElementById('edit-prod-price').value || 0),
      cost: parseFloat(document.getElementById('edit-prod-cost').value || 0),
      quantity: parseInt(document.getElementById('edit-prod-qty').value || 0),
      unit: document.getElementById('edit-prod-unit').value,
      limit_min: parseInt(document.getElementById('edit-prod-min').value || 5)
    };

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showToast('อัปเดตข้อมูลสินค้าเรียบร้อย', 'success');
        document.getElementById('edit-product-modal').classList.remove('active');
        this.loadProducts();
        POS.loadProducts(); // sync POS grid
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  }
};

// ---------------------- Bills History ----------------------
const BillsHistory = {
  loadBills: async function() {
    const tbody = document.getElementById('bills-table-body');
    if (!tbody) return;

    try {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px;">กำลังโหลดประวัติบิล...</td></tr>`;
      const res = await fetch('/api/bills?limit=25');
      const json = await res.json();

      if (!json.success || !json.data.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-dim);">ไม่มีประวัติบิล</td></tr>`;
        return;
      }

      let html = '';
      json.data.forEach(b => {
        let dateStr = '-';
        if (b.date && b.date.length >= 10) {
          const num = parseInt(b.date);
          if (!isNaN(num)) {
            dateStr = new Date(num * 1000).toLocaleString('th-TH');
          }
        }
        html += `
          <tr style="border-bottom: 1px solid var(--border-color); height: 46px;">
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--accent-primary);">#${b.bill_id}</td>
            <td style="padding: 8px 12px; color: var(--text-muted);">${dateStr}</td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right;">฿${(b.result || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; color: #38bdf8; text-align: right;">฿${(b.profit || 0).toFixed(2)}</td>
            <td style="padding: 8px 12px; text-align: center;">
              <span class="stock-tag" style="background: rgba(16,185,129,0.15); color: #10b981;">สำเร็จ</span>
            </td>
            <td style="padding: 8px 12px; text-align: center;">
              <button class="btn-xs" onclick="BillsHistory.viewBillDetails(${b.bill_id})">ดูรายการ</button>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (e) {
      console.error(e);
    }
  },

  viewBillDetails: async function(billId) {
    try {
      const res = await fetch(`/api/bills/${billId}`);
      const json = await res.json();
      if (!json.success) return;

      const bill = json.data;
      POS.showReceipt({
        bill_id: bill.bill_id,
        date: new Date(parseInt(bill.date) * 1000).toLocaleString('th-TH'),
        total: bill.result,
        discount: 0,
        net_amount: bill.result,
        received_amount: bill.result,
        change: 0,
        items: bill.items.map(i => ({
          name: i.product_name || i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price
        }))
      });
    } catch (e) {
      showToast('ไม่สามารถโหลดรายละเอียดบิลได้', 'error');
    }
  }
};

// ---------------------- Dashboard & Reports ----------------------
const Reports = {
  loadDashboard: async function() {
    try {
      const res = await fetch('/api/reports/dashboard');
      const json = await res.json();
      if (!json.success) return;

      const d = json.data;
      document.getElementById('stat-total-products').innerText = Number(d.total_products).toLocaleString();
      document.getElementById('stat-low-stock').innerText = Number(d.low_stock_count).toLocaleString();
      document.getElementById('stat-today-bills').innerText = Number(d.today_bills_count).toLocaleString();
      document.getElementById('stat-today-sales').innerText = `฿${Number(d.today_sales).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      document.getElementById('stat-today-profit').innerText = `฿${Number(d.today_profit).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    } catch (e) {
      console.error(e);
    }
  }
};

// ---------------------- Promotion Admin Logic (Matching INVapp types/promotion) ----------------------
const PromotionAdmin = {
  types: [],
  categories: [],
  activeType: null,
  allTypesCache: [],

  init: async function() {
    await this.loadCategories();
    await this.loadTypes();
  },

  loadCategories: async function() {
    if (this.categories.length > 0) return;
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success && json.data) {
        this.categories = json.data;
        const select = document.getElementById('tab-promo-cat-filter');
        if (select) {
          select.innerHTML = '<option value="">ทุกหมวดหมู่สินค้า</option>';
          this.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.category_id;
            opt.innerText = c.name;
            select.appendChild(opt);
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  loadTypes: async function() {
    const grid = document.getElementById('tab-promo-types-grid');
    const badge = document.getElementById('tab-promo-stats-badge');
    if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">กำลังโหลดข้อมูลโปรโมชั่น...</div>';

    try {
      const res = await fetch('/api/promotions/types');
      const json = await res.json();
      if (!json.success || !json.data) {
        if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดข้อมูล</div>';
        return;
      }

      this.types = json.data;
      let totalTiers = 0;
      this.types.forEach(t => totalTiers += (t.promotions ? t.promotions.length : 0));
      if (badge) badge.innerText = `${this.types.length} ประเภทสินค้าที่มีโปรโมชั่น (รวม ${totalTiers} เงื่อนไข)`;

      this.renderTypes(this.types);
    } catch (e) {
      console.error(e);
      if (grid) grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--danger);">ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</div>';
    }
  },

  renderTypes: function(typesList) {
    const grid = document.getElementById('tab-promo-types-grid');
    if (!grid) return;

    if (!typesList.length) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-dim);">ไม่พบประเภทสินค้าที่ตรงกับคำค้นหา</div>';
      return;
    }

    let html = '';
    typesList.forEach(t => {
      const resolvedImg = t.resolved_pic || '/img/products/yean_1.gif';
      const basePrice = t.sale_price ? `฿${parseFloat(t.sale_price).toFixed(2)}` : '-';

      let tiersHtml = '';
      if (t.promotions && t.promotions.length) {
        t.promotions.forEach(p => {
          const perUnit = p.limit > 0 ? (p.price / p.limit) : p.price;
          tiersHtml += `
            <div class="promo-card-tier-item">
              <span class="promo-card-tier-name">🏷️ ${p.name} (${p.limit} ชิ้น)</span>
              <span class="promo-card-tier-price">฿${p.price.toFixed(0)} <span style="font-size:0.75rem; color:#64748b; font-weight:normal;">(@฿${perUnit.toFixed(1)})</span></span>
            </div>
          `;
        });
      } else {
        tiersHtml = '<div style="font-size: 0.8rem; color: #94a3b8;">ยังไม่มีระดับโปรโมชั่น</div>';
      }

      html += `
        <div class="promo-type-card" onclick="PromotionAdmin.openTypeDetail(${t.type_id})">
          <div class="promo-card-top">
            <div class="promo-card-img-box">
              <img src="${resolvedImg}" alt="${t.name}" class="promo-card-img" onerror="this.src='/img/products/yean_1.gif'">
            </div>
            <div class="promo-card-info">
              <div class="promo-card-title" title="${t.name}">${t.name}</div>
              <div class="promo-card-meta">
                <span class="badge" style="background:#e0e7ff; color:#3730a3; padding: 2px 6px; font-weight:700;">${t.serial_id || '-'}</span>
                <span>หมวด: ${t.category_name || '-'}</span>
                <span style="color:#15803d; font-weight:700;">${basePrice}</span>
              </div>
            </div>
          </div>
          <div class="promo-card-tiers">
            ${tiersHtml}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
            <span style="font-size: 0.78rem; color: var(--text-muted);">${t.promotions ? t.promotions.length : 0} ระดับโปรโมชั่น</span>
            <button type="button" class="btn-xs" style="padding: 3px 10px; font-size: 0.8rem; font-weight: 700;">
              ⚙️ จัดการโปรโมชั่น →
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  filterTypes: function(term) {
    if (!this.types) return;
    const searchVal = (term !== undefined ? term : (document.getElementById('tab-promo-search') ? document.getElementById('tab-promo-search').value : '')).trim().toLowerCase();
    const catVal = document.getElementById('tab-promo-cat-filter') ? document.getElementById('tab-promo-cat-filter').value : '';

    const filtered = this.types.filter(t => {
      const matchName = (t.name || '').toLowerCase().includes(searchVal);
      const matchSerial = (t.serial_id || '').toLowerCase().includes(searchVal);
      const matchCat = !catVal || t.category_id == catVal;
      return (matchName || matchSerial) && matchCat;
    });

    this.renderTypes(filtered);
  },

  showTypesView: function() {
    document.getElementById('tab-promo-view-types').style.display = 'block';
    document.getElementById('tab-promo-view-detail').style.display = 'none';
    document.getElementById('tab-promo-view-picker').style.display = 'none';
    this.closeTierForm();
  },

  openTypeDetail: async function(typeId) {
    try {
      const res = await fetch(`/api/promotions/types/${typeId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        showToast('ไม่สามารถโหลดข้อมูลโปรโมชั่นได้', 'error');
        return;
      }

      this.activeType = json.data.type;
      const promotions = json.data.promotions || [];

      document.getElementById('tab-promo-view-types').style.display = 'none';
      document.getElementById('tab-promo-view-detail').style.display = 'block';
      document.getElementById('tab-promo-view-picker').style.display = 'none';
      this.closeTierForm();

      const hero = document.getElementById('tab-promo-type-hero');
      const resolvedImg = this.activeType.resolved_pic || '/img/products/yean_1.gif';
      const basePrice = this.activeType.sale_price ? parseFloat(this.activeType.sale_price).toFixed(2) : '0.00';

      hero.innerHTML = `
        <div class="promo-hero-img-box">
          <img src="${resolvedImg}" alt="${this.activeType.name}" class="promo-hero-img" onerror="this.src='/img/products/yean_1.gif'">
        </div>
        <div class="promo-hero-details">
          <h3>${this.activeType.name}</h3>
          <div class="promo-hero-meta">
            <span>รหัสนำหน้า (Serial): <b style="color: #3730a3;">${this.activeType.serial_id || '-'}</b></span>
            <span>หมวดหมู่: <b>${this.activeType.category_name || '-'}</b></span>
            <span>ราคาขายปลีกปกติ: <b style="color: #15803d; font-size: 1.05rem;">฿${basePrice}</b> / ชิ้น</span>
          </div>
        </div>
      `;

      this.renderTiersTable(promotions, parseFloat(basePrice));
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการโหลดโปรโมชั่น', 'error');
    }
  },

  renderTiersTable: function(promotions, basePrice) {
    const tbody = document.getElementById('tab-promo-tiers-tbody');
    if (!tbody) return;

    if (!promotions.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: var(--text-dim);">
            ยังไม่มีระดับโปรโมชั่นสำหรับประเภทสินค้านี้ คลิก <b>"➕ เพิ่มระดับโปรโมชั่นใหม่"</b> เพื่อเริ่มต้นสร้าง
          </td>
        </tr>
      `;
      return;
    }

    let html = '';
    promotions.forEach((p, idx) => {
      const perUnit = p.limit > 0 ? (p.price / p.limit) : p.price;
      const regularTotal = (basePrice || 0) * p.limit;
      const saveAmount = Math.max(0, regularTotal - p.price);
      const savePercent = regularTotal > 0 ? ((saveAmount / regularTotal) * 100).toFixed(1) : 0;

      html += `
        <tr style="border-bottom: 1px solid var(--border-color); height: 48px;">
          <td style="padding: 8px 14px; text-align: center; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
          <td style="padding: 8px 14px;">
            <b style="color: #b45309; font-size: 0.95rem;">${p.name}</b>
            ${p.detail ? `<div style="font-size: 0.8rem; color: var(--text-dim);">${p.detail}</div>` : ''}
          </td>
          <td style="padding: 8px 14px; text-align: center; font-weight: 700; font-size: 1rem;">${p.limit} ชิ้น</td>
          <td style="padding: 8px 14px; text-align: right; font-weight: 700; font-size: 1rem; color: #b45309;">฿${parseFloat(p.price).toFixed(2)}</td>
          <td style="padding: 8px 14px; text-align: right; color: var(--text-muted); font-size: 0.9rem;">฿${perUnit.toFixed(2)}</td>
          <td style="padding: 8px 14px; text-align: right;">
            ${saveAmount > 0 
              ? `<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">ประหยัด ฿${saveAmount.toFixed(0)} (-${savePercent}%)</span>` 
              : '<span style="color: var(--text-dim);">-</span>'}
          </td>
          <td style="padding: 8px 14px; text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button type="button" class="btn-xs" style="padding: 4px 10px;" onclick='PromotionAdmin.openTierForm(${JSON.stringify(p)})'>
                ✏️ แก้ไข
              </button>
              <button type="button" class="btn-xs danger" style="padding: 4px 10px;" onclick="PromotionAdmin.deleteTier(${p.type_id}, ${p.id})">
                🗑️ ลบ
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    tbody.innerHTML = html;
  },

  openTierForm: function(tierData) {
    const card = document.getElementById('tab-promo-tier-form-card');
    const title = document.getElementById('tab-promo-tier-form-title');
    const idInput = document.getElementById('tab-tier-id');
    const typeIdInput = document.getElementById('tab-tier-type-id');
    const nameInput = document.getElementById('tab-tier-name');
    const limitInput = document.getElementById('tab-tier-limit');
    const priceInput = document.getElementById('tab-tier-price');
    const detailInput = document.getElementById('tab-tier-detail');

    if (!card) return;

    if (tierData) {
      if (title) title.innerText = `✏️ แก้ไขระดับโปรโมชั่น: ${tierData.name}`;
      if (idInput) idInput.value = tierData.id;
      if (typeIdInput) typeIdInput.value = tierData.type_id;
      if (nameInput) nameInput.value = tierData.name || '';
      if (limitInput) limitInput.value = tierData.limit || '';
      if (priceInput) priceInput.value = tierData.price || '';
      if (detailInput) detailInput.value = tierData.detail || '';
    } else {
      if (title) title.innerText = `➕ เพิ่มระดับโปรโมชั่นใหม่สำหรับ: ${this.activeType ? this.activeType.name : ''}`;
      if (idInput) idInput.value = '';
      if (typeIdInput) typeIdInput.value = this.activeType ? this.activeType.type_id : '';
      if (nameInput) nameInput.value = '';
      if (limitInput) limitInput.value = '';
      if (priceInput) priceInput.value = '';
      if (detailInput) detailInput.value = '';
    }

    card.style.display = 'block';
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 60);
  },

  closeTierForm: function() {
    const card = document.getElementById('tab-promo-tier-form-card');
    if (card) card.style.display = 'none';
  },

  saveTier: async function() {
    const id = document.getElementById('tab-tier-id').value;
    const typeId = document.getElementById('tab-tier-type-id').value;
    const name = document.getElementById('tab-tier-name').value.trim();
    const limit = parseInt(document.getElementById('tab-tier-limit').value);
    const price = parseFloat(document.getElementById('tab-tier-price').value);
    const detail = document.getElementById('tab-tier-detail').value.trim();

    if (!name || isNaN(limit) || limit <= 0 || isNaN(price) || price < 0) {
      showToast('กรุณากรอกชื่อโปรโมชั่น, จำนวนชิ้น และราคาให้ถูกต้อง', 'warning');
      return;
    }

    const payload = {
      type_id: typeId,
      promotion_id: this.activeType ? (this.activeType.serial_id || '') : '',
      name,
      limit,
      price,
      detail
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/promotions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/promotions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'บันทึกโปรโมชั่นสำเร็จ', 'success');
        this.closeTierForm();
        await this.openTypeDetail(typeId);
        this.loadTypes();
      } else {
        showToast(json.message || 'บันทึกไม่สำเร็จ', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการบันทึกโปรโมชั่น', 'error');
    }
  },

  deleteTier: async function(typeId, promoId) {
    if (!confirm('คุณต้องการลบระดับโปรโมชั่นนี้ใช่หรือไม่?')) return;

    try {
      const res = await fetch(`/api/promotions/${promoId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ลบโปรโมชั่นเรียบร้อยแล้ว', 'info');
        await this.openTypeDetail(typeId);
        this.loadTypes();
      } else {
        showToast(json.message || 'ลบไม่สำเร็จ', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการลบโปรโมชั่น', 'error');
    }
  },

  openTypePicker: async function() {
    document.getElementById('tab-promo-view-types').style.display = 'none';
    document.getElementById('tab-promo-view-detail').style.display = 'none';
    document.getElementById('tab-promo-view-picker').style.display = 'block';

    const grid = document.getElementById('tab-promo-picker-grid');
    grid.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">กำลังโหลดรายการสินค้า...</div>';

    try {
      const res = await fetch('/api/types');
      const json = await res.json();
      this.allTypesCache = (json && json.success) ? json.data : [];
      this.renderPickerTypes(this.allTypesCache);
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดรายการ</div>';
    }
  },

  renderPickerTypes: function(typesList) {
    const grid = document.getElementById('tab-promo-picker-grid');
    if (!grid) return;

    if (!typesList.length) {
      grid.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">ไม่พบประเภทสินค้าที่ค้นหา</div>';
      return;
    }

    let html = '';
    typesList.forEach(t => {
      const resolvedImg = t.resolved_pic || '/img/products/yean_1.gif';
      const basePrice = t.sale_price ? `฿${parseFloat(t.sale_price).toFixed(2)}` : '-';

      html += `
        <div class="promo-type-card" onclick="PromotionAdmin.openTypeDetail(${t.type_id}); PromotionAdmin.openTierForm(null);">
          <div class="promo-card-top">
            <div class="promo-card-img-box">
              <img src="${resolvedImg}" alt="${t.name}" class="promo-card-img" onerror="this.src='/img/products/yean_1.gif'">
            </div>
            <div class="promo-card-info">
              <div class="promo-card-title">${t.name}</div>
              <div class="promo-card-meta">
                <span class="badge" style="background:#e0e7ff; color:#3730a3; padding: 2px 6px; font-weight:700;">${t.serial_id || '-'}</span>
                <span>หมวด: ${t.category_name || '-'}</span>
                <span style="color:#15803d; font-weight:700;">${basePrice}</span>
              </div>
            </div>
          </div>
          <button type="button" class="btn-checkout" style="height: 32px; font-size: 0.82rem; margin-top: 4px;">
            ➕ สร้างโปรโมชั่นให้สินค้านี้
          </button>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  filterPickerTypes: function(term) {
    if (!this.allTypesCache) return;
    const query = (term || '').trim().toLowerCase();
    const filtered = this.allTypesCache.filter(t => 
      (t.name || '').toLowerCase().includes(query) ||
      (t.serial_id || '').toLowerCase().includes(query) ||
      (t.category_name || '').toLowerCase().includes(query)
    );
    this.renderPickerTypes(filtered);
  }
};

