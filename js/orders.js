'use strict';

/**
 * orders.js — Tour Order management
 *
 * Tour fields:
 *   id, name, date, truckId, depotAddress, depotLat, depotLng,
 *   status (draft/optimized/executed), orderLines[], createdAt, updatedAt
 *
 * OrderLine fields:
 *   id, clientId, productId, quantity, timeWindowStart, timeWindowEnd, priority
 */

const Orders = (() => {

  let _searchTerm    = '';
  let _filterStatus  = '';
  // Line counter within the order form
  let _lineCounter   = 0;

  // ─── Rendering ───────────────────────────────────────────────

  /** Render the tour orders list table. */
  function renderOrdersList() {
    const container = document.getElementById('orders-table-container');
    if (!container) return;

    let orders = Storage.getAll(KEYS.TOURS);

    if (_searchTerm) {
      const term = _searchTerm.toLowerCase();
      orders = orders.filter(o =>
        o.name.toLowerCase().includes(term) ||
        (o.depotAddress || '').toLowerCase().includes(term)
      );
    }

    if (_filterStatus) {
      orders = orders.filter(o => o.status === _filterStatus);
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-clipboard-list"></i>
          <p>No tour orders found. <a href="#" id="link-add-order">Create your first tour</a>.</p>
        </div>`;
      document.getElementById('link-add-order')?.addEventListener('click', (e) => {
        e.preventDefault(); openOrderForm();
      });
      return;
    }

    const trucks = Storage.getAll(KEYS.TRUCKS);

    const rows = orders.map(o => {
      const truck      = trucks.find(t => t.id === o.truckId);
      const lineCount  = (o.orderLines || []).length;
      const badgeCls   = `badge badge-${o.status || 'draft'}`;
      const dateStr    = o.date ? new Date(o.date + 'T00:00:00').toLocaleDateString() : '—';

      return `
        <tr>
          <td><strong>${App.escapeHtml(o.name)}</strong></td>
          <td>${dateStr}</td>
          <td>${truck ? App.escapeHtml(truck.name) : '<span class="text-muted">—</span>'}</td>
          <td>${App.escapeHtml(o.depotAddress || '—')}</td>
          <td>${lineCount} stop${lineCount !== 1 ? 's' : ''}</td>
          <td><span class="${badgeCls}">${o.status || 'draft'}</span></td>
          <td>
            <div class="table-actions">
              <button class="btn-icon" title="Edit" onclick="Orders.openOrderForm('${o.id}')">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              <button class="btn-icon" title="Optimize" onclick="Orders.goOptimize('${o.id}')">
                <i class="fa-solid fa-route"></i>
              </button>
              <button class="btn-icon" title="Loading Plan" onclick="Orders.goLoadingPlan('${o.id}')">
                <i class="fa-solid fa-layer-group"></i>
              </button>
              <button class="btn-icon danger" title="Delete" onclick="Orders.deleteOrder('${o.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Tour Name</th>
              <th>Date</th>
              <th>Truck</th>
              <th>Depot</th>
              <th>Stops</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  // ─── Form ────────────────────────────────────────────────────

  /**
   * Open the tour order create/edit modal.
   * @param {string} [id]
   */
  function openOrderForm(id) {
    const order  = id ? Storage.getById(KEYS.TOURS, id) : null;
    const title  = order ? 'Edit Tour Order' : 'New Tour Order';
    _lineCounter = 0;

    const trucks   = Storage.getAll(KEYS.TRUCKS);
    const truckOpts = trucks.map(t =>
      `<option value="${t.id}" ${order && order.truckId === t.id ? 'selected' : ''}>${App.escapeHtml(t.name)}</option>`
    ).join('');

    const todayStr = new Date().toISOString().slice(0, 10);

    const html = `
      <form id="order-form" novalidate>
        <input type="hidden" name="id" value="${order ? App.escapeHtml(order.id) : ''}">
        <div class="form-row">
          <div class="form-group">
            <label for="of-name">Tour Name <span class="required">*</span></label>
            <input type="text" id="of-name" name="name" required maxlength="100"
                   value="${order ? App.escapeHtml(order.name) : ''}">
            <div class="field-error" id="err-of-name">Tour name is required.</div>
          </div>
          <div class="form-group">
            <label for="of-date">Date <span class="required">*</span></label>
            <input type="date" id="of-date" name="date" required
                   value="${order ? App.escapeHtml(order.date || todayStr) : todayStr}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="of-truck">Truck <span class="required">*</span></label>
            <select id="of-truck" name="truckId" required>
              <option value="">— Select truck —</option>
              ${truckOpts}
            </select>
            <div class="field-error" id="err-of-truck">A truck is required.</div>
          </div>
          <div class="form-group">
            <label for="of-status">Status</label>
            <select id="of-status" name="status">
              <option value="draft"     ${(!order || order.status === 'draft')     ? 'selected' : ''}>Draft</option>
              <option value="optimized" ${order && order.status === 'optimized'    ? 'selected' : ''}>Optimized</option>
              <option value="executed"  ${order && order.status === 'executed'     ? 'selected' : ''}>Executed</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="of-depot">Depot Address <span class="required">*</span></label>
          <div class="address-row">
            <input type="text" id="of-depot" name="depotAddress" required
                   value="${order ? App.escapeHtml(order.depotAddress || '') : ''}"
                   placeholder="e.g. Rungis International Market, France">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-geocode-depot">
              <i class="fa-solid fa-location-crosshairs"></i> Geocode
            </button>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="of-depot-lat">Depot Latitude</label>
            <input type="number" id="of-depot-lat" name="depotLat" step="0.00001"
                   value="${order ? order.depotLat || '' : ''}">
          </div>
          <div class="form-group">
            <label for="of-depot-lng">Depot Longitude</label>
            <input type="number" id="of-depot-lng" name="depotLng" step="0.00001"
                   value="${order ? order.depotLng || '' : ''}">
          </div>
        </div>

        <hr class="form-divider">
        <div class="form-section-title">
          <i class="fa-solid fa-list"></i> Delivery Stops
          <span class="form-hint" style="font-weight:normal;margin-left:.5rem;">(order = delivery sequence)</span>
        </div>
        <div id="order-lines-container"></div>
        <button type="button" class="btn btn-secondary btn-sm mt-1" id="btn-add-line">
          <i class="fa-solid fa-plus"></i> Add Stop
        </button>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Tour
          </button>
        </div>
      </form>`;

    App.openModal(title, html, 'wide');

    // Populate order lines
    const lines = (order && order.orderLines) ? order.orderLines : [];
    if (lines.length === 0) {
      addOrderLine();
    } else {
      lines.forEach(line => addOrderLine(line));
    }

    // Geocode depot button
    document.getElementById('btn-geocode-depot').addEventListener('click', async () => {
      const addr = document.getElementById('of-depot').value.trim();
      if (!addr) { App.showToast('Enter a depot address first.', 'warning'); return; }
      App.showSpinner('Geocoding…');
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1`;
        const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await resp.json();
        if (data.length) {
          document.getElementById('of-depot-lat').value = parseFloat(data[0].lat).toFixed(6);
          document.getElementById('of-depot-lng').value = parseFloat(data[0].lon).toFixed(6);
          App.showToast('Depot coordinates found.', 'success');
        } else {
          App.showToast('Depot address not found.', 'warning');
        }
      } catch (err) {
        App.showToast('Geocoding failed.', 'error');
      } finally {
        App.hideSpinner();
      }
    });

    document.getElementById('btn-add-line').addEventListener('click', () => addOrderLine());

    document.getElementById('order-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!_validateOrderForm()) return;
      const fd = new FormData(e.target);
      saveOrder(fd);
    });
  }

  // ─── Order Lines ─────────────────────────────────────────────

  /**
   * Add a new order line row to the form.
   * @param {Object} [lineData]  Existing line data for edit mode
   */
  function addOrderLine(lineData) {
    _lineCounter++;
    const idx = _lineCounter;
    const container = document.getElementById('order-lines-container');
    if (!container) return;

    const clients  = Storage.getAll(KEYS.CLIENTS);
    const products = Storage.getAll(KEYS.PRODUCTS);

    const clientOpts = clients.map(c =>
      `<option value="${c.id}" ${lineData && lineData.clientId === c.id ? 'selected' : ''}>${App.escapeHtml(c.name)}</option>`
    ).join('');

    const productOpts = products.map(p =>
      `<option value="${p.id}" ${lineData && lineData.productId === p.id ? 'selected' : ''}>${App.escapeHtml(p.name)}</option>`
    ).join('');

    // Smart quantity suggestion: average of last 3 orders for the same client+product
    const suggestedQty = lineData ? lineData.quantity || '' : '';

    const row = document.createElement('div');
    row.className  = 'order-line-row';
    row.dataset.idx = idx;
    row.innerHTML = `
      <input type="hidden" name="line_id_${idx}" value="${lineData ? App.escapeHtml(lineData.id || '') : ''}">
      <div class="order-line-fields">
        <div class="form-group">
          <label>Client <span class="required">*</span></label>
          <select name="line_client_${idx}" required onchange="Orders.suggestQuantity(${idx})">
            <option value="">— Client —</option>
            ${clientOpts}
          </select>
        </div>
        <div class="form-group">
          <label>Product <span class="required">*</span></label>
          <select name="line_product_${idx}" required onchange="Orders.suggestQuantity(${idx})">
            <option value="">— Product —</option>
            ${productOpts}
          </select>
        </div>
        <div class="form-group">
          <label>Quantity (L) <span class="required">*</span></label>
          <input type="number" name="line_qty_${idx}" required min="1" step="1"
                 id="line_qty_${idx}"
                 value="${suggestedQty}" placeholder="0">
        </div>
        <div class="form-group">
          <label>From</label>
          <input type="time" name="line_tw_start_${idx}"
                 value="${lineData ? lineData.timeWindowStart || '' : ''}">
        </div>
        <div class="form-group">
          <label>To</label>
          <input type="time" name="line_tw_end_${idx}"
                 value="${lineData ? lineData.timeWindowEnd || '' : ''}">
        </div>
        <div class="form-group">
          <label>Priority</label>
          <select name="line_priority_${idx}">
            <option value="1" ${lineData && lineData.priority == 1 ? 'selected' : ''}>High</option>
            <option value="2" ${(!lineData || lineData.priority == 2) ? 'selected' : ''}>Normal</option>
            <option value="3" ${lineData && lineData.priority == 3 ? 'selected' : ''}>Low</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          <button type="button" class="btn-icon danger" title="Remove stop"
                  onclick="Orders.removeOrderLine(this)">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`;

    container.appendChild(row);
  }

  /**
   * Remove an order line row.
   * @param {HTMLElement} btnEl  The remove button element
   */
  function removeOrderLine(btnEl) {
    const row = btnEl.closest('.order-line-row');
    if (row) row.remove();
  }

  /**
   * Suggest a quantity based on average from historical orders for the same client+product.
   * @param {number} idx  Line index
   */
  function suggestQuantity(idx) {
    const clientSel  = document.querySelector(`[name="line_client_${idx}"]`);
    const productSel = document.querySelector(`[name="line_product_${idx}"]`);
    const qtyInput   = document.getElementById(`line_qty_${idx}`);
    if (!clientSel || !productSel || !qtyInput) return;

    const clientId  = clientSel.value;
    const productId = productSel.value;
    if (!clientId || !productId) return;

    // Gather historical quantities
    const allTours = Storage.getAll(KEYS.TOURS);
    const quantities = [];
    allTours.forEach(tour => {
      (tour.orderLines || []).forEach(line => {
        if (line.clientId === clientId && line.productId === productId && line.quantity) {
          quantities.push(Number(line.quantity));
        }
      });
    });

    if (quantities.length > 0) {
      // Average of last 3 deliveries
      const recent = quantities.slice(-3);
      const avg = Math.round(recent.reduce((s, v) => s + v, 0) / recent.length);
      if (!qtyInput.value) {
        qtyInput.value = avg;
        qtyInput.title = `Suggested based on ${recent.length} previous delivery(ies)`;
      }
    }
  }

  // ─── Validation ───────────────────────────────────────────────

  function _validateOrderForm() {
    let valid = true;

    const nameEl  = document.getElementById('of-name');
    const dateEl  = document.getElementById('of-date');
    const truckEl = document.getElementById('of-truck');

    [{ el: nameEl,  errId: 'err-of-name',  msg: 'Tour name is required.' },
     { el: truckEl, errId: 'err-of-truck', msg: 'A truck must be selected.' }]
    .forEach(({ el, errId, msg }) => {
      const errEl = document.getElementById(errId);
      if (!el.value.trim()) {
        el.classList.add('invalid');
        if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
        valid = false;
      } else {
        el.classList.remove('invalid');
        if (errEl) errEl.classList.remove('visible');
      }
    });

    // Validate at least one line
    const lines = document.querySelectorAll('#order-lines-container .order-line-row');
    if (lines.length === 0) {
      App.showToast('Add at least one delivery stop.', 'warning');
      valid = false;
    }

    // Validate each line
    lines.forEach(row => {
      const idx     = row.dataset.idx;
      const cSel    = row.querySelector(`[name="line_client_${idx}"]`);
      const pSel    = row.querySelector(`[name="line_product_${idx}"]`);
      const qtyInp  = row.querySelector(`[name="line_qty_${idx}"]`);
      if (cSel && !cSel.value) { cSel.classList.add('invalid');   valid = false; } else { cSel?.classList.remove('invalid'); }
      if (pSel && !pSel.value) { pSel.classList.add('invalid');   valid = false; } else { pSel?.classList.remove('invalid'); }
      if (qtyInp && (!qtyInp.value || Number(qtyInp.value) <= 0)) {
        qtyInp.classList.add('invalid'); valid = false;
      } else { qtyInp?.classList.remove('invalid'); }
    });

    return valid;
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Build tour payload from FormData and save.
   * @param {FormData} fd
   */
  function saveOrder(fd) {
    const lineRows   = document.querySelectorAll('#order-lines-container .order-line-row');
    const orderLines = [];

    lineRows.forEach(row => {
      const idx = row.dataset.idx;
      orderLines.push({
        id:              fd.get(`line_id_${idx}`) || _genId(),
        clientId:        fd.get(`line_client_${idx}`) || '',
        productId:       fd.get(`line_product_${idx}`) || '',
        quantity:        parseFloat(fd.get(`line_qty_${idx}`)) || 0,
        timeWindowStart: fd.get(`line_tw_start_${idx}`) || '',
        timeWindowEnd:   fd.get(`line_tw_end_${idx}`) || '',
        priority:        parseInt(fd.get(`line_priority_${idx}`), 10) || 2,
      });
    });

    const payload = {
      name:         (fd.get('name') || '').trim(),
      date:         fd.get('date') || '',
      truckId:      fd.get('truckId') || '',
      depotAddress: (fd.get('depotAddress') || '').trim(),
      depotLat:     fd.get('depotLat') ? parseFloat(fd.get('depotLat')) : null,
      depotLng:     fd.get('depotLng') ? parseFloat(fd.get('depotLng')) : null,
      status:       fd.get('status') || 'draft',
      orderLines,
    };

    const id = fd.get('id');
    if (id) {
      Storage.update(KEYS.TOURS, id, payload);
      App.showToast(`Tour "${payload.name}" updated.`, 'success');
    } else {
      Storage.save(KEYS.TOURS, payload);
      App.showToast(`Tour "${payload.name}" created.`, 'success');
    }

    App.closeModal();
    renderOrdersList();
  }

  function _genId() {
    return 'line-' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Delete a tour after confirmation.
   * @param {string} id
   */
  function deleteOrder(id) {
    const order = Storage.getById(KEYS.TOURS, id);
    if (!order) return;
    if (!confirm(`Delete tour "${order.name}"? This cannot be undone.`)) return;
    Storage.remove(KEYS.TOURS, id);
    App.showToast(`Tour "${order.name}" deleted.`, 'success');
    renderOrdersList();
  }

  /** Navigate to optimizer with this tour pre-selected. */
  function goOptimize(tourId) {
    App.showSection('optimizer');
    Optimizer.renderOptimizerSection(tourId);
  }

  /** Navigate to loading plan with this tour pre-selected. */
  function goLoadingPlan(tourId) {
    App.showSection('loading');
    Loading.renderLoadingPlan(tourId);
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    const addBtn = document.getElementById('btn-add-order');
    if (addBtn) addBtn.addEventListener('click', () => openOrderForm());

    const searchEl = document.getElementById('order-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        _searchTerm = searchEl.value;
        renderOrdersList();
      });
    }

    const filterEl = document.getElementById('order-filter-status');
    if (filterEl) {
      filterEl.addEventListener('change', () => {
        _filterStatus = filterEl.value;
        renderOrdersList();
      });
    }
  }

  return {
    init,
    renderOrdersList,
    openOrderForm,
    saveOrder,
    deleteOrder,
    addOrderLine,
    removeOrderLine,
    suggestQuantity,
    goOptimize,
    goLoadingPlan,
  };

})();
