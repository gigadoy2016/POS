// ==========================================================================
// INVENTORY, BILLS HISTORY & REPORTS LOGIC
// ==========================================================================

const Inventory = {
  currentView: 'categories', // 'categories' | 'types' | 'items' | 'all_types' | 'all_items' | 'low_stock' | 'search'
  selectedCategory: null,
  selectedType: null,
  searchQuery: '',
  searchDebounceTimer: null,

  allProductsOffset: 0,
  allProductsLimit: 25,
  allProductsTotal: 0,

  categoriesCache: [],
  stocksCache: [],

  currentEditImageBase64: null,
  currentEditImageRemoved: false,

  currentTypeImageBase64: null,
  currentTypeImageRemoved: false,

  allTypesCache: [],
  selectedTypeSerial: '',

  // --------------------------------------------------------------------------
  // INITIALIZATION & BREADCRUMBS
  // --------------------------------------------------------------------------
  init: async function() {
    this.searchQuery = '';
    const searchInput = document.getElementById('inv-search-input');
    if (searchInput) searchInput.value = '';

    // Preload categories and stocks cache in background
    this.loadCategoriesCache();
    this.loadStocksCache();

    // Default to Level 1: Category list matching user request
    await this.showCategoriesView();
  },

  loadProducts: function() {
    // Backward compatibility hook: reload current view or init
    if (this.currentView === 'all_items') {
      this.showAllProductsView();
    } else if (this.currentView === 'low_stock') {
      this.showLowStockView();
    } else if (this.currentView === 'types' && this.selectedCategory) {
      this.selectCategory(this.selectedCategory.category_id);
    } else if (this.currentView === 'items' && this.selectedType) {
      this.selectType(this.selectedType.type_id);
    } else {
      this.showCategoriesView();
    }
  },

  loadCategoriesCache: async function() {
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success && json.data) {
        this.categoriesCache = json.data;
      }
    } catch (e) {
      console.error('Failed to cache categories', e);
    }
  },

  loadStocksCache: async function() {
    try {
      const res = await fetch('/api/stocks');
      const json = await res.json();
      if (json.success && json.data) {
        this.stocksCache = json.data;
      }
    } catch (e) {
      console.error('Failed to cache stocks', e);
    }
  },

  setActiveSidebarBtn: function(btnId) {
    document.querySelectorAll('.inv-sidebar-btn').forEach(btn => {
      if (btn.classList.contains('active')) btn.classList.remove('active');
    });
    const el = document.getElementById(btnId);
    if (el) el.classList.add('active');
  },

  renderBreadcrumbs: function() {
    const nav = document.getElementById('inv-breadcrumbs');
    if (!nav) return;

    let html = '';
    const homeItem = `<span class="inv-breadcrumb-item clickable" onclick="Inventory.showCategoriesView()" title="ไปหน้ารวมประเภทสินค้า">📁 ประเภทสินค้า (Category)</span>`;

    if (this.currentView === 'categories') {
      html = `<span class="inv-breadcrumb-item current">📁 ประเภทสินค้าทั้งหมด (Categories)</span>`;
    } else if (this.currentView === 'types') {
      const catName = this.selectedCategory ? this.selectedCategory.name : 'หมวดหมู่';
      const catSerial = this.selectedCategory && this.selectedCategory.serial_id ? ` (${this.selectedCategory.serial_id})` : '';
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">📂 ${catName}${catSerial}</span>
      `;
    } else if (this.currentView === 'items') {
      const catName = this.selectedCategory ? this.selectedCategory.name : 'หมวดหมู่';
      const catId = this.selectedCategory ? this.selectedCategory.category_id : '';
      const typeName = this.selectedType ? this.selectedType.name : 'Type';
      const typeSerial = this.selectedType && this.selectedType.serial_id ? ` (${this.selectedType.serial_id})` : '';
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item clickable" onclick="Inventory.selectCategory(${catId})" title="กลับไปหน้ารวม Type ในหมวดนี้">📂 ${catName}</span>
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">🏷️ ${typeName}${typeSerial}</span>
      `;
    } else if (this.currentView === 'all_types') {
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">📂 Type สินค้าทั้งหมด (All Types)</span>
      `;
    } else if (this.currentView === 'all_items') {
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">📦 สินค้าทั้งหมด (All Items)</span>
      `;
    } else if (this.currentView === 'low_stock') {
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current" style="color: var(--danger);">⚠️ สินค้าใกล้หมด (Safety Stock Alert)</span>
      `;
    } else if (this.currentView === 'stocks') {
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">🏬 สินค้าในคลังสินค้า & ชั้นวาง (Shelves / Stocks)</span>
      `;
    } else if (this.currentView === 'stock_detail') {
      const sName = this.currentStock ? this.currentStock.stock_name : (this.currentStockId || 'ชั้นวาง');
      const sDetail = this.currentStock && this.currentStock.detail ? ` (${this.currentStock.detail})` : '';
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item clickable" onclick="Inventory.showStocksView()" title="กลับไปหน้ารวมชั้นวาง">🏬 สินค้าในคลังสินค้า</span>
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">📦 ชั้นวาง: ${sName}${sDetail}</span>
      `;
    } else if (this.currentView === 'search') {
      html = `
        ${homeItem}
        <span style="color: var(--text-dim); font-size: 0.8rem;">❯</span>
        <span class="inv-breadcrumb-item current">🔍 ค้นหา: "${this.searchQuery}"</span>
      `;
    }

    nav.innerHTML = html;
  },

  // --------------------------------------------------------------------------
  // LEVEL 1: CATEGORIES VIEW (matching INVapp /categories screenshot)
  // --------------------------------------------------------------------------
  showCategoriesView: async function() {
    this.currentView = 'categories';
    this.selectedCategory = null;
    this.selectedType = null;
    this.setActiveSidebarBtn('btn-side-categories');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>📋</span> แสดงประเภทรายการสินค้า (Category List)
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            เลือกหมวดหมู่สินค้าเพื่อเจาะจงดู Type ชนิดสินค้า และรายการเบอร์สีภายใน
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #f59e0b; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openCategoryModal()">
            🏷️ เพิ่มหมวดหมู่ (Category)
          </button>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดหมวดหมู่สินค้า...
        </div>
      `;
    }

    try {
      const res = await fetch('/api/categories');
      const json = await res.json();

      if (!json.success || !json.data || !json.data.length) {
        if (wrapper) {
          wrapper.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
              ยังไม่มีหมวดหมู่สินค้าในระบบ <br>
              <button class="btn-xs" style="margin-top: 12px;" onclick="Inventory.openCategoryModal()">+ เพิ่มหมวดหมู่แรก</button>
            </div>
          `;
        }
        return;
      }

      this.categoriesCache = json.data;

      let rowsHtml = '';
      json.data.forEach(c => {
        const imgIcon = c.resolved_pic ? `<img src="${c.resolved_pic}" alt="${c.name}" style="width: 28px; height: 28px; object-fit: contain; border-radius: 4px;">` : `<span style="font-size: 1.3rem;">📁</span>`;

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 46px;">
            <td style="padding: 8px 14px; text-align: center; width: 80px;">
              <span style="font-family: 'JetBrains Mono'; font-weight: 800; font-size: 1rem; color: #f59e0b; background: rgba(245, 158, 11, 0.12); padding: 2px 10px; border-radius: 4px; display: inline-block;">
                ${c.serial_id || '-'}
              </span>
            </td>
            <td style="padding: 8px 14px; font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${imgIcon}
                </div>
                <a href="javascript:void(0)" onclick="Inventory.selectCategory(${c.category_id})" style="color: #38bdf8; text-decoration: underline; font-size: 1rem; font-weight: 700;" title="คลิกเพื่อดู Type ในหมวด ${c.name}">
                  ${c.name}
                </a>
              </div>
            </td>
            <td style="padding: 8px 14px; text-align: center; width: 140px;">
              <span class="stock-tag" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; font-weight: 700; cursor: pointer;" onclick="Inventory.selectCategory(${c.category_id})" title="คลิกเพื่อเปิดดู Type ทั้งหมด">
                📂 ${c.type_count || 0} Types ❯
              </span>
            </td>
            <td style="padding: 8px 14px; text-align: center; width: 140px;">
              <span class="stock-tag" style="background: var(--bg-surface-elevated); color: var(--text-main); font-weight: 600;">
                ${c.product_count || 0} รายการ
              </span>
            </td>
            <td style="padding: 8px 14px; text-align: center; width: 180px;">
              <div style="display: flex; gap: 6px; justify-content: center;">
                <button type="button" class="btn-xs" style="padding: 5px 12px; font-weight: 600;" onclick="Inventory.selectCategory(${c.category_id})" title="เปิดดูรายการ Types">
                  📂 ดู Types
                </button>
                <button type="button" class="btn-xs" style="padding: 5px 12px; background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600;" onclick="Inventory.openTypeModal(${c.category_id})" title="เพิ่ม Type ใหม่ในหมวดนี้">
                  ➕ เพิ่ม Type
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 80px; text-align: center;">รหัส</th>
                <th style="text-align: left;">ชื่อประเภท (หมวดหมู่สินค้า)</th>
                <th style="width: 140px; text-align: center;">จำนวน Type</th>
                <th style="width: 140px; text-align: center;">สินค้าทั้งหมด</th>
                <th style="width: 180px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดข้อมูลหมวดหมู่</div>`;
      }
    }
  },

  // --------------------------------------------------------------------------
  // LEVEL 2: TYPES UNDER CATEGORY VIEW (Category > Type)
  // --------------------------------------------------------------------------
  selectCategory: async function(catId) {
    if (!catId) return;

    let cat = this.categoriesCache.find(c => c.category_id == catId);
    if (!cat) {
      try {
        const res = await fetch('/api/categories');
        const json = await res.json();
        if (json.success) {
          this.categoriesCache = json.data;
          cat = this.categoriesCache.find(c => c.category_id == catId);
        }
      } catch (e) {}
    }

    this.selectedCategory = cat || { category_id: catId, name: 'หมวดหมู่', serial_id: '' };
    this.selectedType = null;
    this.currentView = 'types';
    this.setActiveSidebarBtn('btn-side-categories');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <button type="button" class="btn-xs" style="padding: 6px 14px; font-weight: 600;" onclick="Inventory.showCategoriesView()">
            ⬅️ กลับไปหมวดหมู่
          </button>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main);">
                หมวดหมู่: <span style="color: #f59e0b;">${this.selectedCategory.name}</span>
              </h3>
              <span style="font-family: 'JetBrains Mono'; font-weight: 800; font-size: 0.9rem; color: #f59e0b; background: rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 4px;">
                รหัส ${this.selectedCategory.serial_id || '-'}
              </span>
            </div>
            <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: var(--text-dim);">
              คลิกที่ชื่อ Type เพื่อดูรายการเบอร์สีสินค้าภายใน • หรือคลิก "แก้ไข Type" เพื่อดูต้นทุนและปรับราคา
            </p>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openTypeModal(${this.selectedCategory.category_id})">
            ➕ เพิ่ม Type ในหมวดนี้
          </button>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลด Type ในหมวด ${this.selectedCategory.name}...
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/types?category_id=${catId}`);
      const json = await res.json();

      if (!json.success || !json.data || !json.data.length) {
        if (wrapper) {
          wrapper.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">📂</div>
              <div style="font-weight: 600; font-size: 1rem; color: var(--text-main);">ยังไม่มี Type (ชนิดสินค้า) ในหมวด "${this.selectedCategory.name}"</div>
              <p style="font-size: 0.85rem; margin: 6px 0 16px 0;">เพิ่ม Type สินค้าเพื่อจัดกลุ่มรายการเบอร์สี</p>
              <button class="btn-checkout" style="padding: 8px 24px; font-size: 0.92rem;" onclick="Inventory.openTypeModal(${this.selectedCategory.category_id})">
                ➕ เพิ่ม Type แรกในหมวดนี้
              </button>
            </div>
          `;
        }
        return;
      }

      let rowsHtml = '';
      json.data.forEach(t => {
        const imgSrc = t.resolved_pic || t.pic;

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 50px;">
            <td style="padding: 6px 10px; width: 56px; text-align: center;">
              <div style="width: 42px; height: 42px; border-radius: 6px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                ${imgSrc ? `<img src="${imgSrc}" alt="${t.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display: none; font-size: 16px;">📦</span>` : `<span style="font-size: 16px; opacity: 0.6;">📦</span>`}
              </div>
            </td>
            <td style="padding: 8px 12px; width: 90px; text-align: center;">
              <span style="font-family: 'JetBrains Mono'; font-weight: 700; color: #38bdf8; font-size: 0.95rem; background: rgba(56, 189, 248, 0.1); padding: 3px 8px; border-radius: 4px; display: inline-block;">
                ${t.serial_id || '-'}
              </span>
            </td>
            <td style="padding: 8px 12px;">
              <div>
                <a href="javascript:void(0)" onclick="Inventory.selectType(${t.type_id})" style="font-weight: 700; font-size: 0.95rem; color: #38bdf8; text-decoration: underline;" title="คลิกเพื่อดูสินค้าเบอร์สีทั้งหมดใน Type นี้">
                  ${t.name}
                </a>
                ${t.eng_name ? `<div style="font-size: 0.78rem; color: var(--text-dim);">${t.eng_name}</div>` : ''}
              </div>
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 100px;">
              ฿${(t.cost || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 100px;">
              ฿${(t.sale_price || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 130px;">
              <span class="stock-tag" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-weight: 700; cursor: pointer;" onclick="Inventory.selectType(${t.type_id})" title="คลิกเพื่อดูรายการสินค้าทั้งหมด">
                📦 ${t.product_count || 0} เบอร์สี ❯
              </span>
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 230px;">
              <div style="display: flex; gap: 6px; justify-content: center; flex-wrap: wrap;">
                <button type="button" class="btn-xs" style="font-weight: 600;" onclick="Inventory.selectType(${t.type_id})" title="เปิดดูรายการเบอร์สี">
                  📦 ดูสินค้า
                </button>
                <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 600;" onclick="Inventory.openEditTypeModal(${t.type_id})" title="แก้ไข Type / ดูต้นทุน / แก้รูปภาพ">
                  ✏️ แก้ไข Type
                </button>
                <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-weight: 600;" onclick="Inventory.openAddProductModalForType(${t.type_id})" title="เพิ่มเบอร์สีใหม่ใน Type นี้">
                  ➕ เบอร์สี
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 56px; text-align: center;">รูป</th>
                <th style="width: 90px; text-align: center;">รหัส Type</th>
                <th style="text-align: left;">ชื่อ Type สินค้า</th>
                <th style="width: 100px; text-align: right;">ราคาทุน</th>
                <th style="width: 100px; text-align: right;">ราคาขาย</th>
                <th style="width: 130px; text-align: center;">จำนวนเบอร์สี</th>
                <th style="width: 230px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดรายการ Type</div>`;
      }
    }
  },

  // --------------------------------------------------------------------------
  // LEVEL 3: ITEMS UNDER TYPE VIEW (Category > Type > Item)
  // --------------------------------------------------------------------------
  selectType: async function(typeId) {
    if (!typeId) return;

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดรายการสินค้าเบอร์สี...
        </div>
      `;
    }

    try {
      const [typeRes, prodsRes] = await Promise.all([
        fetch(`/api/types/${typeId}`).then(r => r.json()),
        fetch(`/api/types/${typeId}/products`).then(r => r.json())
      ]);

      if (!typeRes.success || !typeRes.data) {
        if (wrapper) wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">ไม่พบข้อมูล Type นี้</div>`;
        return;
      }

      const t = typeRes.data;
      this.selectedType = t;

      // Find or load parent category to maintain full breadcrumb
      if (!this.selectedCategory || this.selectedCategory.category_id != t.category_id) {
        const cat = this.categoriesCache.find(c => c.category_id == t.category_id);
        if (cat) {
          this.selectedCategory = cat;
        } else {
          this.selectedCategory = {
            category_id: t.category_id,
            name: t.category_name || 'หมวดหมู่',
            serial_id: ''
          };
        }
      }

      this.currentView = 'items';
      this.setActiveSidebarBtn('btn-side-categories');
      this.renderBreadcrumbs();

      const products = (prodsRes.success && prodsRes.data) ? prodsRes.data : [];
      const cleanDetail = t.detail ? t.detail.replace(/<[^>]*>?/gm, '').trim() : '';

      if (banner) {
        banner.innerHTML = `
          <div style="display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; flex: 1;">
            <button type="button" class="btn-xs" style="padding: 6px 14px; font-weight: 600;" onclick="Inventory.selectCategory(${t.category_id})">
              ⬅️ กลับไป Type ในหมวด
            </button>
            <div style="flex: 1; min-width: 260px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main);">
                  Type: <span style="color: #38bdf8;">${t.name}</span>
                </h3>
                <span style="font-family: 'JetBrains Mono'; font-weight: 800; font-size: 0.9rem; color: #38bdf8; background: rgba(56, 189, 248, 0.15); padding: 2px 8px; border-radius: 4px;">
                  ${t.serial_id || '-'}
                </span>
                <span style="font-size: 0.85rem; color: var(--text-muted);">
                  • รวม <b>${products.length}</b> รายการเบอร์สี
                </span>
              </div>
              ${cleanDetail ? `
                <div style="margin-top: 5px; font-size: 0.8rem; color: #a78bfa; background: rgba(167, 139, 250, 0.12); padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(167, 139, 250, 0.25);">
                  <span>📝</span> <b>บันทึกต้นทุน / รายละเอียด:</b> <span>${cleanDetail}</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openAddProductModalForType(${t.type_id})">
              ➕ เพิ่มเบอร์สีใหม่ใน Type นี้
            </button>
            <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #f59e0b; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openEditTypeModal(${t.type_id})">
              ✏️ แก้ไข Type (รูป/ต้นทุน)
            </button>
          </div>
        `;
      }

      if (!products.length) {
        if (wrapper) {
          wrapper.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">📦</div>
              <div style="font-weight: 600; font-size: 1rem; color: var(--text-main);">ยังไม่มีรายการสินค้า/เบอร์สี ใน Type "${t.name}"</div>
              <p style="font-size: 0.85rem; margin: 6px 0 16px 0;">เพิ่มรหัสเบอร์สีแรกของ Type นี้</p>
              <button class="btn-checkout" style="padding: 8px 24px; font-size: 0.92rem;" onclick="Inventory.openAddProductModalForType(${t.type_id})">
                ➕ เพิ่มเบอร์สีแรกใน Type นี้
              </button>
            </div>
          `;
        }
        return;
      }

      let rowsHtml = '';
      products.forEach(p => {
        const isLow = p.quantity <= (p.limit_min || 5);
        const imgSrc = p.resolved_pic || p.product_pic || t.resolved_pic || t.pic;
        const itemDetail = p.detail ? p.detail.replace(/<[^>]*>?/gm, '').trim() : (p.stock_detail ? p.stock_detail.replace(/<[^>]*>?/gm, '').trim() : '');
        const effectivePrice = (p.sale_price && p.sale_price > 0) ? p.sale_price : (t.sale_price || 0);
        const effectiveCost = (p.cost && p.cost > 0) ? p.cost : (t.cost || 0);

        // Pre-fill effective prices for edit modal if product price is 0
        const modalObj = Object.assign({}, p, {
          sale_price: effectivePrice,
          cost: effectiveCost,
          detail: p.detail || itemDetail
        });

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 48px;">
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--accent-primary); width: 110px;">
              ${p.product_id}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 800; color: #f59e0b; width: 85px; text-align: center;">
              <span style="background: rgba(245, 158, 11, 0.12); padding: 2px 8px; border-radius: 4px;">
                ${p.code || '-'}
              </span>
            </td>
            <td style="padding: 8px 12px; font-weight: 500;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 34px; height: 34px; min-width: 34px; border-radius: 4px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${imgSrc ? `<img src="${imgSrc}" alt="${p.product}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display: none; font-size: 14px;">📦</span>` : `<span style="font-size: 14px; opacity: 0.6;">📦</span>`}
                </div>
                <div style="font-weight: 600;">${p.product}</div>
              </div>
            </td>
            <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem; width: 140px;">
              ${p.stock_name ? `
                <button type="button" class="stock-badge-btn" onclick="event.stopPropagation(); Inventory.showStockDetailView(${p.stock_id || `'${p.stock_name}'`})" title="คลิกเพื่อดูสินค้าทั้งหมดในชั้นวาง ${p.stock_name}${p.stock_detail ? ` (${p.stock_detail})` : ''}">
                  📦 ${p.stock_name}
                </button>
              ` : `<span style="opacity: 0.4;">-</span>`}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 95px;">
              ฿${effectiveCost.toFixed(2)}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 95px;">
              ฿${effectivePrice.toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 120px;">
              <span class="stock-tag ${isLow ? 'low' : ''}" style="font-weight: 700;">
                ${p.quantity} ${p.unit || 'ชิ้น'}
              </span>
              ${isLow ? `<span style="font-size: 0.68rem; color: var(--danger); display: block; margin-top: 2px;">Min (${p.limit_min || 5})</span>` : ''}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 90px;">
              <button type="button" class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(modalObj).replace(/"/g, '&quot;')})" style="font-weight: 600;">
                ✏️ แก้ไข
              </button>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 110px; text-align: left;">รหัสสินค้า</th>
                <th style="width: 85px; text-align: center;">เบอร์สี</th>
                <th style="text-align: left;">ชื่อสินค้า</th>
                <th style="width: 140px; text-align: left;">ชั้นวาง/คลัง</th>
                <th style="width: 95px; text-align: right;">ราคาทุน</th>
                <th style="width: 95px; text-align: right;">ราคาขาย</th>
                <th style="width: 120px; text-align: center;">คงเหลือ</th>
                <th style="width: 90px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดสินค้า</div>`;
      }
    }
  },

  // --------------------------------------------------------------------------
  // SIDEBAR VIEWS: ALL TYPES, ALL PRODUCTS, LOW STOCK
  // --------------------------------------------------------------------------
  showAllTypesView: async function() {
    this.currentView = 'all_types';
    this.selectedCategory = null;
    this.selectedType = null;
    this.setActiveSidebarBtn('btn-side-all-types');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>📂</span> Type สินค้าทั้งหมด (All Product Types)
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            รายการชนิดสินค้าทั้งหมดในระบบ แยกตามหมวดหมู่ พร้อมต้นทุนและจำนวนเบอร์สี
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openTypeModal()">
            ➕ เพิ่ม Type ใหม่
          </button>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดรายการ Type ทั้งหมด...
        </div>
      `;
    }

    try {
      const res = await fetch('/api/types');
      const json = await res.json();

      if (!json.success || !json.data || !json.data.length) {
        if (wrapper) wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim);">ไม่พบข้อมูล Type</div>`;
        return;
      }

      let rowsHtml = '';
      json.data.forEach(t => {
        const imgSrc = t.resolved_pic || t.pic;
        const cleanDetail = t.detail ? t.detail.replace(/<[^>]*>?/gm, '').trim() : '';

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 50px;">
            <td style="padding: 6px 10px; width: 56px; text-align: center;">
              <div style="width: 40px; height: 40px; border-radius: 6px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; margin: 0 auto;">
                ${imgSrc ? `<img src="${imgSrc}" alt="${t.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display: none; font-size: 16px;">📦</span>` : `<span style="font-size: 16px; opacity: 0.6;">📦</span>`}
              </div>
            </td>
            <td style="padding: 8px 12px; width: 85px; text-align: center;">
              <span style="font-family: 'JetBrains Mono'; font-weight: 700; color: #38bdf8; font-size: 0.92rem; background: rgba(56, 189, 248, 0.1); padding: 3px 8px; border-radius: 4px; display: inline-block;">
                ${t.serial_id || '-'}
              </span>
            </td>
            <td style="padding: 8px 12px;">
              <div>
                <a href="javascript:void(0)" onclick="Inventory.selectType(${t.type_id})" style="font-weight: 700; font-size: 0.95rem; color: #38bdf8; text-decoration: underline;" title="คลิกเพื่อดูสินค้า">
                  ${t.name}
                </a>
                <div style="font-size: 0.78rem; color: var(--text-dim);">
                  หมวด: <a href="javascript:void(0)" onclick="Inventory.selectCategory(${t.category_id})" style="color: #f59e0b; text-decoration: underline;">${t.category_name || '-'}</a>
                </div>
              </div>
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 95px;">
              ฿${(t.cost || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 95px;">
              ฿${(t.sale_price || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 120px;">
              <span class="stock-tag" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-weight: 700; cursor: pointer;" onclick="Inventory.selectType(${t.type_id})">
                📦 ${t.product_count || 0} เบอร์สี
              </span>
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 190px;">
              <div style="display: flex; gap: 6px; justify-content: center;">
                <button type="button" class="btn-xs" style="font-weight: 600;" onclick="Inventory.selectType(${t.type_id})">
                  📦 ดูสินค้า
                </button>
                <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 600;" onclick="Inventory.openEditTypeModal(${t.type_id})">
                  ✏️ แก้ไข
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 56px; text-align: center;">รูป</th>
                <th style="width: 85px; text-align: center;">รหัส Type</th>
                <th style="text-align: left;">ชื่อ Type / หมวดหมู่</th>
                <th style="width: 95px; text-align: right;">ราคาทุน</th>
                <th style="width: 95px; text-align: right;">ราคาขาย</th>
                <th style="width: 120px; text-align: center;">จำนวนเบอร์สี</th>
                <th style="width: 190px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลด Type ทั้งหมด</div>`;
      }
    }
  },

  showAllProductsView: async function() {
    this.currentView = 'all_items';
    this.selectedCategory = null;
    this.selectedType = null;
    this.setActiveSidebarBtn('btn-side-all-products');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>📦</span> รายการสินค้าทั้งหมดในคลัง (All Products)
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            แสดงรายการสินค้าทุกเบอร์สี เรียงตามรหัสสินค้า พร้อมจำนวนคงเหลือและราคา
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 6px 14px;" onclick="Inventory.openAddProductModal()">
            ➕ เพิ่มสินค้าใหม่ (Item)
          </button>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดรายการสินค้าทั้งหมด...
        </div>
      `;
    }

    try {
      const url = `/api/products?limit=${this.allProductsLimit}&offset=${this.allProductsOffset}`;
      const res = await fetch(url);
      const json = await res.json();

      if (!json.success || !json.data || !json.data.length) {
        if (wrapper) wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-dim);">ไม่พบรายการสินค้า</div>`;
        if (pagination) pagination.style.display = 'none';
        return;
      }

      let rowsHtml = '';
      json.data.forEach(p => {
        const isLow = p.quantity <= (p.limit_min || 5);
        const imgSrc = p.resolved_pic || p.product_pic || p.type_pic;
        const cleanDetail = p.detail ? p.detail.replace(/<[^>]*>?/gm, '').trim() : '';

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 48px;">
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--accent-primary); width: 120px;">
              ${p.product_id}
            </td>
            <td style="padding: 8px 12px; font-weight: 500;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${imgSrc ? `<img src="${imgSrc}" alt="${p.product}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"><span style="display: none; font-size: 14px;">📦</span>` : `<span style="font-size: 14px; opacity: 0.6;">📦</span>`}
                </div>
                <div style="font-weight: 600;">${p.product}</div>
              </div>
            </td>
            <td style="padding: 8px 12px; width: 120px;">
              ${p.stock_name ? `
                <button type="button" class="stock-badge-btn" onclick="event.stopPropagation(); Inventory.showStockDetailView(${p.stock_id || `'${p.stock_name}'`})" title="คลิกดูสินค้าในชั้นวาง ${p.stock_name}${p.stock_detail ? ` (${p.stock_detail})` : ''}">
                  📦 ${p.stock_name}
                </button>
              ` : `<span style="opacity: 0.4;">-</span>`}
            </td>
            <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem; width: 180px;">
              <div>
                <a href="javascript:void(0)" onclick="Inventory.selectCategory(${p.category_id})" style="color: #f59e0b; text-decoration: underline;">${p.category_name || '-'}</a>
                / 
                <a href="javascript:void(0)" onclick="Inventory.selectType(${p.type_id})" style="color: #38bdf8; text-decoration: underline; font-weight: 600;" title="คลิกเพื่อดู Type">${p.type_name || '-'}</a>
              </div>
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 90px;">
              ฿${(p.cost || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 90px;">
              ฿${(p.sale_price || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 120px;">
              <span class="stock-tag ${isLow ? 'low' : ''}" style="font-weight: 700;">
                ${p.quantity} ${p.unit || 'ชิ้น'}
              </span>
              ${isLow ? `<span style="font-size: 0.68rem; color: var(--danger); display: block;">ต่ำกว่า Min (${p.limit_min || 5})</span>` : ''}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 85px;">
              <button type="button" class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" style="font-weight: 600;">
                ✏️ แก้ไข
              </button>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 110px; text-align: left;">รหัสสินค้า</th>
                <th style="text-align: left;">ชื่อสินค้า</th>
                <th style="width: 120px; text-align: left;">ชั้นวาง/คลัง</th>
                <th style="width: 180px; text-align: left;">หมวดหมู่ / Type</th>
                <th style="width: 90px; text-align: right;">ราคาทุน</th>
                <th style="width: 90px; text-align: right;">ราคาขาย</th>
                <th style="width: 120px; text-align: center;">คงเหลือ</th>
                <th style="width: 85px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }

      if (pagination) {
        pagination.style.display = 'flex';
        document.getElementById('inv-page-info').innerText = `แสดงรายการที่ ${this.allProductsOffset + 1} - ${this.allProductsOffset + json.data.length}`;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดรายการสินค้า</div>`;
      }
    }
  },

  nextPage: function() {
    this.allProductsOffset += this.allProductsLimit;
    this.showAllProductsView();
  },

  prevPage: function() {
    if (this.allProductsOffset >= this.allProductsLimit) {
      this.allProductsOffset -= this.allProductsLimit;
      this.showAllProductsView();
    }
  },

  showLowStockView: async function() {
    this.currentView = 'low_stock';
    this.selectedCategory = null;
    this.selectedType = null;
    this.setActiveSidebarBtn('btn-side-low-stock');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--danger); display: flex; align-items: center; gap: 8px;">
            <span>⚠️</span> รายการสินค้าใกล้หมด (Safety Stock Alert)
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            รายการสินค้าที่จำนวนคงเหลือต่ำกว่าหรือเท่ากับจุดเตือนสต็อกขั้นต่ำ (Safety Min)
          </p>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังตรวจสอบรายการสินค้าใกล้หมด...
        </div>
      `;
    }

    try {
      const res = await fetch('/api/products?low_stock=true&limit=100');
      const json = await res.json();

      if (!json.success || !json.data || !json.data.length) {
        if (wrapper) {
          wrapper.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: #10b981;">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">✅</div>
              <div style="font-weight: 700; font-size: 1.05rem;">สต็อกสินค้าทุกรายการอยู่ในระดับปลอดภัย</div>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-top: 4px;">ไม่มีสินค้าที่ต่ำกว่าจุดเตือน Safety Min</p>
            </div>
          `;
        }
        return;
      }

      let rowsHtml = '';
      json.data.forEach(p => {
        const imgSrc = p.resolved_pic || p.product_pic || p.type_pic;

        rowsHtml += `
          <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 48px; background: rgba(239, 68, 68, 0.03);">
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--danger); width: 120px;">
              ${p.product_id}
            </td>
            <td style="padding: 8px 12px; font-weight: 600;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  ${imgSrc ? `<img src="${imgSrc}" alt="${p.product}" style="width: 100%; height: 100%; object-fit: contain;">` : `<span>📦</span>`}
                </div>
                <span>${p.product}</span>
              </div>
            </td>
            <td style="padding: 8px 12px; width: 120px;">
              ${p.stock_name ? `
                <button type="button" class="stock-badge-btn" onclick="event.stopPropagation(); Inventory.showStockDetailView(${p.stock_id || `'${p.stock_name}'`})" title="คลิกดูสินค้าในชั้นวาง ${p.stock_name}${p.stock_detail ? ` (${p.stock_detail})` : ''}">
                  📦 ${p.stock_name}
                </button>
              ` : `<span style="opacity: 0.4;">-</span>`}
            </td>
            <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem; width: 180px;">
              <div>${p.category_name || '-'} / <a href="javascript:void(0)" onclick="Inventory.selectType(${p.type_id})" style="color: #38bdf8; text-decoration: underline;">${p.type_name || '-'}</a></div>
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 90px;">
              ฿${(p.cost || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 90px;">
              ฿${(p.sale_price || 0).toFixed(2)}
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 130px;">
              <span class="stock-tag low" style="font-weight: 800; font-size: 0.95rem;">
                ${p.quantity} ${p.unit || 'ชิ้น'}
              </span>
              <span style="font-size: 0.72rem; color: var(--danger); display: block; margin-top: 2px;">
                จุดเตือนต่ำสุด: ${p.limit_min || 5}
              </span>
            </td>
            <td style="padding: 8px 12px; text-align: center; width: 85px;">
              <button type="button" class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" style="font-weight: 600;">
                ✏️ แก้ไข
              </button>
            </td>
          </tr>
        `;
      });

      if (wrapper) {
        wrapper.innerHTML = `
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface-elevated);">
                <th style="width: 110px; text-align: left;">รหัสสินค้า</th>
                <th style="text-align: left;">ชื่อสินค้า</th>
                <th style="width: 120px; text-align: left;">ชั้นวาง/คลัง</th>
                <th style="width: 180px; text-align: left;">หมวดหมู่ / Type</th>
                <th style="width: 90px; text-align: right;">ราคาทุน</th>
                <th style="width: 90px; text-align: right;">ราคาขาย</th>
                <th style="width: 130px; text-align: center;">คงเหลือ / Safety Min</th>
                <th style="width: 85px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดรายการสินค้าใกล้หมด</div>`;
      }
    }
  },

  // --------------------------------------------------------------------------
  // SEARCH CONTROLLER (Real-time across Hierarchy)
  // --------------------------------------------------------------------------
  onSearchInput: function(q) {
    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
    this.searchDebounceTimer = setTimeout(() => {
      this.executeSearch(q);
    }, 280);
  },

  executeSearch: async function(q) {
    const cleanQ = (q || '').trim();
    if (!cleanQ) {
      // Revert back to the appropriate view
      if (this.selectedType) {
        this.selectType(this.selectedType.type_id);
      } else if (this.selectedCategory) {
        this.selectCategory(this.selectedCategory.category_id);
      } else {
        this.showCategoriesView();
      }
      return;
    }

    this.searchQuery = cleanQ;
    this.currentView = 'search';
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>🔍</span> ผลการค้นหาสำหรับ: <span style="color: #38bdf8;">"${cleanQ}"</span>
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            ค้นหาครอบคลุมทั้งชื่อหมวดหมู่, ชื่อและรหัส Type สินค้า, และรหัสสินค้าทุกเบอร์สี
          </p>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังค้นหา "${cleanQ}"...
        </div>
      `;
    }

    try {
      const [typesRes, prodsRes] = await Promise.all([
        fetch(`/api/types?q=${encodeURIComponent(cleanQ)}`).then(r => r.json()),
        fetch(`/api/products?q=${encodeURIComponent(cleanQ)}&limit=50`).then(r => r.json())
      ]);

      const types = (typesRes.success && typesRes.data) ? typesRes.data : [];
      const prods = (prodsRes.success && prodsRes.data) ? prodsRes.data : [];

      if (!types.length && !prods.length) {
        if (wrapper) {
          wrapper.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">🔍</div>
              <div style="font-weight: 600; font-size: 1rem; color: var(--text-main);">ไม่พบผลลัพธ์ที่ตรงกับ "${cleanQ}"</div>
              <p style="font-size: 0.85rem; margin-top: 4px;">ลองค้นหาด้วยรหัสย่อ เช่น A01 หรือชื่อประเภทสินค้า เช่น ด้าย, ซิป</p>
            </div>
          `;
        }
        return;
      }

      let html = '';

      // Section 1: Types Found
      if (types.length > 0) {
        html += `
          <div style="background: var(--bg-surface-elevated); padding: 8px 14px; font-weight: 700; font-size: 0.9rem; color: #38bdf8; border-bottom: 1px solid var(--border-color); display: flex; align-items: center; gap: 6px;">
            <span>📂</span> พบในชนิดสินค้า (Types) : ${types.length} รายการ
          </div>
          <table class="order-table" style="width: 100%; margin-bottom: 16px;">
            <thead>
              <tr style="background: var(--bg-surface);">
                <th style="width: 85px; text-align: center;">รหัส Type</th>
                <th style="text-align: left;">ชื่อ Type สินค้า</th>
                <th style="text-align: left;">หมวดหมู่</th>
                <th style="width: 95px; text-align: right;">ราคาขาย</th>
                <th style="width: 130px; text-align: center;">จำนวนเบอร์สี</th>
                <th style="width: 130px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
        `;
        types.forEach(t => {
          html += `
            <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 44px;">
              <td style="padding: 6px 10px; text-align: center; font-family: 'JetBrains Mono'; font-weight: 700; color: #38bdf8;">
                ${t.serial_id || '-'}
              </td>
              <td style="padding: 6px 12px; font-weight: 700;">
                <a href="javascript:void(0)" onclick="Inventory.selectType(${t.type_id})" style="color: #38bdf8; text-decoration: underline;">${t.name}</a>
              </td>
              <td style="padding: 6px 12px; color: var(--text-muted); font-size: 0.85rem;">
                <a href="javascript:void(0)" onclick="Inventory.selectCategory(${t.category_id})" style="color: #f59e0b; text-decoration: underline;">${t.category_name || '-'}</a>
              </td>
              <td style="padding: 6px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right;">
                ฿${(t.sale_price || 0).toFixed(2)}
              </td>
              <td style="padding: 6px 12px; text-align: center;">
                <span class="stock-tag" style="cursor: pointer;" onclick="Inventory.selectType(${t.type_id})">${t.product_count || 0} เบอร์สี</span>
              </td>
              <td style="padding: 6px 12px; text-align: center;">
                <button type="button" class="btn-xs" onclick="Inventory.selectType(${t.type_id})" style="font-weight: 600;">📦 เปิดดู</button>
              </td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      // Section 2: Items Found
      if (prods.length > 0) {
        html += `
          <div style="background: var(--bg-surface-elevated); padding: 8px 14px; font-weight: 700; font-size: 0.9rem; color: #10b981; border-bottom: 1px solid var(--border-color); border-top: 1px solid var(--border-color); display: flex; align-items: center; gap: 6px;">
            <span>📦</span> พบในรายการสินค้าเบอร์สี (Items) : ${prods.length} รายการ
          </div>
          <table class="order-table" style="width: 100%;">
            <thead>
              <tr style="background: var(--bg-surface);">
                <th style="width: 110px; text-align: left;">รหัสสินค้า</th>
                <th style="width: 75px; text-align: center;">เบอร์สี</th>
                <th style="text-align: left;">ชื่อสินค้า</th>
                <th style="width: 180px; text-align: left;">หมวดหมู่ / Type</th>
                <th style="width: 90px; text-align: right;">ราคาขาย</th>
                <th style="width: 110px; text-align: center;">คงเหลือ</th>
                <th style="width: 90px; text-align: center;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
        `;
        prods.forEach(p => {
          html += `
            <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 44px;">
              <td style="padding: 6px 10px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--accent-primary);">
                ${p.product_id}
              </td>
              <td style="padding: 6px 8px; text-align: center; font-family: 'JetBrains Mono'; font-weight: 800; color: #f59e0b;">
                ${p.code || '-'}
              </td>
              <td style="padding: 6px 10px; font-weight: 500;">
                ${p.product}
              </td>
              <td style="padding: 6px 10px; color: var(--text-muted); font-size: 0.85rem;">
                ${p.category_name || '-'} / <a href="javascript:void(0)" onclick="Inventory.selectType(${p.type_id})" style="color: #38bdf8; text-decoration: underline;">${p.type_name || '-'}</a>
              </td>
              <td style="padding: 6px 10px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right;">
                ฿${(p.sale_price || 0).toFixed(2)}
              </td>
              <td style="padding: 6px 10px; text-align: center;">
                <span class="stock-tag ${p.quantity <= (p.limit_min || 5) ? 'low' : ''}">${p.quantity}</span>
              </td>
              <td style="padding: 6px 10px; text-align: center;">
                <button type="button" class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">✏️ แก้ไข</button>
              </td>
            </tr>
          `;
        });
        html += `</tbody></table>`;
      }

      if (wrapper) wrapper.innerHTML = html;
    } catch (e) {
      console.error(e);
      if (wrapper) wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการค้นหา</div>`;
    }
  },

  // --------------------------------------------------------------------------
  // STOCKS / SHELVES MANAGEMENT (ชั้นวางสินค้าในคลัง)
  // --------------------------------------------------------------------------
  showStocksView: async function() {
    this.currentView = 'stocks';
    this.selectedCategory = null;
    this.selectedType = null;
    this.setActiveSidebarBtn('btn-side-stocks');
    this.renderBreadcrumbs();

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (banner) {
      banner.innerHTML = `
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
            <span>🏬</span> สินค้าในคลังสินค้า & จัดการชั้นวาง (Shelves / Stocks)
          </h3>
          <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
            แสดงรายการชั้นวางและตำแหน่งจัดเก็บสินค้าทั้งหมด สามารถคลิกดูสินค้าคงคลังในแต่ละชั้นวางได้
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div style="position: relative; width: 220px;">
            <input type="text" id="stocks-search-input" class="form-input" style="width: 100%; height: 36px; font-size: 0.82rem;" placeholder="🔍 ค้นหาชั้นวาง (เช่น E01, a01)..." oninput="Inventory.filterStocks(this.value)">
          </div>
          <button type="button" class="btn-xs" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #10b981; font-weight: 700; padding: 7px 16px; font-size: 0.85rem;" onclick="Inventory.openStockModal()">
            ➕ เพิ่มคลังสินค้า / ชั้นวางใหม่
          </button>
        </div>
      `;
    }

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดข้อมูลคลังสินค้า & ชั้นวาง...
        </div>
      `;
    }

    try {
      const res = await fetch('/api/stocks');
      const json = await res.json();
      if (!json.success || !json.data) throw new Error(json.error || 'Failed to load stocks');

      this.stocksListCache = json.data;
      this.renderStocksTable(json.data);
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดคลังสินค้า</div>`;
      }
    }
  },

  filterStocks: function(q) {
    if (!this.stocksListCache) return;
    const term = (q || '').trim().toLowerCase();
    const filtered = this.stocksListCache.filter(s =>
      !term ||
      (s.stock_name && s.stock_name.toLowerCase().includes(term)) ||
      (s.detail && s.detail.toLowerCase().includes(term))
    );
    this.renderStocksTable(filtered);
  },

  renderStocksTable: function(stocks) {
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    if (!wrapper) return;

    if (!stocks || !stocks.length) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🏬</div>
          <div style="font-weight: 700; font-size: 1.05rem;">ไม่พบคลังสินค้าหรือชั้นวาง</div>
          <p style="font-size: 0.85rem; margin-top: 4px;">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มคลังสินค้าใหม่"</p>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    stocks.forEach((s) => {
      rowsHtml += `
        <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 50px; cursor: pointer;" onclick="Inventory.showStockDetailView(${s.stock_id})">
          <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 800; color: var(--accent-primary); width: 120px;">
            <span class="stock-code-tag" style="font-size: 0.95rem;">
              📦 ${s.stock_name}
            </span>
          </td>
          <td style="padding: 8px 12px; font-weight: 600; color: var(--text-main);">
            <div style="font-size: 0.95rem;">${s.detail || '-'}</div>
            ${s.limit_stock > 0 ? `<div style="font-size: 0.75rem; color: var(--text-dim);">ความจุสูงสุด: ${s.limit_stock.toLocaleString()} ชิ้น</div>` : ''}
          </td>
          <td style="padding: 8px 12px; text-align: center; width: 160px;">
            <span style="background: rgba(99, 102, 241, 0.12); color: #818cf8; padding: 3px 10px; border-radius: 20px; font-weight: 700; font-size: 0.85rem;">
              ${(s.total_items || 0).toLocaleString()} รายการ
            </span>
          </td>
          <td style="padding: 8px 12px; text-align: right; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; width: 160px;">
            ${Number(s.total_quantity || 0).toLocaleString()} ชิ้น
          </td>
          <td style="padding: 8px 12px; text-align: center; width: 160px;" onclick="event.stopPropagation();">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button type="button" class="btn-xs" style="font-weight: 600; background: var(--bg-surface-elevated);" onclick="Inventory.showStockDetailView(${s.stock_id})" title="ดูรายการสินค้าคงคลังในชั้นนี้">
                👁️ ดูสินค้า
              </button>
              <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.35); font-weight: 600;" onclick="Inventory.openStockModal(${JSON.stringify(s).replace(/"/g, '&quot;')})" title="แก้ไขชั้นวาง">
                ✏️ แก้ไข
              </button>
              <button type="button" class="btn-xs" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); font-weight: 600;" onclick="Inventory.deleteStock(${s.stock_id})" title="ลบชั้นวาง">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    wrapper.innerHTML = `
      <table class="order-table" style="width: 100%;">
        <thead>
          <tr style="background: var(--bg-surface-elevated);">
            <th style="width: 120px; text-align: left;">รหัสชั้นวาง</th>
            <th style="text-align: left;">รายละเอียด / ตำแหน่งจัดเก็บ</th>
            <th style="width: 160px; text-align: center;">จำนวนรายการสินค้า</th>
            <th style="width: 160px; text-align: right;">ยอดคงเหลือรวม</th>
            <th style="width: 160px; text-align: center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  },

  showStockDetailView: async function(stockId) {
    if (this.currentView !== 'stock_detail') {
      this.previousViewState = {
        view: this.currentView,
        selectedCategory: this.selectedCategory,
        selectedType: this.selectedType
      };
    }

    this.currentView = 'stock_detail';
    this.currentStockId = stockId;
    this.setActiveSidebarBtn('btn-side-stocks');

    const banner = document.getElementById('inv-view-banner');
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    const pagination = document.getElementById('inv-pagination-bar');
    if (pagination) pagination.style.display = 'none';

    if (wrapper) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
          <div class="spinner" style="margin: 0 auto 12px auto;"></div>
          กำลังโหลดรายการสินค้าในชั้นวาง...
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(stockId)}/products`);
      const json = await res.json();
      if (!json.success || !json.stock) throw new Error(json.error || 'Failed to load stock detail');

      const stock = json.stock;
      const products = json.products || [];
      this.currentStock = stock;
      this.currentStockProducts = products;
      this.renderBreadcrumbs();

      // Back button label
      let backBtnHtml = '';
      if (this.previousViewState && this.previousViewState.view === 'items' && this.previousViewState.selectedType) {
        backBtnHtml = `
          <button type="button" class="btn-xs" style="padding: 6px 14px; font-weight: 600;" onclick="Inventory.goBackFromStock()">
            ← กลับไปที่ Type: ${this.previousViewState.selectedType.name}
          </button>
        `;
      } else {
        backBtnHtml = `
          <button type="button" class="btn-xs" style="padding: 6px 14px; font-weight: 600;" onclick="Inventory.showStocksView()">
            ← กลับไปหน้ารวมชั้นวาง
          </button>
        `;
      }

      if (banner) {
        banner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            ${backBtnHtml}
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="stock-code-tag">📦 ${stock.stock_name}</span>
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main);">
                  ${stock.detail || 'ชั้นวางสินค้า'}
                </h3>
              </div>
              <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-dim);">
                รวม <b>${stock.total_items || products.length}</b> รายการเบอร์สี • ยอดคงเหลือทั้งหมด <b>${Number(stock.total_quantity || 0).toLocaleString()}</b> ชิ้น
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <div style="position: relative; width: 220px;">
              <input type="text" id="stock-prods-search" class="form-input" style="width: 100%; height: 34px; font-size: 0.82rem;" placeholder="🔍 ค้นหาในชั้นนี้..." oninput="Inventory.filterStockProducts(this.value)">
            </div>
            <button type="button" class="btn-xs" style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; color: #f59e0b; font-weight: 600; padding: 6px 12px;" onclick="Inventory.openStockModal(${JSON.stringify(stock).replace(/"/g, '&quot;')})">
              ✏️ แก้ไขชั้นวาง
            </button>
          </div>
        `;
      }

      this.renderStockProductsTable(products);
    } catch (e) {
      console.error(e);
      if (wrapper) {
        wrapper.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--danger);">เกิดข้อผิดพลาดในการโหลดข้อมูลชั้นวาง</div>`;
      }
    }
  },

  filterStockProducts: function(q) {
    if (!this.currentStockProducts) return;
    const term = (q || '').trim().toLowerCase();
    const filtered = this.currentStockProducts.filter(p =>
      !term ||
      (p.product && p.product.toLowerCase().includes(term)) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.product_id && p.product_id.toLowerCase().includes(term)) ||
      (p.type_name && p.type_name.toLowerCase().includes(term)) ||
      (p.category_name && p.category_name.toLowerCase().includes(term))
    );
    this.renderStockProductsTable(filtered);
  },

  renderStockProductsTable: function(products) {
    const wrapper = document.getElementById('inv-hierarchy-table-wrapper');
    if (!wrapper) return;

    if (!products || !products.length) {
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 50px 20px; color: var(--text-dim);">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">📦</div>
          <div style="font-weight: 700; font-size: 1.05rem;">ไม่มีสินค้าในชั้นวางนี้</div>
          <p style="font-size: 0.85rem; margin-top: 4px;">สามารถระบุชั้นวางนี้ได้จากหน้าแก้ไขสินค้า</p>
        </div>
      `;
      return;
    }

    let rowsHtml = '';
    products.forEach(p => {
      const imgSrc = p.resolved_pic || p.product_pic || p.type_pic;
      const isZero = p.quantity <= 0;
      const isLow = !isZero && p.quantity <= (p.limit_min || 5);

      // Color badge for quantity matching Image 1
      let qtyBadgeHtml = '';
      if (isZero) {
        qtyBadgeHtml = `<span style="background: #ef4444; color: #fff; padding: 3px 12px; border-radius: 4px; font-weight: 800; font-family: 'JetBrains Mono'; font-size: 0.95rem; display: inline-block;">0</span>`;
      } else if (isLow) {
        qtyBadgeHtml = `<span style="background: #f59e0b; color: #fff; padding: 3px 12px; border-radius: 4px; font-weight: 800; font-family: 'JetBrains Mono'; font-size: 0.95rem; display: inline-block;">${p.quantity}</span>`;
      } else {
        qtyBadgeHtml = `<span style="background: #10b981; color: #fff; padding: 3px 12px; border-radius: 4px; font-weight: 800; font-family: 'JetBrains Mono'; font-size: 0.95rem; display: inline-block;">${p.quantity}</span>`;
      }

      rowsHtml += `
        <tr class="inv-tree-row" style="border-bottom: 1px solid var(--border-color); height: 48px;">
          <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: var(--accent-primary); width: 110px;">
            ${p.product_id}
          </td>
          <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 800; color: #f59e0b; width: 85px; text-align: center;">
            <span style="background: rgba(245, 158, 11, 0.12); padding: 2px 8px; border-radius: 4px;">
              ${p.code || '-'}
            </span>
          </td>
          <td style="padding: 8px 12px; font-weight: 500;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 32px; height: 32px; min-width: 32px; border-radius: 4px; overflow: hidden; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                ${imgSrc ? `<img src="${imgSrc}" alt="${p.product}" style="width: 100%; height: 100%; object-fit: contain;">` : `<span>📦</span>`}
              </div>
              <div style="font-weight: 600;">${p.product}</div>
            </div>
          </td>
          <td style="padding: 8px 12px; color: var(--text-muted); font-size: 0.85rem; width: 180px;">
            <div>
              <a href="javascript:void(0)" onclick="Inventory.selectCategory(${p.category_id})" style="color: #f59e0b; text-decoration: underline;">${p.category_name || '-'}</a>
              / 
              <a href="javascript:void(0)" onclick="Inventory.selectType(${p.type_id})" style="color: #38bdf8; text-decoration: underline; font-weight: 600;" title="คลิกเพื่อดู Type">${p.type_name || '-'}</a>
            </div>
          </td>
          <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; text-align: right; width: 90px;">
            ฿${(p.cost || 0).toFixed(2)}
          </td>
          <td style="padding: 8px 12px; font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981; text-align: right; width: 90px;">
            ฿${(p.sale_price || 0).toFixed(2)}
          </td>
          <td style="padding: 8px 12px; text-align: center; width: 110px;">
            ${qtyBadgeHtml}
          </td>
          <td style="padding: 8px 12px; text-align: center; width: 85px;">
            <button type="button" class="btn-xs" onclick="Inventory.openEditModal(${JSON.stringify(p).replace(/"/g, '&quot;')})" style="font-weight: 600;">
              ✏️ แก้ไข
            </button>
          </td>
        </tr>
      `;
    });

    wrapper.innerHTML = `
      <table class="order-table" style="width: 100%;">
        <thead>
          <tr style="background: var(--bg-surface-elevated);">
            <th style="width: 110px; text-align: left;">รหัสสินค้า</th>
            <th style="width: 85px; text-align: center;">เบอร์สี</th>
            <th style="text-align: left;">ชื่อสินค้า / รายการ</th>
            <th style="width: 180px; text-align: left;">หมวดหมู่ / Type</th>
            <th style="width: 90px; text-align: right;">ราคาทุน</th>
            <th style="width: 90px; text-align: right;">ราคาขาย</th>
            <th style="width: 110px; text-align: center;">จำนวน</th>
            <th style="width: 85px; text-align: center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    `;
  },

  goBackFromStock: function() {
    if (this.previousViewState && this.previousViewState.view === 'items' && this.previousViewState.selectedType) {
      this.selectedCategory = this.previousViewState.selectedCategory;
      this.selectType(this.previousViewState.selectedType.type_id);
    } else {
      this.showStocksView();
    }
  },

  openStockModal: function(stock) {
    const idInput = document.getElementById('stock-id-input');
    const nameInput = document.getElementById('stock-name-input');
    const detailInput = document.getElementById('stock-detail-input');
    const limitInput = document.getElementById('stock-limit-input');
    const titleEl = document.getElementById('stock-modal-title');

    if (stock) {
      if (titleEl) titleEl.innerText = '✏️ แก้ไขคลังสินค้า / ชั้นวาง';
      if (idInput) idInput.value = stock.stock_id;
      if (nameInput) nameInput.value = stock.stock_name;
      if (detailInput) detailInput.value = stock.detail || '';
      if (limitInput) limitInput.value = stock.limit_stock || 0;
    } else {
      if (titleEl) titleEl.innerText = '🏬 ➕ เพิ่มคลังสินค้า / ชั้นวางใหม่';
      if (idInput) idInput.value = '';
      if (nameInput) nameInput.value = '';
      if (detailInput) detailInput.value = '';
      if (limitInput) limitInput.value = 0;
    }

    const modal = document.getElementById('stock-modal');
    if (modal) modal.classList.add('active');
  },

  closeStockModal: function() {
    const modal = document.getElementById('stock-modal');
    if (modal) modal.classList.remove('active');
  },

  saveStock: async function() {
    const id = document.getElementById('stock-id-input').value;
    const name = document.getElementById('stock-name-input').value.trim();
    const detail = document.getElementById('stock-detail-input').value.trim();
    const limit = parseInt(document.getElementById('stock-limit-input').value || 0);

    if (!name) {
      if (typeof showToast === 'function') showToast('กรุณาระบุชื่อคลังสินค้า / ชั้นวาง', 'warning');
      return;
    }

    const payload = {
      stock_name: name,
      detail: detail,
      limit_stock: limit
    };

    try {
      const url = id ? `/api/stocks/${id}` : '/api/stocks';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();

      if (json.success) {
        if (typeof showToast === 'function') showToast(json.message || 'บันทึกข้อมูลคลังสินค้าเรียบร้อย', 'success');
        this.closeStockModal();
        await this.loadStocksCache();

        if (this.currentView === 'stock_detail' && this.currentStockId) {
          this.showStockDetailView(this.currentStockId);
        } else {
          this.showStocksView();
        }
      } else {
        if (typeof showToast === 'function') showToast(json.error || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  },

  deleteStock: async function(stockId) {
    if (!confirm('ยืนยันการลบชั้นวางสินค้านี้?')) return;

    try {
      const res = await fetch(`/api/stocks/${stockId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        if (typeof showToast === 'function') showToast(json.message || 'ลบคลังสินค้าเรียบร้อย', 'success');
        await this.loadStocksCache();
        this.showStocksView();
      } else {
        if (typeof showToast === 'function') showToast(json.error || 'ไม่สามารถลบได้', 'error');
      }
    } catch (e) {
      console.error(e);
      if (typeof showToast === 'function') showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  },

  // --------------------------------------------------------------------------
  // PRODUCT EDIT MODAL
  // --------------------------------------------------------------------------
  openEditModal: function(p) {
    this.currentEditImageBase64 = null;
    this.currentEditImageRemoved = false;

    document.getElementById('edit-prod-id').value = p.id;
    document.getElementById('edit-prod-code').value = p.product_id;
    document.getElementById('edit-prod-name').value = p.product;
    document.getElementById('edit-prod-price').value = p.sale_price;
    document.getElementById('edit-prod-cost').value = p.cost;
    document.getElementById('edit-prod-qty').value = p.quantity;
    document.getElementById('edit-prod-unit').value = p.unit || '';
    document.getElementById('edit-prod-min').value = p.limit_min || 5;
    document.getElementById('edit-prod-detail').value = p.detail ? p.detail.replace(/<[^>]*>?/gm, '').trim() : '';

    const stockSel = document.getElementById('edit-prod-stock-id');
    if (stockSel) {
      const populateStocks = (stocks) => {
        stockSel.innerHTML = `
          <option value="">-- ไม่ระบุชั้นวาง --</option>
          ${stocks.map(s => `
            <option value="${s.stock_id}" ${s.stock_id == p.stock_id ? 'selected' : ''}>${s.stock_name} (${s.detail || '-'})</option>
          `).join('')}
        `;
      };
      if (this.stocksCache && this.stocksCache.length) {
        populateStocks(this.stocksCache);
      } else {
        this.loadStocksCache().then(() => {
          if (this.stocksCache) populateStocks(this.stocksCache);
        });
      }
    }

    const fileInput = document.getElementById('edit-prod-file-input');
    if (fileInput) fileInput.value = '';
    const applyTypeCheck = document.getElementById('edit-apply-type-img');
    if (applyTypeCheck) applyTypeCheck.checked = false;

    const imgEl = document.getElementById('edit-prod-img-preview');
    const emptyEl = document.getElementById('edit-prod-img-empty');
    const removeBtn = document.getElementById('edit-prod-btn-remove-img');
    const picSrc = p.resolved_pic || p.product_pic || p.type_pic;

    if (picSrc) {
      imgEl.src = picSrc;
      imgEl.style.display = 'block';
      emptyEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      imgEl.src = '';
      imgEl.style.display = 'none';
      emptyEl.style.display = 'block';
      if (removeBtn) removeBtn.style.display = 'none';
    }

    document.getElementById('edit-product-modal').classList.add('active');
  },

  onImageFileSelected: function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    if (file.size > 15 * 1024 * 1024) {
      if (typeof showToast === 'function') showToast('ขนาดรูปภาพต้องไม่เกิน 15 MB', 'warning');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentEditImageBase64 = e.target.result;
      this.currentEditImageRemoved = false;

      const imgEl = document.getElementById('edit-prod-img-preview');
      const emptyEl = document.getElementById('edit-prod-img-empty');
      const removeBtn = document.getElementById('edit-prod-btn-remove-img');

      if (imgEl) {
        imgEl.src = this.currentEditImageBase64;
        imgEl.style.display = 'block';
      }
      if (emptyEl) emptyEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
  },

  removeImage: function() {
    this.currentEditImageBase64 = null;
    this.currentEditImageRemoved = true;

    const fileInput = document.getElementById('edit-prod-file-input');
    if (fileInput) fileInput.value = '';

    const imgEl = document.getElementById('edit-prod-img-preview');
    const emptyEl = document.getElementById('edit-prod-img-empty');
    const removeBtn = document.getElementById('edit-prod-btn-remove-img');

    if (imgEl) {
      imgEl.src = '';
      imgEl.style.display = 'none';
    }
    if (emptyEl) emptyEl.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  },

  saveProduct: async function() {
    const id = document.getElementById('edit-prod-id').value;
    const applyTypeCheck = document.getElementById('edit-apply-type-img');
    const updateTypeImage = applyTypeCheck ? applyTypeCheck.checked : false;
    const stockSel = document.getElementById('edit-prod-stock-id');

    const payload = {
      product: document.getElementById('edit-prod-name').value,
      sale_price: parseFloat(document.getElementById('edit-prod-price').value || 0),
      cost: parseFloat(document.getElementById('edit-prod-cost').value || 0),
      quantity: parseInt(document.getElementById('edit-prod-qty').value || 0),
      unit: document.getElementById('edit-prod-unit').value,
      limit_min: parseInt(document.getElementById('edit-prod-min').value || 5),
      detail: document.getElementById('edit-prod-detail').value.trim(),
      stock_id: stockSel && stockSel.value !== '' ? stockSel.value : null
    };

    if (this.currentEditImageBase64) {
      payload.image_base64 = this.currentEditImageBase64;
      payload.update_type_image = updateTypeImage;
    } else if (this.currentEditImageRemoved) {
      payload.remove_image = true;
      payload.update_type_image = updateTypeImage;
    }

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
        
        // Refresh appropriate view
        if (this.currentView === 'stock_detail' && this.currentStockId) {
          this.showStockDetailView(this.currentStockId);
        } else if (this.currentView === 'items' && this.selectedType) {
          this.selectType(this.selectedType.type_id);
        } else if (this.currentView === 'all_items') {
          this.showAllProductsView();
        } else if (this.currentView === 'low_stock') {
          this.showLowStockView();
        }

        if (typeof POS !== 'undefined' && POS.loadProducts) {
          POS.loadProducts();
        }
      } else {
        showToast(json.error || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
    }
  },

  // --------------------------------------------------------------------------
  // CATEGORY MANAGEMENT
  // --------------------------------------------------------------------------
  openCategoryModal: function() {
    document.getElementById('add-cat-name').value = '';
    document.getElementById('add-cat-serial').value = '';
    document.getElementById('add-cat-detail').value = '';
    document.getElementById('add-category-modal').classList.add('active');
  },

  saveCategory: async function() {
    const name = document.getElementById('add-cat-name').value.trim();
    const serial = document.getElementById('add-cat-serial').value.trim();
    const detail = document.getElementById('add-cat-detail').value.trim();

    if (!name) {
      showToast('กรุณาระบุชื่อหมวดหมู่', 'warning');
      return;
    }

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, serial_id: serial, detail })
      });
      const json = await res.json();
      if (json.success) {
        showToast('เพิ่มหมวดหมู่สำเร็จ', 'success');
        document.getElementById('add-category-modal').classList.remove('active');
        await this.loadCategoriesCache();
        this.showCategoriesView();
        if (typeof POS !== 'undefined' && POS.loadCategories) {
          POS.loadCategories();
        }
      } else {
        showToast(json.error || 'เกิดข้อผิดพลาดในการบันทึกหมวดหมู่', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  },

  // --------------------------------------------------------------------------
  // TYPE MANAGEMENT (matching INVapp /types/edit/:id)
  // --------------------------------------------------------------------------
  openTypeModal: async function(preselectCatId) {
    document.getElementById('type-modal-id').value = '';
    document.getElementById('type-modal-title').innerText = '📁 ➕ เพิ่ม Type (ประเภทสินค้าใหม่)';
    document.getElementById('type-modal-name').value = '';
    document.getElementById('type-modal-eng-name').value = '';
    document.getElementById('type-modal-serial-id').value = '';
    document.getElementById('type-modal-cost').value = '';
    document.getElementById('type-modal-price').value = '';
    document.getElementById('type-modal-detail').value = '';
    document.getElementById('type-modal-count-info').innerText = '';
    document.getElementById('type-modal-update-items-wrap').style.display = 'none';

    this.currentTypeImageBase64 = null;
    this.currentTypeImageRemoved = false;
    const fileInput = document.getElementById('type-modal-file-input');
    if (fileInput) fileInput.value = '';
    const imgEl = document.getElementById('type-modal-img-preview');
    const emptyEl = document.getElementById('type-modal-img-empty');
    const removeBtn = document.getElementById('type-modal-btn-remove-img');
    imgEl.style.display = 'none';
    imgEl.src = '';
    emptyEl.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';

    await this.populateCategorySelect('type-modal-cat-id', preselectCatId || (this.selectedCategory ? this.selectedCategory.category_id : null));
    document.getElementById('type-modal').classList.add('active');
  },

  openEditTypeModal: async function(typeId) {
    if (!typeId) return;
    try {
      const res = await fetch(`/api/types/${typeId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        showToast('ไม่สามารถโหลดข้อมูล Type ได้', 'error');
        return;
      }
      const t = json.data;
      document.getElementById('type-modal-id').value = t.type_id;
      document.getElementById('type-modal-title').innerText = `📁 แก้ไข Type: ${t.name}`;
      document.getElementById('type-modal-name').value = t.name || '';
      document.getElementById('type-modal-eng-name').value = t.eng_name || '';
      document.getElementById('type-modal-serial-id').value = t.serial_id || '';
      document.getElementById('type-modal-cost').value = t.cost !== undefined ? t.cost : '';
      document.getElementById('type-modal-price').value = t.sale_price !== undefined ? t.sale_price : '';
      document.getElementById('type-modal-detail').value = t.detail || '';
      document.getElementById('type-modal-count-info').innerText = `มีสินค้ารวม ${t.product_count || 0} รายการใน Type นี้`;
      document.getElementById('type-modal-update-items-wrap').style.display = (t.product_count > 0) ? 'block' : 'none';
      document.getElementById('type-modal-update-all-items').checked = false;

      this.currentTypeImageBase64 = null;
      this.currentTypeImageRemoved = false;
      const fileInput = document.getElementById('type-modal-file-input');
      if (fileInput) fileInput.value = '';

      const imgEl = document.getElementById('type-modal-img-preview');
      const emptyEl = document.getElementById('type-modal-img-empty');
      const removeBtn = document.getElementById('type-modal-btn-remove-img');
      const picSrc = t.resolved_pic || t.pic;

      if (picSrc) {
        imgEl.src = picSrc;
        imgEl.style.display = 'block';
        emptyEl.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
      } else {
        imgEl.src = '';
        imgEl.style.display = 'none';
        emptyEl.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'none';
      }

      await this.populateCategorySelect('type-modal-cat-id', t.category_id);
      document.getElementById('type-modal').classList.add('active');
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล Type', 'error');
    }
  },

  populateCategorySelect: async function(selectId, selectedVal) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success && json.data) {
        this.categoriesCache = json.data;
        sel.innerHTML = json.data.map(c => `
          <option value="${c.category_id}" ${c.category_id == selectedVal ? 'selected' : ''}>
            ${c.name} ${c.serial_id ? '(' + c.serial_id + ')' : ''}
          </option>
        `).join('');
      }
    } catch (e) {}
  },

  onTypeImageSelected: function(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 15 * 1024 * 1024) {
      showToast('ขนาดรูปภาพต้องไม่เกิน 15 MB', 'warning');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.currentTypeImageBase64 = e.target.result;
      this.currentTypeImageRemoved = false;
      const imgEl = document.getElementById('type-modal-img-preview');
      const emptyEl = document.getElementById('type-modal-img-empty');
      const removeBtn = document.getElementById('type-modal-btn-remove-img');
      if (imgEl) {
        imgEl.src = this.currentTypeImageBase64;
        imgEl.style.display = 'block';
      }
      if (emptyEl) emptyEl.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
  },

  removeTypeImage: function() {
    this.currentTypeImageBase64 = null;
    this.currentTypeImageRemoved = true;
    const fileInput = document.getElementById('type-modal-file-input');
    if (fileInput) fileInput.value = '';
    const imgEl = document.getElementById('type-modal-img-preview');
    const emptyEl = document.getElementById('type-modal-img-empty');
    const removeBtn = document.getElementById('type-modal-btn-remove-img');
    if (imgEl) {
      imgEl.src = '';
      imgEl.style.display = 'none';
    }
    if (emptyEl) emptyEl.style.display = 'block';
    if (removeBtn) removeBtn.style.display = 'none';
  },

  saveType: async function() {
    const typeId = document.getElementById('type-modal-id').value;
    const name = document.getElementById('type-modal-name').value.trim();
    const catId = document.getElementById('type-modal-cat-id').value;

    if (!name) {
      showToast('กรุณาระบุชื่อ Type สินค้า', 'warning');
      return;
    }
    if (!catId) {
      showToast('กรุณาเลือกหมวดหมู่', 'warning');
      return;
    }

    const payload = {
      category_id: parseInt(catId),
      name: name,
      eng_name: document.getElementById('type-modal-eng-name').value.trim(),
      serial_id: document.getElementById('type-modal-serial-id').value.trim(),
      sale_price: parseFloat(document.getElementById('type-modal-price').value || 0),
      cost: parseFloat(document.getElementById('type-modal-cost').value || 0),
      detail: document.getElementById('type-modal-detail').value.trim()
    };

    if (this.currentTypeImageBase64) {
      payload.image_base64 = this.currentTypeImageBase64;
    } else if (this.currentTypeImageRemoved) {
      payload.remove_image = true;
    }

    const updateAllCheck = document.getElementById('type-modal-update-all-items');
    if (updateAllCheck && updateAllCheck.checked) {
      payload.update_all_items_price = true;
    }

    try {
      const url = typeId ? `/api/types/${typeId}` : `/api/types`;
      const method = typeId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showToast(typeId ? 'บันทึกข้อมูล Type สำเร็จ' : 'เพิ่ม Type ใหม่สำเร็จ', 'success');
        document.getElementById('type-modal').classList.remove('active');

        // Reload appropriate view
        if (this.currentView === 'types' && this.selectedCategory) {
          this.selectCategory(this.selectedCategory.category_id);
        } else if (this.currentView === 'items' && this.selectedType && this.selectedType.type_id == typeId) {
          this.selectType(typeId);
        } else if (this.currentView === 'all_types') {
          this.showAllTypesView();
        } else {
          this.showCategoriesView();
        }

        if (typeof POS !== 'undefined' && POS.loadProducts) {
          POS.loadProducts();
        }
      } else {
        showToast(json.error || 'เกิดข้อผิดพลาดในการบันทึก Type', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
    }
  },

  // --------------------------------------------------------------------------
  // ADD PRODUCT MODAL (matching INVapp /products/add)
  // --------------------------------------------------------------------------
  openAddProductModal: async function() {
    document.getElementById('add-prod-code').value = '';
    document.getElementById('add-prod-name').value = '';
    document.getElementById('add-prod-cost').value = '';
    document.getElementById('add-prod-price').value = '';
    document.getElementById('add-prod-qty').value = '0';
    document.getElementById('add-prod-unit').value = 'ชิ้น';
    document.getElementById('add-prod-min').value = '5';
    document.getElementById('add-prod-detail').value = '';
    document.getElementById('add-prod-preview-id').innerText = '-';

    const targetCatId = this.selectedCategory ? this.selectedCategory.category_id : null;
    const targetTypeId = this.selectedType ? this.selectedType.type_id : null;

    await this.loadAddProductDropdowns(targetCatId, targetTypeId);
    document.getElementById('add-product-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('add-prod-code').focus();
    }, 200);
  },

  openAddProductModalForType: async function(typeId) {
    document.getElementById('add-prod-code').value = '';
    document.getElementById('add-prod-name').value = '';
    document.getElementById('add-prod-cost').value = '';
    document.getElementById('add-prod-price').value = '';
    document.getElementById('add-prod-qty').value = '0';
    document.getElementById('add-prod-unit').value = 'ชิ้น';
    document.getElementById('add-prod-min').value = '5';
    document.getElementById('add-prod-detail').value = '';
    document.getElementById('add-prod-preview-id').innerText = '-';

    let catId = this.selectedCategory ? this.selectedCategory.category_id : null;
    await this.loadAddProductDropdowns(catId, typeId);
    document.getElementById('add-product-modal').classList.add('active');
    setTimeout(() => {
      document.getElementById('add-prod-code').focus();
    }, 200);
  },

  loadAddProductDropdowns: async function(targetCatId, targetTypeId) {
    try {
      const [catsRes, typesRes, stocksRes] = await Promise.all([
        fetch('/api/categories').then(r => r.json()),
        fetch('/api/types').then(r => r.json()),
        fetch('/api/stocks').then(r => r.json())
      ]);

      if (catsRes.success && catsRes.data) {
        this.categoriesCache = catsRes.data;
        const catSel = document.getElementById('add-prod-cat-id');
        catSel.innerHTML = catsRes.data.map(c => `
          <option value="${c.category_id}" ${targetCatId && c.category_id == targetCatId ? 'selected' : ''}>${c.name}</option>
        `).join('');
      }

      if (typesRes.success && typesRes.data) {
        this.allTypesCache = typesRes.data;
        const effectiveCatId = targetCatId || (catsRes.data && catsRes.data.length ? catsRes.data[0].category_id : null);
        this.filterAddProductTypes(effectiveCatId, targetTypeId);
      }

      if (stocksRes.success && stocksRes.data) {
        this.stocksCache = stocksRes.data;
        const stockSel = document.getElementById('add-prod-stock-id');
        stockSel.innerHTML = stocksRes.data.map(s => `
          <option value="${s.stock_id}">${s.stock_name} (${s.detail || '-'})</option>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  },

  onAddCategoryChange: function(catId) {
    this.filterAddProductTypes(catId, null);
  },

  filterAddProductTypes: function(catId, preferredTypeId) {
    const typeSel = document.getElementById('add-prod-type-id');
    const filtered = this.allTypesCache.filter(t => !catId || t.category_id == catId);
    if (!filtered.length) {
      typeSel.innerHTML = '<option value="">-- ไม่พบ Type ในหมวดนี้ --</option>';
      this.selectedTypeSerial = '';
      this.updateAddGeneratedId();
      return;
    }

    typeSel.innerHTML = filtered.map(t => `
      <option value="${t.type_id}" data-serial="${t.serial_id || ''}" data-name="${t.name || ''}" data-price="${t.sale_price || 0}" data-cost="${t.cost || 0}" ${preferredTypeId && t.type_id == preferredTypeId ? 'selected' : ''}>
        ${t.name} (${t.serial_id || '-'})
      </option>
    `).join('');

    const initialId = preferredTypeId || filtered[0].type_id;
    this.onAddTypeChange(initialId);
  },

  onAddTypeChange: function(typeId) {
    const typeSel = document.getElementById('add-prod-type-id');
    const opt = typeSel.options[typeSel.selectedIndex];
    if (opt && opt.value) {
      this.selectedTypeSerial = opt.getAttribute('data-serial') || '';
      document.getElementById('add-prod-name').value = opt.getAttribute('data-name') || '';
      document.getElementById('add-prod-price').value = opt.getAttribute('data-price') || 0;
      document.getElementById('add-prod-cost').value = opt.getAttribute('data-cost') || 0;
      this.updateAddGeneratedId();
    }
  },

  updateAddGeneratedId: function() {
    const code = document.getElementById('add-prod-code').value.trim();
    const previewEl = document.getElementById('add-prod-preview-id');
    if (!code) {
      previewEl.innerText = this.selectedTypeSerial ? `${this.selectedTypeSerial}...` : '-';
    } else {
      previewEl.innerText = `${this.selectedTypeSerial}${code}`;
    }
  },

  saveNewProduct: async function() {
    const typeId = document.getElementById('add-prod-type-id').value;
    const code = document.getElementById('add-prod-code').value.trim();

    if (!typeId) {
      showToast('กรุณาเลือกประเภทสินค้า (Type)', 'warning');
      return;
    }
    if (!code) {
      showToast('กรุณาระบุรหัสสินค้า / เบอร์สี', 'warning');
      return;
    }

    const payload = {
      type_id: parseInt(typeId),
      code: code,
      product: document.getElementById('add-prod-name').value.trim(),
      sale_price: parseFloat(document.getElementById('add-prod-price').value || 0),
      cost: parseFloat(document.getElementById('add-prod-cost').value || 0),
      quantity: parseInt(document.getElementById('add-prod-qty').value || 0),
      unit: document.getElementById('add-prod-unit').value.trim(),
      stock_id: parseInt(document.getElementById('add-prod-stock-id').value || 22),
      limit_min: parseInt(document.getElementById('add-prod-min').value || 5),
      detail: document.getElementById('add-prod-detail').value.trim()
    };

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        showToast(`เพิ่มสินค้าใหม่สำเร็จ (${json.data.product_id})`, 'success');
        document.getElementById('add-product-modal').classList.remove('active');

        // If inside Level 3 Items view of this type, reload
        if (this.currentView === 'items' && this.selectedType && this.selectedType.type_id == typeId) {
          this.selectType(typeId);
        } else if (this.currentView === 'types' && this.selectedCategory) {
          this.selectCategory(this.selectedCategory.category_id);
        } else {
          this.selectType(typeId);
        }

        if (typeof POS !== 'undefined' && POS.loadProducts) {
          POS.loadProducts();
        }
      } else {
        showToast(json.error || 'เกิดข้อผิดพลาดในการเพิ่มสินค้า', 'error');
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ', 'error');
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

