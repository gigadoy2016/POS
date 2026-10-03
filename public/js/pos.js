// ==========================================================================
// BUA NGOEN MODERN POS - CASHIER & CART LOGIC (Matching Reference Design)
// ==========================================================================

const POS = {
  cart: [],
  discount: 0,
  viewMode: 'grouped', // 'grouped' or 'itemized'
  selectedCategory: 1, // Default to Category 1 (ด้าย)
  selectedCategoryName: 'ด้าย',
  allCategories: [],
  currentTypes: [],
  heldBills: [],
  activeModalType: null,
  modalProducts: [],
  activeModalPromotions: [],
  promotionTypes: [],
  activePromoType: null,
  promoDiscount: 0,
  itemSize: localStorage.getItem('pos-item-size') || (window.innerWidth <= 1400 ? 'sm' : 'md'), // 'sm', 'md', 'lg', 'xl', 'xxl'
  categorySize: localStorage.getItem('pos-cat-size') || 'normal', // 'normal', 'lg'
  showPriceBadge: localStorage.getItem('pos-show-price') !== 'false',
  useCategoryFallback: localStorage.getItem('pos-cat-fallback') !== 'false',
  sizeLabels: {
    'sm': 'เล็ก (S)',
    'md': 'กลาง (M)',
    'lg': 'ใหญ่ (L)',
    'xl': 'ใหญ่พิเศษ (XL)',
    'xxl': 'จัมโบ้ (XXL)'
  },
  sizeOrder: ['sm', 'md', 'lg', 'xl', 'xxl'],

  init: function() {
    this.bindEvents();
    this.loadCategories();
    this.loadHeldBills();
    this.setIconSize(this.itemSize);
    this.setCategorySize(this.categorySize);
  },

  bindEvents: function() {
    // Barcode input enter
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) {
      barcodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleBarcodeScan(barcodeInput.value);
        }
      });
    }

    // Modal Enter key to submit
    const itemModal = document.getElementById('item-variant-modal');
    if (itemModal) {
      itemModal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.confirmAddModalItem();
        }
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // F1: Focus Barcode
      if (e.key === 'F1') {
        e.preventDefault();
        if (barcodeInput) {
          barcodeInput.focus();
          barcodeInput.select();
        }
      }
      // F2: Hold Bill
      if (e.key === 'F2') {
        e.preventDefault();
        this.openHoldModal();
      }
      // F3: Discount
      if (e.key === 'F3') {
        e.preventDefault();
        this.openDiscountModal();
      }
      // Space: Checkout when cart has items (and not in an input field)
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (this.cart.length > 0) {
          this.openPaymentModal();
        }
      }
      // Esc: Close Modals
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  },

  // ---------------------- Category Loading & Selection ----------------------
  loadCategories: async function() {
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (!json.success || !json.data) return;

      this.allCategories = json.data;
      const container = document.getElementById('category-tiles-container');
      if (!container) return;

      let html = '';
      this.allCategories.forEach(c => {
        const isActive = c.category_id === this.selectedCategory;
        const imgSrc = c.resolved_pic || 'img/noimg.gif';

        html += `
          <div class="cat-tile ${isActive ? 'active' : ''}" 
               id="cat-tile-${c.category_id}" 
               onclick="POS.selectCategory(${c.category_id}, '${c.name.replace(/'/g, "\\'")}')"
               title="${c.name}">
            <span class="cat-tile-name">${c.name}</span>
            <div class="cat-tile-img-box">
              <img src="${imgSrc}" alt="${c.name}" class="cat-tile-img" onerror="this.src='img/noimg.gif'">
            </div>
          </div>
        `;
      });

      container.innerHTML = html;

      // Automatically load the default category's types
      this.selectCategory(this.selectedCategory, this.selectedCategoryName);
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  },

  selectCategory: function(categoryId, categoryName) {
    this.selectedCategory = categoryId;
    this.selectedCategoryName = categoryName;

    // Update active UI border
    document.querySelectorAll('.cat-tile').forEach(el => el.classList.remove('active'));
    const activeTile = document.getElementById(`cat-tile-${categoryId}`);
    if (activeTile) activeTile.classList.add('active');

    // Update header tag
    const tag = document.getElementById('selected-category-name');
    if (tag) tag.innerText = categoryName;

    // Clear mini search filter
    const searchMini = document.getElementById('type-search-input');
    if (searchMini) searchMini.value = '';

    // Load types for this category
    this.loadTypes(categoryId);
  },

  // ---------------------- Types Loading & Filtering ----------------------
  loadTypes: async function(categoryId) {
    const container = document.getElementById('type-tiles-container');
    if (!container) return;

    try {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #475569;">กำลังโหลดสินค้า...</div>`;

      const res = await fetch(`/api/types?category_id=${categoryId}`);
      const json = await res.json();
      if (!json.success || !json.data.length) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #64748b;">ไม่มีรายการสินค้าในหมวดนี้</div>`;
        return;
      }

      this.currentTypes = json.data;
      this.renderTypes(this.currentTypes);
    } catch (e) {
      console.error('Error loading types:', e);
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #dc2626;">เกิดข้อผิดพลาดในการโหลดรายการ</div>`;
    }
  },

  getCategoryPic: function(categoryId) {
    if (!this.allCategories || !this.allCategories.length) return null;
    const cat = this.allCategories.find(c => c.category_id == categoryId);
    return cat ? cat.resolved_pic : null;
  },

  renderTypes: function(typesList) {
    const container = document.getElementById('type-tiles-container');
    if (!container) return;

    if (!typesList.length) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 24px; color: #64748b; font-weight: 500;">ไม่พบสินค้าที่ตรงกับการค้นหา</div>`;
      return;
    }

    const catFallbackPic = this.getCategoryPic(this.selectedCategory) || '/img/products/yean_1.gif';

    let html = '';
    typesList.forEach(t => {
      const priceText = (this.showPriceBadge && t.sale_price) ? `฿${parseFloat(t.sale_price).toFixed(0)}` : '';
      let imgSrc = t.resolved_pic;
      if (!imgSrc && this.useCategoryFallback) {
        imgSrc = catFallbackPic;
      }
      if (!imgSrc) {
        imgSrc = '/img/products/yean_1.gif';
      }

      html += `
        <div class="type-tile" 
             onclick="POS.handleTypeClick(${t.type_id})"
             title="${t.name} ${priceText}">
          <span class="type-tile-name">${t.name}</span>
          <div class="type-tile-img-box">
            <img src="${imgSrc}" alt="${t.name}" class="type-tile-img" loading="lazy" onerror="if(this.src!=='${catFallbackPic}'){this.src='${catFallbackPic}';}">
          </div>
          ${priceText ? `<span class="type-tile-price">${priceText}</span>` : ''}
        </div>
      `;
    });

    container.innerHTML = html;
  },

  filterTypes: function(searchTerm) {
    if (!this.currentTypes) return;
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      this.renderTypes(this.currentTypes);
      return;
    }

    const filtered = this.currentTypes.filter(t => {
      const name = (t.name || '').toLowerCase();
      const eng = (t.eng_name || '').toLowerCase();
      const serial = (t.serial_id || '').toLowerCase();
      return name.includes(term) || eng.includes(term) || serial.includes(term);
    });

    this.renderTypes(filtered);
  },

  // ---------------------- Dynamic Icon Size Controls & Settings ----------------------
  setIconSize: function(size) {
    if (!this.sizeOrder.includes(size)) size = 'lg';
    this.itemSize = size;
    localStorage.setItem('pos-item-size', size);

    // Update container attribute so CSS adjusts immediately
    const typeContainer = document.getElementById('type-tiles-container');
    if (typeContainer) {
      typeContainer.setAttribute('data-size', size);
    }

    // Update Top bar buttons
    document.querySelectorAll('.btn-icon-size').forEach(btn => {
      if (btn.id && btn.id.startsWith('size-btn-')) {
        btn.classList.remove('active');
      }
    });
    const activeBtn = document.getElementById(`size-btn-${size}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update Header label
    const label = document.getElementById('current-size-label');
    if (label) {
      label.innerText = this.sizeLabels[size] || size.toUpperCase();
    }

    // Update Settings Modal cards if present
    document.querySelectorAll('.size-choice-card').forEach(card => card.classList.remove('active'));
    const choiceCard = document.getElementById(`choice-size-${size}`);
    if (choiceCard) choiceCard.classList.add('active');

    const modalBadge = document.getElementById('setting-modal-size-badge');
    if (modalBadge) {
      modalBadge.innerText = `ขนาดปัจจุบัน: ${this.sizeLabels[size] || size.toUpperCase()}`;
    }
  },

  setCategorySize: function(size) {
    if (!['normal', 'lg'].includes(size)) size = 'normal';
    this.categorySize = size;
    localStorage.setItem('pos-cat-size', size);

    const catContainer = document.getElementById('category-tiles-container');
    if (catContainer) {
      catContainer.setAttribute('data-cat-size', size);
    }

    const btnNormal = document.getElementById('cat-size-normal');
    const btnLg = document.getElementById('cat-size-lg');
    if (btnNormal) btnNormal.classList.toggle('active', size === 'normal');
    if (btnLg) btnLg.classList.toggle('active', size === 'lg');
  },

  stepIconSize: function(delta) {
    const currentIndex = this.sizeOrder.indexOf(this.itemSize);
    let nextIndex = currentIndex + delta;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= this.sizeOrder.length) nextIndex = this.sizeOrder.length - 1;
    this.setIconSize(this.sizeOrder[nextIndex]);
  },

  openSettingModal: function() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.add('active');
      this.syncSettingModalUI();
    }
  },

  closeSettingModal: function() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) barcodeInput.focus();
  },

  syncSettingModalUI: function() {
    this.setIconSize(this.itemSize);
    this.setCategorySize(this.categorySize);
    const priceCheckbox = document.getElementById('setting-show-price');
    if (priceCheckbox) priceCheckbox.checked = this.showPriceBadge;
    const fallbackCheckbox = document.getElementById('setting-img-fallback');
    if (fallbackCheckbox) fallbackCheckbox.checked = this.useCategoryFallback;
  },

  resetSettings: function() {
    this.setIconSize(window.innerWidth <= 1400 ? 'sm' : 'md');
    this.setCategorySize('normal');
    this.showPriceBadge = true;
    this.useCategoryFallback = true;
    localStorage.setItem('pos-show-price', 'true');
    localStorage.setItem('pos-cat-fallback', 'true');
    this.syncSettingModalUI();
    if (this.currentTypes) this.renderTypes(this.currentTypes);
    showToast('คืนค่าเริ่มต้นเรียบร้อยแล้ว', 'info');
  },

  togglePriceDisplay: function(checked) {
    this.showPriceBadge = !!checked;
    localStorage.setItem('pos-show-price', this.showPriceBadge);
    if (this.currentTypes) this.renderTypes(this.currentTypes);
  },

  toggleCategoryFallback: function(checked) {
    this.useCategoryFallback = !!checked;
    localStorage.setItem('pos-cat-fallback', this.useCategoryFallback);
    if (this.currentTypes) this.renderTypes(this.currentTypes);
  },

  // ---------------------- Type Click & Variant Modal (Matching INVapp) ----------------------
  handleTypeClick: async function(typeId) {
    const type = this.currentTypes.find(t => t.type_id === typeId);
    if (!type) return;

    try {
      const res = await fetch(`/api/types/${typeId}/products`);
      const json = await res.json();
      const products = (json && json.success) ? (json.data || []) : [];
      const promotions = (json && json.success) ? (json.promotions || []) : [];

      this.activeModalType = type;
      this.modalProducts = products;
      this.activeModalPromotions = promotions;

      // Always open Variant Modal like INVapp showItemE(type_id)
      this.openItemModal(type, products, promotions);
    } catch (e) {
      console.error('Error clicking type:', e);
      // Fallback open modal even if network issue
      this.openItemModal(type, [], []);
    }
  },

  openItemModal: function(type, products, promotions = []) {
    const modal = document.getElementById('item-variant-modal');
    if (!modal) return;

    const img = document.getElementById('item-modal-img');
    const title = document.getElementById('item-modal-name');
    const prefixEl = document.getElementById('item-modal-serial-prefix');
    const codeInput = document.getElementById('item-modal-code');
    const qtyInput = document.getElementById('item-modal-qty');
    const priceInput = document.getElementById('item-modal-price');
    const stockQty = document.getElementById('item-modal-stock-qty');
    const matchTitle = document.getElementById('item-modal-match-title');
    const matchDetail = document.getElementById('item-modal-match-detail');

    const catFallbackPic = this.getCategoryPic(this.selectedCategory) || '/img/products/yean_1.gif';
    const resolvedImg = type.resolved_pic || catFallbackPic;

    if (title) title.innerText = type.name;
    if (prefixEl) prefixEl.innerText = type.serial_id || '-';
    if (img) img.src = resolvedImg;
    if (qtyInput) qtyInput.value = 1;

    const defaultPrice = type.sale_price || (products[0] ? products[0].sale_price : 0) || 0;
    if (priceInput) priceInput.value = parseFloat(defaultPrice).toFixed(2);

    let totalStock = 0;
    products.forEach(p => totalStock += (p.quantity || 0));
    if (stockQty) stockQty.innerText = totalStock;

    if (matchTitle) matchTitle.innerText = `มีทั้งหมด ${products.length} รหัสย่อย/สี`;
    if (matchDetail) matchDetail.innerText = 'พิมพ์รหัสเบอร์สีด้านบน หรือคลิกเลือกรหัสด้านล่าง';

    // Reset custom price notice & promo title
    const customNotice = document.getElementById('item-modal-custom-notice');
    if (customNotice) customNotice.style.display = 'none';
    const promoTitle = document.getElementById('item-modal-promo-title');
    if (promoTitle) promoTitle.innerText = '🏷️ โปรโมชั่นพิเศษสำหรับสินค้านี้:';

    this.activeMatchedProduct = null;

    // Render promotions of this type (Matching INVapp casher.js showItemE promotion table)
    this.renderModalPromotions(promotions, defaultPrice);

    // Render variant pills
    this.renderModalVariantBadges(products, defaultPrice);

    if (codeInput) {
      codeInput.value = '';
    }

    modal.classList.add('active');
    setTimeout(() => {
      if (codeInput) {
        codeInput.focus();
        codeInput.select();
      }
    }, 80);
  },

  renderModalPromotions: function(promotions, basePrice) {
    const wrap = document.getElementById('item-modal-promo-wrap');
    const container = document.getElementById('item-modal-promo-tiers');
    if (!wrap || !container) return;

    if (!promotions || !promotions.length) {
      wrap.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    wrap.style.display = 'block';
    let html = '';
    promotions.forEach(p => {
      const perUnit = p.limit > 0 ? (p.price / p.limit) : p.price;
      const regularTotal = (basePrice || 0) * p.limit;
      const saveAmount = Math.max(0, regularTotal - p.price);
      html += `
        <button type="button" class="inv-promo-tier-chip" 
                onclick="POS.selectModalPromoTier(${p.limit}, ${p.price}, '${p.name}')"
                title="คลิกเพื่อเลือกจำนวน ${p.limit} ชิ้น ในราคาโปรโมชั่น ฿${p.price}">
          <span>${p.name} (<b>${p.limit} ชิ้น</b>) = <b>฿${p.price.toFixed(0)}</b></span>
          <span style="color:#64748b; font-size:0.75rem;">(เฉลี่ย ฿${perUnit.toFixed(2)})</span>
          ${saveAmount > 0 ? `<span class="promo-save-tag">ประหยัด ฿${saveAmount.toFixed(0)}</span>` : ''}
        </button>
      `;
    });
    container.innerHTML = html;
  },

  selectModalPromoTier: function(limit, bundlePrice, promoName) {
    const qtyInput = document.getElementById('item-modal-qty');
    const priceInput = document.getElementById('item-modal-price');
    if (qtyInput) qtyInput.value = limit;
    if (priceInput && limit > 0) {
      priceInput.value = (bundlePrice / limit).toFixed(2);
    }
    POSSound.beep();
    showToast(`เลือกโปรโมชั่น: ${promoName} (${limit} ชิ้น = ฿${bundlePrice})`, 'info');
  },

  renderModalVariantBadges: function(productsList, defaultPrice) {
    const variantsWrap = document.getElementById('item-modal-variants-wrap');
    if (!variantsWrap) return;

    if (!productsList || !productsList.length) {
      variantsWrap.innerHTML = '<span style="font-size: 0.8rem; color: #94a3b8; padding: 4px;">ไม่มีรายการรหัสย่อยที่บันทึกไว้ (สามารถพิมพ์รหัสใหม่ได้)</span>';
      return;
    }

    let html = '';
    // Show up to 100 variant chips for fast rendering
    const displayList = productsList.slice(0, 80);
    displayList.forEach(p => {
      const label = p.code ? p.code : p.product_id;
      const price = (p.has_custom_price && p.sale_price > 0) ? p.sale_price : defaultPrice;
      const isCustom = p.has_custom_price || p.has_custom_promo;
      const btnStyle = isCustom 
        ? 'background:#fef3c7; border:1px solid #f59e0b; color:#92400e; font-weight:700; font-size:0.82rem; cursor:pointer; padding: 2px 6px; border-radius: 4px;'
        : 'background:#fff; border:1px solid #cbd5e1; font-weight:700; font-size:0.82rem; cursor:pointer; padding: 2px 6px; border-radius: 4px;';

      html += `
        <button type="button" class="btn-xs" style="${btnStyle}" 
                title="${isCustom ? '★ สินค้ารหัสนี้มี Fix ราคา/โปรโมชั่นเฉพาะตัว' : ''}"
                onclick="POS.selectVariantCode('${p.product_id}', '${p.code || ''}', ${price}, ${p.quantity || 0}, '${p.product || ''}')">
          ${isCustom ? '★ ' : ''}${label} <span style="font-size:0.75rem; color:#15803d; font-weight: normal;">(${p.quantity || 0})</span>
        </button>
      `;
    });

    if (productsList.length > 80) {
      html += `<span style="font-size: 0.75rem; color: #64748b; padding: 4px;">และอีก ${productsList.length - 80} รายการ... (พิมพ์รหัสเพื่อค้นหา)</span>`;
    }

    variantsWrap.innerHTML = html;
  },

  onModalCodeChange: function(val) {
    const query = (val || '').trim().toUpperCase();
    const type = this.activeModalType;
    const serial = type ? (type.serial_id || '').toUpperCase() : '';
    const priceInput = document.getElementById('item-modal-price');
    const stockQty = document.getElementById('item-modal-stock-qty');
    const matchTitle = document.getElementById('item-modal-match-title');
    const matchDetail = document.getElementById('item-modal-match-detail');
    const customNotice = document.getElementById('item-modal-custom-notice');
    const customNoticeText = document.getElementById('item-modal-custom-notice-text');
    const promoTitle = document.getElementById('item-modal-promo-title');

    if (!query) {
      this.activeMatchedProduct = null;
      let totalStock = 0;
      this.modalProducts.forEach(p => totalStock += (p.quantity || 0));
      if (stockQty) stockQty.innerText = totalStock;
      if (matchTitle) matchTitle.innerText = `มีทั้งหมด ${this.modalProducts.length} รหัสย่อย/สี`;
      if (matchDetail) matchDetail.innerText = 'พิมพ์รหัสเบอร์สีด้านบน หรือคลิกเลือกรหัสด้านล่าง';
      if (customNotice) customNotice.style.display = 'none';
      if (promoTitle) promoTitle.innerText = '🏷️ โปรโมชั่นพิเศษสำหรับสินค้านี้:';
      if (priceInput) priceInput.value = parseFloat(type ? type.sale_price : 0).toFixed(2);
      this.renderModalPromotions(this.activeModalPromotions, type ? type.sale_price : 0);
      this.renderModalVariantBadges(this.modalProducts, type ? type.sale_price : 0);
      return;
    }

    // Find exact match first
    const exactMatch = this.modalProducts.find(p => 
      (p.code && p.code.toUpperCase() === query) ||
      (p.product_id && p.product_id.toUpperCase() === query) ||
      (p.product_id && p.product_id.toUpperCase() === (serial + query))
    );

    if (exactMatch) {
      this.activeMatchedProduct = exactMatch;
      if (stockQty) stockQty.innerText = exactMatch.quantity || 0;
      
      // Check custom unit price
      if (exactMatch.has_custom_price && exactMatch.sale_price > 0) {
        if (priceInput) priceInput.value = parseFloat(exactMatch.sale_price).toFixed(2);
        if (customNotice) {
          customNotice.style.display = 'flex';
          if (customNoticeText) {
            customNoticeText.innerText = `★ รหัสนี้มีราคาพิเศษเฉพาะตัว: ฿${parseFloat(exactMatch.sale_price).toFixed(2)} (ราคาปกติของประเภท ฿${parseFloat(type ? type.sale_price : 0).toFixed(2)})`;
          }
        }
      } else {
        if (priceInput) priceInput.value = parseFloat(type ? type.sale_price : 0).toFixed(2);
        if (customNotice) customNotice.style.display = 'none';
      }

      // Check custom promotions for this variant
      if (exactMatch.has_custom_promo && exactMatch.custom_promotions && exactMatch.custom_promotions.length > 0) {
        if (promoTitle) promoTitle.innerText = `★ โปรโมชั่นพิเศษเฉพาะรหัสนี้ (${exactMatch.product_id}):`;
        const activeP = (exactMatch.has_custom_price && exactMatch.sale_price > 0) ? exactMatch.sale_price : (type ? type.sale_price : 0);
        this.renderModalPromotions(exactMatch.custom_promotions, activeP);
      } else {
        if (promoTitle) promoTitle.innerText = '🏷️ โปรโมชั่นพิเศษสำหรับสินค้านี้:';
        this.renderModalPromotions(this.activeModalPromotions, type ? type.sale_price : 0);
      }

      if (matchTitle) matchTitle.innerText = `ตรงกับ: ${exactMatch.product || exactMatch.product_id}`;
      const locText = exactMatch.stock_detail ? ` • 📍 ที่เก็บ: ${exactMatch.stock_detail}${exactMatch.stock_name ? ` (${exactMatch.stock_name})` : ''}` : '';
      if (matchDetail) matchDetail.innerText = `รหัส: ${exactMatch.product_id} • คงเหลือ ${exactMatch.quantity || 0} ชิ้น${locText}`;
    } else {
      this.activeMatchedProduct = null;
      if (customNotice) customNotice.style.display = 'none';
      if (promoTitle) promoTitle.innerText = '🏷️ โปรโมชั่นพิเศษสำหรับสินค้านี้:';
      this.renderModalPromotions(this.activeModalPromotions, type ? type.sale_price : 0);

      // Filter partial matches
      const filtered = this.modalProducts.filter(p => 
        (p.code && p.code.toUpperCase().includes(query)) ||
        (p.product_id && p.product_id.toUpperCase().includes(query))
      );
      if (filtered.length > 0) {
        let fStock = 0;
        filtered.forEach(p => fStock += (p.quantity || 0));
        if (stockQty) stockQty.innerText = fStock;
        if (matchTitle) matchTitle.innerText = `พบ ${filtered.length} รายการที่ขึ้นต้น/มีรหัส "${val}"`;
        if (matchDetail) matchDetail.innerText = `กดเลือกรหัสด้านล่าง หรือกด Enter เพื่อยืนยัน`;
        this.renderModalVariantBadges(filtered, type ? type.sale_price : 0);
      } else {
        if (stockQty) stockQty.innerText = '0';
        if (matchTitle) matchTitle.innerText = `รหัสใหม่: ${serial}${val}`;
        if (matchDetail) matchDetail.innerText = `ยังไม่มีในฐานข้อมูล (จะบันทึกเป็นรายการใหม่ในบิล)`;
        this.renderModalVariantBadges([], type ? type.sale_price : 0);
      }
    }
  },

  selectVariantCode: function(productId, code, price, stock, productName) {
    const codeInput = document.getElementById('item-modal-code');
    const qtyInput = document.getElementById('item-modal-qty');

    if (codeInput) {
      codeInput.value = code || productId;
      this.onModalCodeChange(codeInput.value);
    }

    if (qtyInput) {
      qtyInput.focus();
      qtyInput.select();
    }
  },

  closeItemModal: function() {
    const modal = document.getElementById('item-variant-modal');
    if (modal) modal.classList.remove('active');
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) barcodeInput.focus();
  },

  adjustModalQty: function(delta) {
    const qtyInput = document.getElementById('item-modal-qty');
    let val = parseInt(qtyInput.value || 1) + delta;
    if (val < 1) val = 1;
    qtyInput.value = val;
  },

  confirmAddModalItem: function() {
    const codeVal = document.getElementById('item-modal-code').value.trim();
    const qtyVal = parseFloat(document.getElementById('item-modal-qty').value || 1);
    const priceVal = parseFloat(document.getElementById('item-modal-price').value || 0);

    const type = this.activeModalType;
    const serial = type ? (type.serial_id || '') : '';

    // Find if product matches serial+code or code
    let targetProduct = null;
    if (this.modalProducts && this.modalProducts.length > 0) {
      targetProduct = this.modalProducts.find(p => 
        (p.code && p.code.toUpperCase() === codeVal.toUpperCase()) || 
        (p.product_id && p.product_id.toUpperCase() === (serial + codeVal).toUpperCase()) ||
        (p.product_id && p.product_id.toUpperCase() === codeVal.toUpperCase())
      );
    }

    const fullProductId = targetProduct ? targetProduct.product_id : (serial + codeVal);
    let prodTitle = targetProduct ? (targetProduct.product || (type ? type.name : 'สินค้า')) : (type ? type.name : 'สินค้า');
    if (codeVal && !prodTitle.includes(codeVal)) {
      prodTitle += ` #${codeVal}`;
    }

    // Determine promotions: variant-specific or type general
    let itemPromotions = this.activeModalPromotions || [];
    let hasCustomPromo = false;
    let targetPromotionId = serial;

    if (targetProduct) {
      if (targetProduct.has_custom_promo && targetProduct.custom_promotions && targetProduct.custom_promotions.length > 0) {
        itemPromotions = targetProduct.custom_promotions;
        hasCustomPromo = true;
        targetPromotionId = targetProduct.product_id;
      }
    }

    const itemToAdd = {
      id: targetProduct ? targetProduct.id : Date.now(),
      product_id: fullProductId,
      product: prodTitle,
      code: codeVal,
      unit: targetProduct ? targetProduct.unit : 'ชิ้น',
      type_id: type ? type.type_id : '',
      serial: serial,
      sale_price: priceVal,
      cost: targetProduct ? targetProduct.cost : (type ? type.cost : 0),
      promotions: itemPromotions,
      has_custom_promo: hasCustomPromo,
      promotion_id: targetPromotionId
    };

    POSSound.beep();
    this.addToCartWithQty(itemToAdd, qtyVal, priceVal);
    this.closeItemModal();
    showToast(`เพิ่ม: ${prodTitle} (${qtyVal} ชิ้น)`, 'success');
  },

  // ---------------------- Barcode Scanner ----------------------
  handleBarcodeScan: async function(code) {
    if (!code || !code.trim()) return;
    const barcodeInput = document.getElementById('barcode-input');
    
    try {
      const res = await fetch(`/api/products/lookup/${encodeURIComponent(code.trim())}`);
      const json = await res.json();

      if (json.success && json.data) {
        POSSound.beep();
        this.addToCart(json.data);
        barcodeInput.value = '';
        barcodeInput.focus();
        showToast(`สแกน: ${json.data.product}`, 'success');
      } else {
        POSSound.error();
        showToast(json.message || 'ไม่พบรหัสสินค้านี้', 'error');
        barcodeInput.select();
      }
    } catch (e) {
      POSSound.error();
      showToast('เกิดข้อผิดพลาดในการค้นหา', 'error');
    }
  },

  // ---------------------- Cart Operations ----------------------
  addToCart: function(product) {
    this.addToCartWithQty(product, 1, parseFloat(product.sale_price || 0));
  },

  addToCartWithQty: function(product, qty, customPrice) {
    const targetPrice = (customPrice !== undefined && customPrice !== null && !isNaN(customPrice))
      ? parseFloat(customPrice)
      : parseFloat(product.sale_price || 0);

    // Matching INVapp bill.js: arrageItem - matches when BOTH product_id AND base_price are identical
    const existingIndex = this.cart.findIndex(i => 
      i.product_id === product.product_id && 
      Math.abs(parseFloat(i.base_price) - targetPrice) < 0.001
    );

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += qty;
    } else {
      this.cart.push({
        id: product.id || Date.now(),
        product_id: product.product_id,
        name: product.product || product.name,
        code: product.code || '',
        unit: product.unit || '',
        type_id: product.type_id || '',
        serial: product.serial || (product.serial_id || ''),
        base_price: targetPrice,
        unit_price: targetPrice,
        cost: parseFloat(product.cost || 0),
        quantity: qty,
        promotions: product.promotions || [],
        has_custom_promo: !!product.has_custom_promo,
        promotion_id: product.promotion_id || ''
      });
    }

    this.recalculatePromotions();
    this.renderCart();
  },

  updateQuantity: function(productId, delta) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.recalculatePromotions();
    this.renderCart();
  },

  setQuantity: function(productId, qty) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    const val = parseFloat(qty);
    if (isNaN(val) || val <= 0) {
      this.removeFromCart(productId);
      return;
    }
    item.quantity = val;
    this.recalculatePromotions();
    this.renderCart();
  },

  removeFromCart: function(productId) {
    this.cart = this.cart.filter(i => i.product_id !== productId);
    this.recalculatePromotions();
    this.renderCart();
  },

  clearCart: function() {
    if (!this.cart.length) return;
    if (confirm('คุณต้องการล้างรายการสินค้าทั้งหมดในตะกร้าใช่หรือไม่?')) {
      this.cart = [];
      this.discount = 0;
      this.promoDiscount = 0;
      this.renderCart();
      showToast('ล้างตะกร้าเรียบร้อย', 'warning');
    }
  },

  setViewMode: function(mode) {
    this.viewMode = mode;
    const btnItemized = document.getElementById('btn-view-itemized');
    const btnGrouped = document.getElementById('btn-view-grouped');

    if (mode === 'itemized') {
      if (btnItemized) btnItemized.classList.add('active');
      if (btnGrouped) btnGrouped.classList.remove('active');
    } else {
      if (btnItemized) btnItemized.classList.remove('active');
      if (btnGrouped) btnGrouped.classList.add('active');
    }

    this.renderCart();
  },

  // ---------------------- Promotion Engine (Type-level Pooling like INVapp bill.js) ----------------------
  recalculatePromotions: function() {
    // 1. Group items by promotion pool:
    // Items of the SAME Type/Serial AND SAME base_price AND SAME promotion_id are pooled together!
    // (Matching INVapp bill.js: arrageOrder - (buffer[i].promotion_id == x.promotion_id) && (buffer[i].serial == x.serial) && (buffer[i].priceUnit == x.priceUnit))
    const typeGroups = {};
    this.cart.forEach(item => {
      const isVariantPromo = item.has_custom_promo || 
                            (item.promotion_id && item.promotion_id === item.product_id) ||
                            (item.promotions && item.promotions.some(p => p.promotion_id === item.product_id));
      const groupKey = isVariantPromo
        ? ('VAR_' + item.product_id + '_P' + item.base_price)
        : (`GRP_${item.serial || item.type_id}_P${item.base_price}_${item.promotion_id || ''}`);

      if (!typeGroups[groupKey]) {
        typeGroups[groupKey] = {
          totalQty: 0,
          items: [],
          promotions: item.promotions && item.promotions.length ? item.promotions : []
        };
      }
      typeGroups[groupKey].totalQty += item.quantity;
      typeGroups[groupKey].items.push(item);
      if ((!typeGroups[groupKey].promotions || !typeGroups[groupKey].promotions.length) && item.promotions && item.promotions.length) {
        typeGroups[groupKey].promotions = item.promotions;
      }
    });

    let totalPromoSavings = 0;

    Object.values(typeGroups).forEach(group => {
      if (!group.promotions || !group.promotions.length) {
        group.items.forEach(it => {
          it.unit_price = it.base_price;
          it.promo_name = null;
          it.line_total = it.unit_price * it.quantity;
        });
        return;
      }

      // Sort promotions by limit DESC (e.g. 12 pcs before 6 pcs before 3 pcs)
      const sorted = [...group.promotions].sort((a, b) => b.limit - a.limit);
      let remainingQty = group.totalQty;
      let bundleCostTotal = 0;
      let appliedPromoNames = [];

      for (const promo of sorted) {
        if (remainingQty >= promo.limit && promo.limit > 0 && promo.price > 0) {
          const sets = Math.floor(remainingQty / promo.limit);
          bundleCostTotal += sets * promo.price;
          remainingQty -= sets * promo.limit;
          appliedPromoNames.push(sets > 1 ? `${promo.name} x${sets}` : promo.name);
        }
      }

      const totalBasePrice = group.items.reduce((s, it) => s + (it.base_price * it.quantity), 0);
      const avgBasePrice = group.totalQty > 0 ? (totalBasePrice / group.totalQty) : 0;

      if (appliedPromoNames.length > 0) {
        // Effective total for this group with promotion + leftover pieces
        const groupFinalTotal = bundleCostTotal + (remainingQty * avgBasePrice);
        const groupSavings = Math.max(0, totalBasePrice - groupFinalTotal);
        totalPromoSavings += groupSavings;

        // Effective unit price across all pieces in group
        const effectiveUnitPrice = group.totalQty > 0 ? (groupFinalTotal / group.totalQty) : avgBasePrice;

        group.items.forEach(it => {
          it.unit_price = effectiveUnitPrice;
          it.promo_name = appliedPromoNames.join(', ');
          it.line_total = it.unit_price * it.quantity;
        });
      } else {
        group.items.forEach(it => {
          it.unit_price = it.base_price;
          it.promo_name = null;
          it.line_total = it.unit_price * it.quantity;
        });
      }
    });

    this.promoDiscount = totalPromoSavings;
  },

  // ---------------------- Grouped Cart Items (Matching INVapp bill.js: arrageOrder + checkPromotion) ----------------------
  getGroupedCartItems: function() {
    const groups = {};
    this.cart.forEach(item => {
      const isVariantPromo = item.has_custom_promo || 
                            (item.promotion_id && item.promotion_id === item.product_id) ||
                            (item.promotions && item.promotions.some(p => p.promotion_id === item.product_id));
      const key = isVariantPromo
        ? ('VAR_' + item.product_id + '_P' + item.base_price)
        : (`GRP_${item.serial || item.type_id}_P${item.base_price}_${item.promotion_id || ''}`);

      if (!groups[key]) {
        groups[key] = {
          key: key,
          serial: item.serial || item.type_id,
          type_id: item.type_id,
          name: (item.name || '').split(' #')[0],
          base_price: item.base_price,
          unit: item.unit || 'ชิ้น',
          total_qty: 0,
          cost: item.cost,
          promotions: item.promotions || [],
          has_custom_promo: item.has_custom_promo,
          items: []
        };
      }
      groups[key].total_qty += item.quantity;
      groups[key].items.push(item);
    });

    const result = [];
    Object.values(groups).forEach(grp => {
      const sortedPromos = [...(grp.promotions || [])].sort((a, b) => b.limit - a.limit);
      let remQty = grp.total_qty;

      const codesSummary = grp.items.length > 1
        ? 'MIX (' + grp.items.map(it => `${it.code || it.product_id} x${it.quantity}`).join(', ') + ')'
        : (grp.items[0].code ? `#${grp.items[0].code}` : grp.items[0].product_id);

      let promoApplied = false;
      for (const p of sortedPromos) {
        if (remQty >= p.limit && p.limit > 0 && p.price > 0) {
          const bundles = Math.floor(remQty / p.limit);
          remQty -= bundles * p.limit;
          promoApplied = true;

          result.push({
            display_id: grp.items.length > 1 ? `${grp.serial}MIX` : grp.items[0].product_id,
            name: `${grp.name} [${p.name}]`,
            subtitle: codesSummary,
            unit_price: p.price,
            quantity: bundles,
            unit: 'ชุด',
            line_total: bundles * p.price,
            promo_name: p.name,
            is_bundle: true,
            bundle_limit: p.limit,
            items: grp.items
          });
        }
      }

      if (remQty > 0 || !promoApplied) {
        const qty = remQty;
        result.push({
          display_id: grp.items.length > 1 ? `${grp.serial}MIX` : grp.items[0].product_id,
          name: grp.items.length > 1 ? `${grp.name} (คละสี)` : grp.items[0].name,
          subtitle: codesSummary,
          unit_price: grp.base_price,
          quantity: qty,
          unit: grp.unit,
          line_total: qty * grp.base_price,
          promo_name: null,
          is_bundle: false,
          items: grp.items
        });
      }
    });

    return result;
  },

  removeGroupedCartItems: function(index) {
    const groupedItems = this.getGroupedCartItems();
    if (!groupedItems[index]) return;
    const itemsToRemove = groupedItems[index].items || [];
    const prodIds = itemsToRemove.map(it => it.product_id);
    this.cart = this.cart.filter(it => !prodIds.includes(it.product_id));
    this.recalculatePromotions();
    this.renderCart();
  },

  editGroupPrice: function(index) {
    const groupedItems = this.getGroupedCartItems();
    const grp = groupedItems[index];
    if (!grp) return;

    const currentPrice = grp.unit_price;
    const input = prompt(`แก้ไขราคาต่อหน่วยสำหรับ: ${grp.name}\n(เหมือน INVapp editValue)`, currentPrice.toFixed(2));
    if (input === null || input.trim() === '') return;

    const newPrice = parseFloat(input);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('กรุณากรอกตัวเลขราคาที่ถูกต้อง');
      return;
    }

    if (grp.is_bundle) {
      grp.unit_price = newPrice;
      grp.line_total = grp.quantity * newPrice;
      const perPiece = (grp.bundle_limit && grp.bundle_limit > 0) ? (newPrice / grp.bundle_limit) : newPrice;
      grp.items.forEach(it => {
        it.unit_price = perPiece;
      });
      this.renderCart();
    } else {
      grp.items.forEach(it => {
        it.base_price = newPrice;
        it.unit_price = newPrice;
      });
      this.recalculatePromotions();
      this.renderCart();
    }
    showToast(`แก้ไขราคาเป็น ฿${newPrice.toFixed(2)} เรียบร้อย`, 'success');
  },

  editItemPrice: function(productId) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;

    const input = prompt(`แก้ไขราคาต่อหน่วยสำหรับ: ${item.name} (${item.product_id})`, item.base_price.toFixed(2));
    if (input === null || input.trim() === '') return;

    const newPrice = parseFloat(input);
    if (isNaN(newPrice) || newPrice < 0) {
      alert('กรุณากรอกตัวเลขราคาที่ถูกต้อง');
      return;
    }

    item.base_price = newPrice;
    item.unit_price = newPrice;
    this.recalculatePromotions();
    this.renderCart();
    showToast(`แก้ไขราคาเป็น ฿${newPrice.toFixed(2)} เรียบร้อย`, 'success');
  },

  // ---------------------- Render Cart ----------------------
  renderCart: function() {
    const tbody = document.getElementById('cart-table-body');
    const topTotalBox = document.getElementById('top-total-box');
    const itemsCountEl = document.getElementById('cart-items-count');
    const discountIndicator = document.getElementById('discount-indicator');
    const discountVal = document.getElementById('discount-val');
    const submitBtn = document.getElementById('btn-submit-order');

    const totalUnits = this.cart.reduce((sum, i) => sum + i.quantity, 0);

    if (!this.cart.length) {
      if (itemsCountEl) itemsCountEl.innerText = '0 รายการ (0 ชิ้น)';
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 45px 10px; color: #94a3b8;">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">🛒</div>
              <b style="font-size: 1rem; color: #475569;">ยังไม่มีสินค้าในบิล</b>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">ยิงบาร์โค้ด หรือคลิกเลือกประเภทและสินค้าทางขวามือ</div>
            </td>
          </tr>
        `;
      }
      if (topTotalBox) topTotalBox.innerText = '0.';
      if (discountIndicator) discountIndicator.style.display = 'none';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    let subtotal = 0;
    let html = '';

    if (this.viewMode === 'grouped') {
      const groupedItems = this.getGroupedCartItems();
      if (itemsCountEl) {
        itemsCountEl.innerText = `${groupedItems.length} รายการขายจริง (${totalUnits} ชิ้น)`;
      }

      groupedItems.forEach((grp, index) => {
        subtotal += grp.line_total;
        html += `
          <tr>
            <td style="text-align: center;">
              <button class="td-at-btn" onclick="POS.removeGroupedCartItems(${index})" title="ลบกลุ่มสินค้านี้">✕</button>
            </td>
            <td>
              <span class="td-product-name" title="${grp.name}">${grp.name}</span>
              <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                <span class="td-product-code">${grp.display_id}</span>
                ${grp.subtitle ? `<span style="font-size: 0.72rem; color: #475569; background: #e2e8f0; padding: 1px 5px; border-radius: 3px; font-weight: 500;">${grp.subtitle}</span>` : ''}
                ${grp.promo_name ? `<span style="font-size: 0.68rem; background: #fef3c7; color: #b45309; font-weight: 600; padding: 1px 4px; border-radius: 3px;">🏷️ ${grp.promo_name}</span>` : ''}
              </div>
            </td>
            <td style="text-align: right; padding-right: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.86rem; color: #334155; cursor: pointer;" onclick="POS.editGroupPrice(${index})" title="คลิกเพื่อแก้ไขราคาต่อหน่วย (เหมือน INVapp editValue)">
              <span style="border-bottom: 1px dashed #94a3b8;">${(grp.unit_price || 0).toFixed(2)}</span> <span style="font-size: 0.7rem; color: #64748b;">✎</span>
            </td>
            <td style="text-align: center;">
              <span style="font-weight: 700; font-size: 0.95rem; color: #0f172a;">${grp.quantity}</span> <span style="font-size: 0.75rem; color: #64748b;">${grp.unit}</span>
            </td>
            <td class="td-sum-val">
              ${grp.line_total.toFixed(2)}
            </td>
          </tr>
        `;
      });
    } else {
      // Itemized view
      if (itemsCountEl) {
        itemsCountEl.innerText = `${this.cart.length} รายการย่อย (${totalUnits} ชิ้น)`;
      }

      this.cart.forEach((item, index) => {
        const lineTotal = item.unit_price * item.quantity;
        subtotal += lineTotal;

        html += `
          <tr>
            <td style="text-align: center;">
              <button class="td-at-btn" onclick="POS.removeFromCart('${item.product_id}')" title="ลบรายการนี้">✕</button>
            </td>
            <td>
              <span class="td-product-name" title="${item.name}">${item.name}</span>
              <div style="display: flex; gap: 4px; align-items: center;">
                <span class="td-product-code">${item.product_id}</span>
                ${item.promo_name ? `<span style="font-size: 0.68rem; background: #fef3c7; color: #b45309; padding: 1px 4px; border-radius: 3px;">${item.promo_name}</span>` : ''}
              </div>
            </td>
            <td style="text-align: right; padding-right: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.86rem; color: #334155; cursor: pointer;" onclick="POS.editItemPrice('${item.product_id}')" title="คลิกเพื่อแก้ไขราคาต่อหน่วย">
              <span style="border-bottom: 1px dashed #94a3b8;">${(item.unit_price || 0).toFixed(2)}</span> <span style="font-size: 0.7rem; color: #64748b;">✎</span>
            </td>
            <td style="text-align: center;">
              <div class="td-qty-wrap">
                <button class="td-qty-btn" onclick="POS.updateQuantity('${item.product_id}', -1)">-</button>
                <input type="text" class="td-qty-val" value="${item.quantity}" onchange="POS.setQuantity('${item.product_id}', this.value)" onclick="this.select()">
                <button class="td-qty-btn" onclick="POS.updateQuantity('${item.product_id}', 1)">+</button>
              </div>
            </td>
            <td class="td-sum-val">
              ${lineTotal.toFixed(2)}
            </td>
          </tr>
        `;
      });
    }

    if (tbody) tbody.innerHTML = html;

    const netTotal = Math.max(0, subtotal - this.discount);

    // Large total price display at top (e.g. "125.00" or "0.")
    if (topTotalBox) {
      topTotalBox.innerText = netTotal > 0 
        ? `${netTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
        : '0.';
    }

    if (discountIndicator && discountVal) {
      if (this.discount > 0) {
        discountIndicator.style.display = 'inline';
        discountVal.innerText = this.discount.toFixed(2);
      } else {
        discountIndicator.style.display = 'none';
      }
    }

    if (submitBtn) submitBtn.disabled = false;
  },

  // ---------------------- Payment & Checkout Modal ----------------------
  openPaymentModal: function() {
    if (!this.cart.length) return;
    const modal = document.getElementById('payment-modal');
    const netTotal = this.getNetTotal();

    document.getElementById('modal-pay-total').innerText = `฿${netTotal.toFixed(2)}`;
    const receivedInput = document.getElementById('received-amount-input');
    receivedInput.value = netTotal.toFixed(0);
    this.calculateChange();

    modal.classList.add('active');
    setTimeout(() => {
      receivedInput.focus();
      receivedInput.select();
    }, 100);
  },

  getNetTotal: function() {
    const subtotal = this.cart.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
    return Math.max(0, subtotal - this.discount);
  },

  setQuickCash: function(amount) {
    const input = document.getElementById('received-amount-input');
    if (amount === 'exact') {
      input.value = this.getNetTotal().toFixed(2);
    } else {
      input.value = amount;
    }
    this.calculateChange();
  },

  appendNumpad: function(val) {
    const input = document.getElementById('received-amount-input');
    if (val === 'C') {
      input.value = '';
    } else if (val === 'BS') {
      input.value = input.value.slice(0, -1);
    } else {
      input.value += val;
    }
    this.calculateChange();
  },

  calculateChange: function() {
    const input = document.getElementById('received-amount-input');
    const changeDisplay = document.getElementById('modal-change-display');
    const netTotal = this.getNetTotal();
    const received = parseFloat(input.value || 0);

    const change = received - netTotal;
    if (change >= 0) {
      changeDisplay.innerText = `฿${change.toFixed(2)}`;
      changeDisplay.style.color = '#15803d';
    } else {
      changeDisplay.innerText = `ยังขาดอีก ฿${Math.abs(change).toFixed(2)}`;
      changeDisplay.style.color = '#dc2626';
    }
  },

  confirmCheckout: async function() {
    const netTotal = this.getNetTotal();
    const receivedInput = document.getElementById('received-amount-input');
    const received = parseFloat(receivedInput.value || 0);

    if (received < netTotal) {
      POSSound.error();
      showToast('จำนวนเงินที่รับมาน้อยกว่ายอดชำระ', 'error');
      return;
    }

    try {
      const payload = {
        items: this.cart,
        discount: this.discount,
        received_amount: received
      };

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!json.success) {
        showToast(json.message || 'บันทึกบิลไม่สำเร็จ', 'error');
        return;
      }

      POSSound.cashRegister();
      this.closeAllModals();
      showToast(`บันทึกบิล #${json.data.bill_id} สำเร็จ! เงินทอน ฿${json.data.change.toFixed(2)}`, 'success');

      // Show Receipt Slip Dialog
      this.showReceipt(json.data);

      // Reset cart
      this.cart = [];
      this.discount = 0;
      this.renderCart();
    } catch (e) {
      console.error('Checkout error:', e);
      showToast('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  },

  // ---------------------- Thermal Receipt Modal ----------------------
  showReceipt: function(bill) {
    const slipArea = document.getElementById('thermal-slip-area');
    const modal = document.getElementById('receipt-modal');

    let itemsHtml = '';
    bill.items.forEach(i => {
      itemsHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>${i.name} x${i.quantity}</span>
          <span>฿${(i.unit_price * i.quantity).toFixed(2)}</span>
        </div>
      `;
    });

    slipArea.innerHTML = `
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 13px; line-height: 1.4; color: #000; padding: 10px; background: #fff; border-radius: 4px;">
        <div style="text-align: center; margin-bottom: 10px;">
          <h2 style="font-size: 18px; margin: 0;">ร้านบัวเงิน</h2>
          <p style="margin: 2px 0;">ระบบจัดการสินค้า & POS</p>
          <p style="font-size: 11px; margin: 0;">เลขที่บิล: #${bill.bill_id}</p>
          <p style="font-size: 11px; margin: 0;">วันที่: ${bill.date}</p>
        </div>
        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
        ${itemsHtml}
        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>
        <div style="display: flex; justify-content: space-between;">
          <span>ยอดรวม:</span>
          <span>฿${bill.total.toFixed(2)}</span>
        </div>
        ${bill.discount > 0 ? `
          <div style="display: flex; justify-content: space-between;">
            <span>ส่วนลด:</span>
            <span>-฿${bill.discount.toFixed(2)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin: 4px 0;">
          <span>ยอดสุทธิ:</span>
          <span>฿${bill.net_amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>รับเงิน:</span>
          <span>฿${bill.received_amount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>เงินทอน:</span>
          <span>฿${bill.change.toFixed(2)}</span>
        </div>
        <div style="border-top: 1px dashed #000; margin: 10px 0;"></div>
        <div style="text-align: center; font-size: 12px;">
          ขอบคุณที่ใช้บริการ 🙏
        </div>
      </div>
    `;

    modal.classList.add('active');
  },

  printReceipt: function() {
    window.print();
  },

  // ---------------------- Hold Bill ----------------------
  openHoldModal: async function() {
    if (!this.cart.length) {
      showToast('ไม่มีรายการสินค้าที่จะพักบิล', 'warning');
      return;
    }
    const title = prompt('ชื่อหรือหมายเหตุสำหรับพักบิลนี้ (เช่น ลูกค้าหน้าร้าน หรือ โต๊ะ 1):', `บิล #${this.heldBills.length + 1}`);
    if (title === null) return;

    try {
      const res = await fetch('/api/bills/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, items: this.cart, discount: this.discount })
      });
      const json = await res.json();
      if (json.success) {
        showToast('พักบิลเรียบร้อยแล้ว (F2)', 'success');
        this.cart = [];
        this.discount = 0;
        this.renderCart();
        this.loadHeldBills();
      }
    } catch (e) {
      showToast('เกิดข้อผิดพลาดในการพักบิล', 'error');
    }
  },

  loadHeldBills: async function() {
    try {
      const res = await fetch('/api/bills/held');
      const json = await res.json();
      if (json.success) {
        this.heldBills = json.data;
        const badgeTop = document.getElementById('held-bills-badge-top');
        if (badgeTop) {
          badgeTop.innerText = `${this.heldBills.length} บิล`;
        }
      }
    } catch (e) {}
  },

  showHeldBillsList: function() {
    const modal = document.getElementById('held-bills-modal');
    const list = document.getElementById('held-bills-list');

    if (!this.heldBills.length) {
      list.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-dim);">ไม่มีบิลที่พักไว้</div>`;
    } else {
      let html = '';
      this.heldBills.forEach(b => {
        const total = b.items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0) - (b.discount || 0);
        html += `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 8px;">
            <div>
              <div style="font-weight: 600;">${b.title}</div>
              <div style="font-size: 0.8rem; color: var(--text-dim);">${b.items.length} รายการ (${b.time})</div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-family: 'JetBrains Mono'; font-weight: 700; color: #10b981;">฿${total.toFixed(2)}</span>
              <button class="btn-xs" style="background: var(--accent-primary); color: #fff;" onclick="POS.resumeHeldBill('${b.id}')">เรียกบิล</button>
              <button class="btn-xs btn-danger" onclick="POS.deleteHeldBill('${b.id}')">ลบ</button>
            </div>
          </div>
        `;
      });
      list.innerHTML = html;
    }
    modal.classList.add('active');
  },

  resumeHeldBill: function(id) {
    const bill = this.heldBills.find(b => b.id === id);
    if (!bill) return;

    if (this.cart.length > 0) {
      if (!confirm('มีสินค้าในบิลปัจจุบันอยู่ การเรียกบิลพักจะแทนที่ตะกร้านี้ ยืนยันหรือไม่?')) return;
    }

    this.cart = bill.items;
    this.discount = bill.discount || 0;
    this.deleteHeldBill(id, false);
    this.renderCart();
    this.closeAllModals();
    showToast(`เรียกบิล "${bill.title}" กลับมาแล้ว`, 'success');
  },

  deleteHeldBill: async function(id, alertUser = true) {
    try {
      await fetch(`/api/bills/held/${id}`, { method: 'DELETE' });
      await this.loadHeldBills();
      if (alertUser) {
        this.showHeldBillsList();
        showToast('ลบบิลพักแล้ว', 'warning');
      }
    } catch (e) {}
  },

  // ---------------------- Discounts ----------------------
  openDiscountModal: function() {
    const val = prompt('ใส่จำนวนเงินส่วนลดท้ายบิล (บาท):', this.discount || 0);
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        this.discount = num;
        this.renderCart();
        showToast(`ใส่ส่วนลด ฿${num.toFixed(2)} แล้ว`, 'success');
      }
    }
  },

  // ---------------------- Promotion Management (Matching INVapp types/promotion) ----------------------
  openPromotionModal: async function() {
    const modal = document.getElementById('promotion-manager-modal');
    if (!modal) return;

    // Populate category filter if needed
    const catSelect = document.getElementById('promo-cat-filter');
    if (catSelect && catSelect.options.length <= 1) {
      if (this.allCategories && this.allCategories.length) {
        this.allCategories.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.category_id;
          opt.innerText = c.name;
          catSelect.appendChild(opt);
        });
      }
    }

    this.showPromotionTypesView();
    modal.classList.add('active');
    await this.loadPromotionTypes();
  },

  closePromotionModal: function() {
    const modal = document.getElementById('promotion-manager-modal');
    if (modal) modal.classList.remove('active');
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) barcodeInput.focus();
  },

  showPromotionTypesView: function() {
    const viewList = document.getElementById('promo-view-types-list');
    const viewDetail = document.getElementById('promo-view-detail');
    const viewPicker = document.getElementById('promo-view-picker');
    if (viewList) viewList.style.display = 'block';
    if (viewDetail) viewDetail.style.display = 'none';
    if (viewPicker) viewPicker.style.display = 'none';
    this.closeTierForm();
  },

  loadPromotionTypes: async function() {
    const countLabel = document.getElementById('promo-types-count-label');
    const grid = document.getElementById('promo-types-grid');
    if (countLabel) countLabel.innerText = 'กำลังโหลดข้อมูลโปรโมชั่น...';

    try {
      const res = await fetch('/api/promotions/types');
      const json = await res.json();
      if (!json.success || !json.data) {
        if (countLabel) countLabel.innerText = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
        return;
      }

      this.promotionTypes = json.data;
      this.renderPromotionTypes(this.promotionTypes);
    } catch (e) {
      console.error('Error loading promotion types:', e);
      if (countLabel) countLabel.innerText = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์';
    }
  },

  renderPromotionTypes: function(typesList) {
    const countLabel = document.getElementById('promo-types-count-label');
    const grid = document.getElementById('promo-types-grid');
    if (!grid) return;

    let totalTiers = 0;
    typesList.forEach(t => totalTiers += (t.promotions ? t.promotions.length : 0));

    if (countLabel) {
      countLabel.innerText = `พบ ${typesList.length} ประเภทสินค้าที่มีโปรโมชั่น (รวม ${totalTiers} เงื่อนไข)`;
    }

    if (!typesList.length) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">ไม่พบประเภทสินค้าที่ตรงกับคำค้นหา</div>`;
      return;
    }

    let html = '';
    typesList.forEach(t => {
      const catFallbackPic = this.getCategoryPic(t.category_id) || '/img/products/yean_1.gif';
      const resolvedImg = t.resolved_pic || catFallbackPic;
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
        tiersHtml = `<div style="font-size: 0.8rem; color: #94a3b8;">ยังไม่มีระดับโปรโมชั่นที่บันทึกไว้</div>`;
      }

      html += `
        <div class="promo-type-card" onclick="POS.openTypePromotions(${t.type_id})">
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
            <span style="font-size: 0.78rem; color: #64748b;">${t.promotions ? t.promotions.length : 0} ระดับโปรโมชั่น</span>
            <button type="button" class="btn-xs" style="padding: 2px 8px; font-size: 0.78rem; font-weight: 700;">
              ⚙️ จัดการโปรโมชั่น →
            </button>
          </div>
        </div>
      `;
    });

    grid.innerHTML = html;
  },

  filterPromotionTypes: function(searchTerm) {
    if (!this.promotionTypes) return;
    const searchVal = (searchTerm !== undefined ? searchTerm : (document.getElementById('promo-search-input') ? document.getElementById('promo-search-input').value : '')).trim().toLowerCase();
    const catVal = document.getElementById('promo-cat-filter') ? document.getElementById('promo-cat-filter').value : '';

    const filtered = this.promotionTypes.filter(t => {
      const matchName = (t.name || '').toLowerCase().includes(searchVal);
      const matchSerial = (t.serial_id || '').toLowerCase().includes(searchVal);
      const matchCat = !catVal || t.category_id == catVal;
      return (matchName || matchSerial) && matchCat;
    });

    this.renderPromotionTypes(filtered);
  },

  openTypePromotions: async function(typeId) {
    try {
      const res = await fetch(`/api/promotions/types/${typeId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        showToast('ไม่สามารถโหลดข้อมูลโปรโมชั่นของสินค้านี้ได้', 'error');
        return;
      }

      this.activePromoType = json.data.type;
      const promotions = json.data.promotions || [];

      // Switch view
      document.getElementById('promo-view-types-list').style.display = 'none';
      document.getElementById('promo-view-detail').style.display = 'block';
      document.getElementById('promo-view-picker').style.display = 'none';
      this.closeTierForm();

      // Render Hero Card
      const hero = document.getElementById('promo-type-hero');
      const catFallbackPic = this.getCategoryPic(this.activePromoType.category_id) || '/img/products/yean_1.gif';
      const resolvedImg = this.activePromoType.resolved_pic || catFallbackPic;
      const basePrice = this.activePromoType.sale_price ? parseFloat(this.activePromoType.sale_price).toFixed(2) : '0.00';

      hero.innerHTML = `
        <div class="promo-hero-img-box">
          <img src="${resolvedImg}" alt="${this.activePromoType.name}" class="promo-hero-img" onerror="this.src='/img/products/yean_1.gif'">
        </div>
        <div class="promo-hero-details">
          <h3>${this.activePromoType.name}</h3>
          <div class="promo-hero-meta">
            <span>รหัสนำหน้า (Serial): <b style="color: #3730a3;">${this.activePromoType.serial_id || '-'}</b></span>
            <span>หมวดหมู่: <b>${this.activePromoType.category_name || '-'}</b></span>
            <span>ราคาขายปลีกปกติ: <b style="color: #15803d; font-size: 1.05rem;">฿${basePrice}</b> / ชิ้น</span>
          </div>
        </div>
      `;

      // Render Tiers Table
      this.renderPromotionTiersTable(promotions, parseFloat(basePrice));

      // Render Variant Custom Pricing Table
      this.loadTypeCustomPricingVariants(typeId);
    } catch (e) {
      console.error('Error opening type promotions:', e);
      showToast('เกิดข้อผิดพลาดในการโหลดโปรโมชั่น', 'error');
    }
  },

  renderPromotionTiersTable: function(promotions, basePrice) {
    const tbody = document.getElementById('promo-tiers-table-body');
    if (!tbody) return;

    if (!promotions.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">
            ยังไม่มีระดับโปรโมชั่นสำหรับประเภทสินค้านี้ คลิก <b>"➕ เพิ่มระดับโปรโมชั่น"</b> ด้านบนเพื่อสร้างใหม่
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
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td>
            <b style="color: #78350f; font-size: 0.95rem;">${p.name}</b>
            ${p.detail ? `<div style="font-size: 0.78rem; color: #64748b;">${p.detail}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: 700; font-size: 1rem; color: #1e293b;">${p.limit}</td>
          <td style="text-align: right; font-weight: 700; font-size: 1rem; color: #b45309;">฿${parseFloat(p.price).toFixed(2)}</td>
          <td style="text-align: right; color: #475569; font-size: 0.88rem;">฿${perUnit.toFixed(2)}</td>
          <td style="text-align: right;">
            ${saveAmount > 0 
              ? `<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.82rem;">ประหยัด ฿${saveAmount.toFixed(0)} (-${savePercent}%)</span>` 
              : '<span style="color: #94a3b8; font-size: 0.8rem;">-</span>'}
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 6px; justify-content: center;">
              <button type="button" class="btn-xs" style="padding: 2px 8px; font-size: 0.8rem;" onclick='POS.openTierForm(${JSON.stringify(p)})'>
                ✏️ แก้ไข
              </button>
              <button type="button" class="btn-xs danger" style="padding: 2px 8px; font-size: 0.8rem;" onclick="POS.deletePromotionTier(${p.type_id}, ${p.id})">
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
    const card = document.getElementById('promo-tier-form-card');
    const title = document.getElementById('promo-tier-form-title');
    const idInput = document.getElementById('tier-form-id');
    const typeIdInput = document.getElementById('tier-form-type-id');
    const nameInput = document.getElementById('tier-form-name');
    const limitInput = document.getElementById('tier-form-limit');
    const priceInput = document.getElementById('tier-form-price');
    const detailInput = document.getElementById('tier-form-detail');

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
      if (title) title.innerText = `➕ เพิ่มระดับโปรโมชั่นใหม่สำหรับ: ${this.activePromoType ? this.activePromoType.name : ''}`;
      if (idInput) idInput.value = '';
      if (typeIdInput) typeIdInput.value = this.activePromoType ? this.activePromoType.type_id : '';
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
    const card = document.getElementById('promo-tier-form-card');
    if (card) card.style.display = 'none';
  },

  savePromotionTier: async function() {
    const id = document.getElementById('tier-form-id').value;
    const typeId = document.getElementById('tier-form-type-id').value;
    const name = document.getElementById('tier-form-name').value.trim();
    const limit = parseInt(document.getElementById('tier-form-limit').value);
    const price = parseFloat(document.getElementById('tier-form-price').value);
    const detail = document.getElementById('tier-form-detail').value.trim();

    if (!name || isNaN(limit) || limit <= 0 || isNaN(price) || price < 0) {
      showToast('กรุณากรอกชื่อโปรโมชั่น, จำนวนชิ้น และราคาให้ถูกต้อง', 'warning');
      return;
    }

    const payload = {
      type_id: typeId,
      promotion_id: this.activePromoType ? (this.activePromoType.serial_id || '') : '',
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
        await this.openTypePromotions(typeId);
        // Refresh master types list in background
        this.loadPromotionTypes();
      } else {
        showToast(json.message || 'บันทึกไม่สำเร็จ', 'error');
      }
    } catch (e) {
      console.error('Error saving promotion tier:', e);
      showToast('เกิดข้อผิดพลาดในการบันทึกโปรโมชั่น', 'error');
    }
  },

  deletePromotionTier: async function(typeId, promoId) {
    if (!confirm('คุณต้องการลบระดับโปรโมชั่นนี้ใช่หรือไม่?')) return;

    try {
      const res = await fetch(`/api/promotions/${promoId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        showToast('ลบโปรโมชั่นเรียบร้อยแล้ว', 'info');
        await this.openTypePromotions(typeId);
        this.loadPromotionTypes();
      } else {
        showToast(json.message || 'ลบไม่สำเร็จ', 'error');
      }
    } catch (e) {
      console.error('Error deleting promo tier:', e);
      showToast('เกิดข้อผิดพลาดในการลบโปรโมชั่น', 'error');
    }
  },

  openAddPromotionTypePicker: async function() {
    document.getElementById('promo-view-types-list').style.display = 'none';
    document.getElementById('promo-view-detail').style.display = 'none';
    document.getElementById('promo-view-picker').style.display = 'block';

    const grid = document.getElementById('promo-picker-grid');
    grid.innerHTML = '<div style="text-align: center; padding: 24px; color: #64748b;">กำลังโหลดรายการประเภทสินค้าทั้งหมด...</div>';

    try {
      const res = await fetch('/api/types');
      const json = await res.json();
      this.allTypesCache = (json && json.success) ? json.data : [];
      this.renderPickerTypes(this.allTypesCache);
    } catch (e) {
      console.error('Error loading types for picker:', e);
      grid.innerHTML = '<div style="text-align: center; padding: 24px; color: #dc2626;">เกิดข้อผิดพลาดในการโหลดรายการ</div>';
    }
  },

  renderPickerTypes: function(typesList) {
    const grid = document.getElementById('promo-picker-grid');
    if (!grid) return;

    if (!typesList.length) {
      grid.innerHTML = '<div style="text-align: center; padding: 24px; color: #64748b;">ไม่พบประเภทสินค้าที่ค้นหา</div>';
      return;
    }

    let html = '';
    typesList.forEach(t => {
      const catFallbackPic = this.getCategoryPic(t.category_id) || '/img/products/yean_1.gif';
      const resolvedImg = t.resolved_pic || catFallbackPic;
      const basePrice = t.sale_price ? `฿${parseFloat(t.sale_price).toFixed(2)}` : '-';

      html += `
        <div class="promo-type-card" onclick="POS.openTypePromotions(${t.type_id}); POS.openTierForm(null);">
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
  },

  // ---------------------- Variant Custom Pricing & Promotions Modal ----------------------
  openVariantPricingModal: async function(targetProdId = null) {
    let target = null;
    if (targetProdId) {
      target = this.modalProducts ? this.modalProducts.find(p => p.product_id === targetProdId) : null;
    }
    if (!target && this.activeMatchedProduct) {
      target = this.activeMatchedProduct;
    }
    if (!target) {
      const codeVal = (document.getElementById('item-modal-code')?.value || '').trim();
      const type = this.activeModalType;
      const serial = type ? (type.serial_id || '') : '';
      if (codeVal && this.modalProducts) {
        target = this.modalProducts.find(p => 
          (p.code && p.code.toUpperCase() === codeVal.toUpperCase()) || 
          (p.product_id && p.product_id.toUpperCase() === (serial + codeVal).toUpperCase()) ||
          (p.product_id && p.product_id.toUpperCase() === codeVal.toUpperCase())
        );
      }
    }

    if (!target) {
      showToast('กรุณาระบุหรือคลิกเลือกรหัสสินค้าที่ต้องการกำหนดราคาก่อน', 'warning');
      const codeInput = document.getElementById('item-modal-code');
      if (codeInput) codeInput.focus();
      return;
    }

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(target.product_id)}/pricing-info`);
      const json = await res.json();
      if (!json.success || !json.data) {
        showToast(json.message || 'ไม่สามารถโหลดข้อมูลสินค้าได้', 'error');
        return;
      }

      const { product, type_price, type_promotions, custom_price, custom_promotions, has_custom_price, has_custom_promo } = json.data;
      this.activeVPCustomProduct = product;
      this.activeVPTypePrice = type_price;

      document.getElementById('vp-product-id').value = product.product_id;
      document.getElementById('vp-badge-product-id').innerText = product.product_id;
      document.getElementById('vp-title-product-name').innerText = `${product.product || (this.activeModalType ? this.activeModalType.name : '')} (#${product.code || product.product_id})`;
      document.getElementById('vp-meta-type-name').innerText = `ประเภท: ${product.type_name || (this.activeModalType ? this.activeModalType.name : '-')}`;
      document.getElementById('vp-standard-price').innerText = `฿${parseFloat(type_price || 0).toFixed(2)}`;

      const promoTexts = (type_promotions && type_promotions.length)
        ? type_promotions.map(p => `${p.name} (${p.limit} ชิ้น = ฿${parseFloat(p.price).toFixed(0)})`).join(' | ')
        : 'ไม่มีโปรโมชั่นมาตรฐาน';
      document.getElementById('vp-standard-promos-text').innerText = promoTexts;

      // Fix sale price input
      const priceInput = document.getElementById('vp-sale-price-input');
      if (priceInput) {
        priceInput.value = (has_custom_price && custom_price > 0) ? parseFloat(custom_price).toFixed(2) : parseFloat(type_price || 0).toFixed(2);
      }

      // Render tiers
      const tiersList = document.getElementById('vp-tiers-list');
      if (tiersList) {
        tiersList.innerHTML = '';
        if (custom_promotions && custom_promotions.length > 0) {
          custom_promotions.forEach(t => this.addVPTierRow(t));
        } else {
          // If no custom promo yet, prepopulate an empty row or sample tier
          this.addVPTierRow({ name: '6 ชิ้น', limit: 6, price: 70, detail: '' });
        }
      }

      this.updateVPPreview();

      const modal = document.getElementById('variant-pricing-modal');
      if (modal) modal.classList.add('active');
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการโหลดข้อมูลกำหนดราคา', 'error');
    }
  },

  closeVariantPricingModal: function() {
    const modal = document.getElementById('variant-pricing-modal');
    if (modal) modal.classList.remove('active');
  },

  setVPPriceToStandard: function() {
    const priceInput = document.getElementById('vp-sale-price-input');
    if (priceInput && this.activeVPTypePrice !== undefined) {
      priceInput.value = parseFloat(this.activeVPTypePrice || 0).toFixed(2);
      this.updateVPPreview();
    }
  },

  addVPTierRow: function(tier = {}) {
    const tiersList = document.getElementById('vp-tiers-list');
    if (!tiersList) return;

    const row = document.createElement('div');
    row.className = 'vp-tier-row';
    row.innerHTML = `
      <div style="flex: 2;">
        <label style="font-size: 0.72rem; color: #64748b; display: block;">ชื่อโปรโมชั่น:</label>
        <input type="text" class="vp-tier-name" value="${tier.name || ''}" placeholder="เช่น 6 ชิ้น หรือ 1 pack" style="width: 100%;">
      </div>
      <div style="width: 90px;">
        <label style="font-size: 0.72rem; color: #64748b; display: block;">จำนวนชิ้น:</label>
        <input type="number" class="vp-tier-limit" value="${tier.limit || ''}" min="1" placeholder="เช่น 6" style="width: 100%; text-align: center; font-weight: 700;" oninput="POS.updateVPPreview()">
      </div>
      <div style="width: 110px;">
        <label style="font-size: 0.72rem; color: #64748b; display: block;">ราคาเหมา (฿):</label>
        <input type="number" class="vp-tier-price" value="${tier.price !== undefined ? tier.price : ''}" step="0.25" min="0" placeholder="เช่น 70" style="width: 100%; text-align: right; font-weight: 700; color: #b45309;" oninput="POS.updateVPPreview()">
      </div>
      <div style="padding-top: 14px;">
        <button type="button" class="btn-xs danger" style="height: 34px; padding: 0 10px;" onclick="POS.removeVPTierRow(this)" title="ลบขั้นนี้">✕</button>
      </div>
    `;
    tiersList.appendChild(row);
    this.updateVPPreview();
  },

  removeVPTierRow: function(btn) {
    const row = btn.closest('.vp-tier-row');
    if (row) {
      row.remove();
      this.updateVPPreview();
    }
  },

  updateVPPreview: function() {
    const previewBox = document.getElementById('vp-preview-box');
    if (!previewBox) return;

    const unitPrice = parseFloat(document.getElementById('vp-sale-price-input')?.value || 0);
    const rows = document.querySelectorAll('#vp-tiers-list .vp-tier-row');

    let html = `<div style="font-weight: 700; margin-bottom: 4px;">สรุปผลการกำหนดราคา:</div>`;
    html += `<div>• ราคาขายต่อชิ้น: <b style="color:#0f172a;">฿${unitPrice.toFixed(2)}</b> / ชิ้น</div>`;

    if (rows.length === 0) {
      html += `<div>• ไม่มีโปรโมชั่นเหมาสำหรับรหัสนี้ (ขายราคาต่อชิ้นปกติ)</div>`;
    } else {
      rows.forEach(r => {
        const name = r.querySelector('.vp-tier-name')?.value.trim() || 'โปร';
        const limit = parseInt(r.querySelector('.vp-tier-limit')?.value);
        const price = parseFloat(r.querySelector('.vp-tier-price')?.value);
        if (!isNaN(limit) && limit > 0 && !isNaN(price) && price >= 0) {
          const normalCost = unitPrice * limit;
          const save = normalCost - price;
          const perUnit = price / limit;
          html += `<div>• <b>${name} (${limit} ชิ้น = ฿${price.toFixed(2)})</b>: เฉลี่ยชิ้นละ ฿${perUnit.toFixed(2)} ${save > 0 ? `<span style="color:#15803d; font-weight:700;">(ประหยัด ฿${save.toFixed(2)})</span>` : ''}</div>`;
        }
      });
    }

    previewBox.innerHTML = html;
  },

  saveCustomPricing: async function() {
    const productId = document.getElementById('vp-product-id').value;
    const salePrice = parseFloat(document.getElementById('vp-sale-price-input').value || 0);

    const rows = document.querySelectorAll('#vp-tiers-list .vp-tier-row');
    const tiers = [];
    rows.forEach(r => {
      const name = r.querySelector('.vp-tier-name')?.value.trim();
      const limit = parseInt(r.querySelector('.vp-tier-limit')?.value);
      const price = parseFloat(r.querySelector('.vp-tier-price')?.value);
      if (!isNaN(limit) && limit > 0 && !isNaN(price) && price >= 0) {
        tiers.push({
          name: name || `${limit} ชิ้น`,
          limit,
          price,
          detail: 'ราคาพิเศษเฉพาะรหัสนี้'
        });
      }
    });

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/custom-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sale_price: salePrice, tiers })
      });
      const json = await res.json();

      if (json.success) {
        showToast(json.message || 'บันทึกราคาและโปรโมชั่นเรียบร้อย', 'success');
        this.closeVariantPricingModal();

        // Refresh type products and update open item modal immediately
        if (this.activeModalType) {
          const prodRes = await fetch(`/api/types/${this.activeModalType.type_id}/products`);
          const prodJson = await prodRes.json();
          if (prodJson.success) {
            this.modalProducts = prodJson.data || [];
            this.renderModalVariantBadges(this.modalProducts, this.activeModalType.sale_price);
            
            // Re-trigger code match on current input
            const codeInput = document.getElementById('item-modal-code');
            if (codeInput) {
              this.onModalCodeChange(codeInput.value);
            }
          }
        }
      } else {
        showToast(json.message || 'เกิดข้อผิดพลาดในการบันทึก', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
  },

  resetCustomPricingToDefault: async function() {
    const productId = document.getElementById('vp-product-id').value;
    if (!confirm(`คุณต้องการล้างราคาและโปรโมชั่นพิเศษของรหัส ${productId} แล้วกลับไปใช้ราคามาตรฐานใช่หรือไม่?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/custom-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_to_default: true })
      });
      const json = await res.json();

      if (json.success) {
        showToast(json.message || 'คืนค่าเริ่มต้นเรียบร้อย', 'info');
        this.closeVariantPricingModal();

        // Refresh type products
        if (this.activeModalType) {
          const prodRes = await fetch(`/api/types/${this.activeModalType.type_id}/products`);
          const prodJson = await prodRes.json();
          if (prodJson.success) {
            this.modalProducts = prodJson.data || [];
            this.renderModalVariantBadges(this.modalProducts, this.activeModalType.sale_price);

            const codeInput = document.getElementById('item-modal-code');
            if (codeInput) {
              this.onModalCodeChange(codeInput.value);
            }
          }
        }
      } else {
        showToast(json.message || 'เกิดข้อผิดพลาดในการรีเซ็ต', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    }
  },

  openAddVariantCustomPricingPicker: async function() {
    if (!this.activePromoType) return;
    const typeId = this.activePromoType.type_id;
    try {
      const res = await fetch(`/api/types/${typeId}/products`);
      const json = await res.json();
      if (!json.success || !json.data || !json.data.length) {
        showToast('ไม่พบรายการรหัสย่อยในประเภทสินค้านี้', 'warning');
        return;
      }
      this.modalProducts = json.data;
      this.activeModalType = this.activePromoType;

      const code = prompt(`กรุณาระบุรหัสสินค้า หรือเบอร์สี ของ "${this.activePromoType.name}" ที่ต้องการ Fix ราคา/โปรโมชั่น:\n(ตัวอย่างเช่น 6010 หรือ ${this.activePromoType.serial_id || ''}6010)`);
      if (!code || !code.trim()) return;
      const clean = code.trim().toUpperCase();
      const serial = (this.activePromoType.serial_id || '').toUpperCase();
      let match = json.data.find(p => 
        (p.code && p.code.toUpperCase() === clean) || 
        (p.product_id && p.product_id.toUpperCase() === clean) ||
        (p.product_id && p.product_id.toUpperCase() === (serial + clean))
      );
      if (!match) {
        showToast(`ไม่พบรหัสสินค้า "${code}" ในหมวดหมู่นี้`, 'error');
        return;
      }
      this.activeMatchedProduct = match;
      this.openVariantPricingModal(match.product_id);
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการโหลดรายการสินค้า', 'error');
    }
  },

  loadTypeCustomPricingVariants: async function(typeId) {
    const tbody = document.getElementById('promo-variants-table-body');
    if (!tbody) return;

    try {
      const res = await fetch(`/api/types/${typeId}/custom-pricing-products`);
      const json = await res.json();
      const list = (json.success && json.data) ? json.data : [];

      if (!list.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 20px; color: #64748b;">
              ยังไม่มีสินค้ารหัสย่อยที่ Fix ราคาหรือโปรโมชั่นเฉพาะ (ทุกรหัสย่อยใช้ราคาและโปรตามประเภทมาตรฐาน)
            </td>
          </tr>
        `;
        return;
      }

      let html = '';
      list.forEach((p, idx) => {
        const promoStr = (p.custom_promotions && p.custom_promotions.length)
          ? p.custom_promotions.map(t => `<span class="badge-custom-price-tag">${t.name} (${t.limit} ชิ้น = ฿${t.price})</span>`).join(' ')
          : '<span style="color:#94a3b8; font-size:0.8rem;">(ตามประเภทปกติ)</span>';

        const priceStr = p.sale_price > 0 
          ? `<b style="color:#b45309; font-size:0.95rem;">฿${parseFloat(p.sale_price).toFixed(2)}</b>` 
          : '<span style="color:#94a3b8;">(ตามประเภท)</span>';

        html += `
          <tr>
            <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
            <td><span class="vp-product-id-badge">${p.product_id}</span></td>
            <td><b>${p.code || '-'}</b> <span style="font-size:0.8rem; color:#64748b;">${p.product || ''}</span></td>
            <td style="text-align: right;">${priceStr}</td>
            <td>${promoStr}</td>
            <td style="text-align: center;">
              <div style="display: flex; gap: 6px; justify-content: center;">
                <button type="button" class="btn-xs" style="padding: 2px 8px;" onclick="POS.openVariantPricingModal('${p.product_id}')">
                  ⚙️ แก้ไข
                </button>
                <button type="button" class="btn-xs danger" style="padding: 2px 8px;" onclick="POS.quickResetVariantPricing('${p.product_id}')" title="คืนค่าเป็นราคามาตรฐาน">
                  🔄 รีเซ็ต
                </button>
              </div>
            </td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (e) {
      console.error(e);
    }
  },

  quickResetVariantPricing: async function(productId) {
    if (!confirm(`คุณต้องการล้างราคาและโปรโมชั่นพิเศษของ ${productId} ใช่หรือไม่?`)) return;
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}/custom-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_to_default: true })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || 'รีเซ็ตเรียบร้อย', 'info');
        if (this.activePromoType) {
          this.loadTypeCustomPricingVariants(this.activePromoType.type_id);
        }
      }
    } catch (e) {
      console.error(e);
      showToast('เกิดข้อผิดพลาดในการรีเซ็ต', 'error');
    }
  },

  closeAllModals: function() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
    const barcodeInput = document.getElementById('barcode-input');
    if (barcodeInput) barcodeInput.focus();
  }
};


// Global Toast Notification Helper
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Live Clock in Header
setInterval(() => {
  const clockEl = document.getElementById('live-clock');
  if (clockEl) {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString('th-TH');
  }
}, 1000);

document.addEventListener('DOMContentLoaded', () => {
  POS.init();
});
