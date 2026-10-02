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
