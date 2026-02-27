'use strict';

/**
 * products.js — Product management
 * Fields: id, name, category, unit (liters/kg/units), density, notes, color, createdAt, updatedAt
 */

const Products = (() => {

  let _sortField  = 'name';
  let _sortAsc    = true;
  let _searchTerm = '';

  // ─── Rendering ───────────────────────────────────────────────

  /** Render the sortable products table. */
  function renderProductsTable() {
    const container = document.getElementById('products-table-container');
    if (!container) return;

    let products = Storage.getAll(KEYS.PRODUCTS);

    if (_searchTerm) {
      const term = _searchTerm.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
    }

    products.sort((a, b) => {
      const va = (a[_sortField] || '').toString().toLowerCase();
      const vb = (b[_sortField] || '').toString().toLowerCase();
      return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    if (products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-box"></i>
          <p>No products found. <a href="#" id="link-add-product">Add your first product</a>.</p>
        </div>`;
      document.getElementById('link-add-product')?.addEventListener('click', (e) => {
        e.preventDefault(); openProductForm();
      });
      return;
    }

    const rows = products.map(p => `
      <tr>
        <td>
          <span class="color-swatch" style="background:${App.escapeHtml(p.color || '#999')}"></span>
          ${App.escapeHtml(p.name)}
        </td>
        <td>${App.escapeHtml(p.category || '—')}</td>
        <td>${App.escapeHtml(p.unit || '—')}</td>
        <td>${p.density ? Number(p.density).toFixed(3) : '—'}</td>
        <td>${App.escapeHtml(p.notes || '—')}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" title="Edit" onclick="Products.openProductForm('${p.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon danger" title="Delete" onclick="Products.deleteProduct('${p.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');

    const thClass = (field) => `sortable${_sortField === field ? (_sortAsc ? ' sort-asc' : ' sort-desc') : ''}`;

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="${thClass('name')}" data-sort="name">Name</th>
              <th class="${thClass('category')}" data-sort="category">Category</th>
              <th class="${thClass('unit')}" data-sort="unit">Unit</th>
              <th>Density</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (_sortField === field) _sortAsc = !_sortAsc;
        else { _sortField = field; _sortAsc = true; }
        renderProductsTable();
      });
    });
  }

  // ─── Form ────────────────────────────────────────────────────

  /**
   * Open the product create/edit modal.
   * @param {string} [id]
   */
  function openProductForm(id) {
    const product = id ? Storage.getById(KEYS.PRODUCTS, id) : null;
    const title   = product ? 'Edit Product' : 'Add Product';

    const unitOptions = ['liters', 'kg', 'units'].map(u =>
      `<option value="${u}" ${product && product.unit === u ? 'selected' : ''}>${u.charAt(0).toUpperCase() + u.slice(1)}</option>`
    ).join('');

    const html = `
      <form id="product-form" novalidate>
        <input type="hidden" name="id" value="${product ? App.escapeHtml(product.id) : ''}">
        <div class="form-row">
          <div class="form-group">
            <label for="pf-name">Product Name <span class="required">*</span></label>
            <input type="text" id="pf-name" name="name" required maxlength="80"
                   value="${product ? App.escapeHtml(product.name) : ''}">
            <div class="field-error" id="err-pf-name">Name is required.</div>
          </div>
          <div class="form-group">
            <label for="pf-category">Category</label>
            <input type="text" id="pf-category" name="category" maxlength="60"
                   value="${product ? App.escapeHtml(product.category || '') : ''}"
                   placeholder="e.g. Dairy, Beverage">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="pf-unit">Unit <span class="required">*</span></label>
            <select id="pf-unit" name="unit" required>
              ${unitOptions}
            </select>
          </div>
          <div class="form-group">
            <label for="pf-density">Density (kg/L)</label>
            <input type="number" id="pf-density" name="density" min="0.01" max="10" step="0.001"
                   value="${product ? product.density || '' : ''}"
                   placeholder="e.g. 1.03 for milk">
            <div class="form-hint">Used for weight calculations (optional).</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="pf-color">Display Color</label>
            <input type="color" id="pf-color" name="color"
                   value="${product ? App.escapeHtml(product.color || '#2196F3') : '#2196F3'}">
          </div>
        </div>
        <div class="form-group">
          <label for="pf-notes">Notes</label>
          <textarea id="pf-notes" name="notes">${product ? App.escapeHtml(product.notes || '') : ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Product
          </button>
        </div>
      </form>`;

    App.openModal(title, html);

    document.getElementById('product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!_validateProductForm()) return;
      const fd = new FormData(e.target);
      saveProduct(Object.fromEntries(fd.entries()));
    });
  }

  function _validateProductForm() {
    let valid = true;
    const nameEl = document.getElementById('pf-name');
    const errEl  = document.getElementById('err-pf-name');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('invalid');
      if (errEl) errEl.classList.add('visible');
      valid = false;
    } else {
      nameEl.classList.remove('invalid');
      if (errEl) errEl.classList.remove('visible');
    }
    return valid;
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Save a product (create or update).
   * @param {Object} data
   */
  function saveProduct(data) {
    const payload = {
      name:     data.name.trim(),
      category: (data.category || '').trim(),
      unit:     data.unit || 'liters',
      density:  data.density ? parseFloat(data.density) : null,
      color:    data.color || '#2196F3',
      notes:    (data.notes || '').trim(),
    };

    if (data.id) {
      Storage.update(KEYS.PRODUCTS, data.id, payload);
      App.showToast(`Product "${payload.name}" updated.`, 'success');
    } else {
      Storage.save(KEYS.PRODUCTS, payload);
      App.showToast(`Product "${payload.name}" added.`, 'success');
    }

    App.closeModal();
    renderProductsTable();
  }

  /**
   * Delete a product after confirmation.
   * @param {string} id
   */
  function deleteProduct(id) {
    const product = Storage.getById(KEYS.PRODUCTS, id);
    if (!product) return;
    if (!confirm(`Delete product "${product.name}"? This cannot be undone.`)) return;
    Storage.remove(KEYS.PRODUCTS, id);
    App.showToast(`Product "${product.name}" deleted.`, 'success');
    renderProductsTable();
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    const addBtn = document.getElementById('btn-add-product');
    if (addBtn) addBtn.addEventListener('click', () => openProductForm());

    const searchEl = document.getElementById('product-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        _searchTerm = searchEl.value;
        renderProductsTable();
      });
    }

    const sortEl = document.getElementById('product-sort');
    if (sortEl) {
      sortEl.addEventListener('change', () => {
        _sortField = sortEl.value;
        _sortAsc   = true;
        renderProductsTable();
      });
    }
  }

  return { init, renderProductsTable, openProductForm, saveProduct, deleteProduct };

})();
