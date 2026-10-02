// ==========================================================================
// POS CASHIER & CART LOGIC
// ==========================================================================

const POS = {
  cart: [],
  discount: 0,
  selectedCategory: null,
  selectedType: null,
  heldBills: [],
  currentBillId: null,

  init: function() {
    this.bindEvents();
    this.loadCategories();
    this.loadProducts();
    this.loadHeldBills();
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

    // Live search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.loadProducts(searchInput.value);
        }, 250);
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // F1: Focus Barcode
      if (e.key === 'F1') {
        e.preventDefault();
        barcodeInput.focus();
        barcodeInput.select();
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

  // ---------------------- Catalog Loading ----------------------
  loadCategories: async function() {
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (!json.success) return;

      const container = document.getElementById('categories-bar');
      if (!container) return;

      let html = `<button class="cat-pill active" onclick="POS.selectCategory(null)">✨ ทั้งหมด</button>`;
      json.data.forEach(c => {
        html += `<button class="cat-pill" id="cat-pill-${c.category_id}" onclick="POS.selectCategory(${c.category_id})">${c.name}</button>`;
      });
      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading categories:', e);
    }
  },

  selectCategory: function(categoryId) {
    this.selectedCategory = categoryId;
    this.selectedType = null;

    document.querySelectorAll('.cat-pill').forEach(el => el.classList.remove('active'));
    if (categoryId === null) {
      document.querySelector('.cat-pill').classList.add('active');
    } else {
      const pill = document.getElementById(`cat-pill-${categoryId}`);
      if (pill) pill.classList.add('active');
    }

    // Load types for this category
    this.loadTypes(categoryId);
    this.loadProducts();
  },

  loadTypes: async function(categoryId) {
    const container = document.getElementById('types-bar');
    if (!container) return;

    if (!categoryId) {
      container.innerHTML = '';
      return;
    }

    try {
      const res = await fetch(`/api/types?category_id=${categoryId}`);
      const json = await res.json();
      if (!json.success) return;

      let html = `<button class="type-pill active" onclick="POS.selectType(null)">ทุกประเภท</button>`;
      json.data.forEach(t => {
        html += `<button class="type-pill" id="type-pill-${t.type_id}" onclick="POS.selectType(${t.type_id})">${t.name}</button>`;
      });
      container.innerHTML = html;
    } catch (e) {
      console.error('Error loading types:', e);
    }
  },

  selectType: function(typeId) {
    this.selectedType = typeId;
    document.querySelectorAll('.type-pill').forEach(el => el.classList.remove('active'));
    if (typeId === null) {
      document.querySelector('.type-pill').classList.add('active');
    } else {
      const pill = document.getElementById(`type-pill-${typeId}`);
      if (pill) pill.classList.add('active');
    }
    this.loadProducts();
  },

  loadProducts: async function(query = '') {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    let url = `/api/products?limit=60`;
    if (query) url += `&q=${encodeURIComponent(query)}`;
    if (this.selectedCategory) url += `&category_id=${this.selectedCategory}`;
    if (this.selectedType) url += `&type_id=${this.selectedType}`;

    try {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">กำลังโหลดสินค้า...</div>`;
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success || !json.data.length) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">ไม่พบรายการสินค้า</div>`;
        return;
      }

      let html = '';
      json.data.forEach(p => {
        const isLow = p.quantity <= (p.limit_min || 5);
        html += `
          <div class="product-card" onclick="POS.addToCartByObject(${JSON.stringify(p).replace(/"/g, '&quot;')})">
            <div class="card-top">
              <span class="product-code">${p.product_id || p.code}</span>
              <span class="stock-tag ${isLow ? 'low' : ''}">คงเหลือ ${p.quantity} ${p.unit || ''}</span>
            </div>
            <div class="product-name" title="${p.product}">${p.product}</div>
            <div class="card-bottom">
              <div class="price-box">
                <span class="price-currency">ราคาขาย</span>
                <span class="price-value">฿${(p.sale_price || 0).toFixed(2)}</span>
              </div>
              <span class="unit-label">${p.unit || ''}</span>
            </div>
          </div>
        `;
      });
      grid.innerHTML = html;
    } catch (e) {
      console.error('Error loading products:', e);
    }
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
  addToCartByObject: function(product) {
    POSSound.beep();
    this.addToCart(product);
  },

  addToCart: function(product) {
    const existingIndex = this.cart.findIndex(i => i.product_id === product.product_id);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        product_id: product.product_id,
        name: product.product,
        unit: product.unit || '',
        type_id: product.type_id || '',
        base_price: parseFloat(product.sale_price || 0),
        unit_price: parseFloat(product.sale_price || 0),
        cost: parseFloat(product.cost || 0),
        quantity: 1,
        promotions: product.promotions || []
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
      this.renderCart();
      showToast('ล้างตะกร้าเรียบร้อย', 'warning');
    }
  },

  // ---------------------- Promotion Engine ----------------------
  recalculatePromotions: function() {
    this.cart.forEach(item => {
      let appliedPrice = item.base_price;
      let appliedPromoName = null;

      if (item.promotions && item.promotions.length > 0) {
        // Sort promotions descending by limit so we match the highest tier
        const sorted = [...item.promotions].sort((a, b) => b.limit - a.limit);
        for (const promo of sorted) {
          if (item.quantity >= promo.limit && promo.price > 0) {
            // If price is for package or per unit:
            // In INVapp, promo.price is total for the bundle limit (e.g. 12 pcs = 85 THB)
            appliedPrice = promo.price / promo.limit;
            appliedPromoName = promo.name;
            break;
          }
        }
      }

      item.unit_price = appliedPrice;
      item.promo_name = appliedPromoName;
      item.line_total = item.unit_price * item.quantity;
    });
  },

  // ---------------------- Render Cart ----------------------
  renderCart: function() {
    const list = document.getElementById('cart-items-list');
    const subtotalEl = document.getElementById('subtotal-display');
    const discountEl = document.getElementById('discount-display');
    const totalEl = document.getElementById('total-amount-display');
    const checkoutBtn = document.getElementById('btn-checkout');
    const counterBadge = document.getElementById('cart-counter');

    const totalCount = this.cart.reduce((sum, i) => sum + i.quantity, 0);
    if (counterBadge) counterBadge.innerText = totalCount;

    if (!this.cart.length) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          <p>ยังไม่มีสินค้าในบิล</p>
          <span style="font-size: 0.75rem;">ยิงบาร์โค้ด หรือคลิกเลือกสินค้าเพื่อเริ่มคิดเงิน</span>
        </div>
      `;
      if (subtotalEl) subtotalEl.innerText = '฿0.00';
      if (discountEl) discountEl.innerText = '-฿0.00';
      if (totalEl) totalEl.innerText = '฿0.00';
      if (checkoutBtn) checkoutBtn.disabled = true;
      return;
    }

    let subtotal = 0;
    let html = '';

    this.cart.forEach(item => {
      const lineTotal = item.unit_price * item.quantity;
      subtotal += lineTotal;

      html += `
        <div class="cart-row">
          <div class="cart-row-info">
            <span class="cart-row-name">${item.name}</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span class="cart-row-code">${item.product_id}</span>
              ${item.promo_name ? `<span style="font-size: 0.68rem; background: rgba(245,158,11,0.2); color: var(--warning); padding: 1px 4px; border-radius: 3px;">${item.promo_name}</span>` : ''}
            </div>
          </div>
          <div class="cart-qty-stepper">
            <button class="qty-btn" onclick="POS.updateQuantity('${item.product_id}', -1)">-</button>
            <input type="text" class="qty-input" value="${item.quantity}" onchange="POS.setQuantity('${item.product_id}', this.value)">
            <button class="qty-btn" onclick="POS.updateQuantity('${item.product_id}', 1)">+</button>
          </div>
          <div class="cart-row-price">฿${lineTotal.toFixed(2)}</div>
          <button class="cart-row-del" onclick="POS.removeFromCart('${item.product_id}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `;
    });

    list.innerHTML = html;

    const netTotal = Math.max(0, subtotal - this.discount);
    if (subtotalEl) subtotalEl.innerText = `฿${subtotal.toFixed(2)}`;
    if (discountEl) discountEl.innerText = `-฿${this.discount.toFixed(2)}`;
    if (totalEl) totalEl.innerText = `฿${netTotal.toFixed(2)}`;
    if (checkoutBtn) checkoutBtn.disabled = false;
  },

  // ---------------------- Payment & Checkout ----------------------
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
      changeDisplay.style.color = '#10b981';
    } else {
      changeDisplay.innerText = `ยังขาดอีก ฿${Math.abs(change).toFixed(2)}`;
      changeDisplay.style.color = '#ef4444';
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
      this.loadProducts(); // refresh stock numbers
    } catch (e) {
      console.error('Checkout error:', e);
      showToast('เกิดข้อผิดพลาดในการเช็คบิล', 'error');
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
    const title = prompt('ชื่อหรือหมายเหตุสำหรับพักบิลนี้ (เช่น โต๊ะ 1 หรือ คุณสมชาย):', `บิล #${this.heldBills.length + 1}`);
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
        const badge = document.getElementById('held-bills-badge');
        if (badge) {
          badge.innerText = this.heldBills.length;
          badge.style.display = this.heldBills.length > 0 ? 'inline-flex' : 'none';
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
    const val = prompt('ใส่จำนวนเงินส่วนลด (บาท):', this.discount || 0);
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        this.discount = num;
        this.renderCart();
        showToast(`ใส่ส่วนลด ฿${num.toFixed(2)} แล้ว`, 'success');
      }
    }
  },

  closeAllModals: function() {
    document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('active'));
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
