'use strict';

/**
 * trucks.js — Truck management
 * Truck fields: id, name, licensePlate, totalCapacity, compartments[], createdAt, updatedAt
 * Compartment fields: id (local), name, capacity, allowedProducts[], notes
 */

const Trucks = (() => {

  let _searchTerm = '';
  // Counter used for compartment row IDs within the form
  let _compartmentCounter = 0;

  // ─── Rendering ───────────────────────────────────────────────

  /** Render trucks as a card-based layout. */
  function renderTrucksTable() {
    const container = document.getElementById('trucks-cards-container');
    if (!container) return;

    let trucks = Storage.getAll(KEYS.TRUCKS);

    if (_searchTerm) {
      const term = _searchTerm.toLowerCase();
      trucks = trucks.filter(t =>
        t.name.toLowerCase().includes(term) ||
        (t.licensePlate || '').toLowerCase().includes(term)
      );
    }

    if (trucks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-truck"></i>
          <p>No trucks found. <a href="#" id="link-add-truck">Add your first truck</a>.</p>
        </div>`;
      document.getElementById('link-add-truck')?.addEventListener('click', (e) => {
        e.preventDefault(); openTruckForm();
      });
      return;
    }

    container.innerHTML = trucks.map(truck => _renderTruckCard(truck)).join('');
  }

  /**
   * Generate HTML for a single truck card.
   * @param {Object} truck
   * @returns {string}
   */
  function _renderTruckCard(truck) {
    const compartments = (truck.compartments || []);
    const total = compartments.reduce((s, c) => s + (Number(c.capacity) || 0), 0);

    const compsHtml = compartments.map(c => {
      const products = Storage.getAll(KEYS.PRODUCTS)
        .filter(p => (c.allowedProducts || []).includes(p.id));
      const prodNames = products.length
        ? products.map(p => `<span class="color-swatch" style="background:${App.escapeHtml(p.color || '#999')}"></span>${App.escapeHtml(p.name)}`).join(', ')
        : '<span class="text-muted">Any product</span>';
      return `
        <div class="compartment-item">
          <span><strong>${App.escapeHtml(c.name)}</strong> — ${prodNames}</span>
          <span class="compartment-capacity">${Number(c.capacity).toLocaleString()} L</span>
        </div>`;
    }).join('');

    return `
      <div class="truck-card">
        <div class="truck-card-header">
          <div>
            <div class="truck-card-title"><i class="fa-solid fa-truck"></i> ${App.escapeHtml(truck.name)}</div>
            <div class="truck-card-plate">${App.escapeHtml(truck.licensePlate || '—')}</div>
          </div>
          <div class="table-actions">
            <button class="btn-icon" title="Edit" onclick="Trucks.openTruckForm('${truck.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon danger" title="Delete" onclick="Trucks.deleteTruck('${truck.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="truck-compartments">
          <div class="form-section-title" style="font-size:.85rem;">
            <i class="fa-solid fa-layer-group"></i> Compartments (${compartments.length})
          </div>
          ${compsHtml || '<p class="text-muted text-small">No compartments defined.</p>'}
        </div>
        <div class="truck-total-capacity">
          <i class="fa-solid fa-gauge"></i>
          Total capacity: <strong>${total.toLocaleString()} L</strong>
        </div>
      </div>`;
  }

  // ─── Form ────────────────────────────────────────────────────

  /**
   * Open the truck create/edit modal.
   * @param {string} [id]  Existing truck id for edit mode
   */
  function openTruckForm(id) {
    const truck  = id ? Storage.getById(KEYS.TRUCKS, id) : null;
    const title  = truck ? 'Edit Truck' : 'Add Truck';
    _compartmentCounter = 0;

    // Build product options for "allowed products" multi-select
    const products = Storage.getAll(KEYS.PRODUCTS);

    const html = `
      <form id="truck-form" novalidate>
        <input type="hidden" name="id" value="${truck ? App.escapeHtml(truck.id) : ''}">
        <div class="form-row">
          <div class="form-group">
            <label for="tf-name">Truck Name <span class="required">*</span></label>
            <input type="text" id="tf-name" name="name" required maxlength="80"
                   value="${truck ? App.escapeHtml(truck.name) : ''}">
            <div class="field-error" id="err-tf-name">Name is required.</div>
          </div>
          <div class="form-group">
            <label for="tf-plate">License Plate</label>
            <input type="text" id="tf-plate" name="licensePlate" maxlength="20"
                   value="${truck ? App.escapeHtml(truck.licensePlate || '') : ''}">
          </div>
        </div>

        <hr class="form-divider">
        <div class="form-section-title">
          <i class="fa-solid fa-layer-group"></i> Compartments
        </div>
        <div id="compartments-container"></div>
        <button type="button" class="btn btn-secondary btn-sm mt-1" id="btn-add-compartment">
          <i class="fa-solid fa-plus"></i> Add Compartment
        </button>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Truck
          </button>
        </div>
      </form>`;

    App.openModal(title, html);

    // Populate existing compartments or one empty row
    const comps = (truck && truck.compartments) ? truck.compartments : [_emptyCompartment()];
    comps.forEach(c => _addCompartmentRow(c, products));

    // Add-compartment button
    document.getElementById('btn-add-compartment').addEventListener('click', () => {
      _addCompartmentRow(_emptyCompartment(), products);
    });

    // Form submit
    document.getElementById('truck-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!_validateTruckForm()) return;
      const fd = new FormData(e.target);
      saveTruck(fd);
    });
  }

  function _emptyCompartment() {
    return { id: null, name: '', capacity: '', allowedProducts: [], notes: '' };
  }

  /**
   * Append a compartment row to the compartments container.
   * @param {Object} comp       Compartment data
   * @param {Array}  products   All products
   */
  function _addCompartmentRow(comp, products) {
    _compartmentCounter++;
    const idx = _compartmentCounter;
    const container = document.getElementById('compartments-container');
    if (!container) return;

    const productOptions = products.map(p =>
      `<option value="${p.id}" ${(comp.allowedProducts || []).includes(p.id) ? 'selected' : ''}>
        ${App.escapeHtml(p.name)}
      </option>`
    ).join('');

    const row = document.createElement('div');
    row.className = 'compartment-row';
    row.dataset.idx = idx;
    row.innerHTML = `
      <div class="compartment-row-header">
        <span><i class="fa-solid fa-box"></i> Compartment ${idx}</span>
        <button type="button" class="btn-icon danger" title="Remove" onclick="this.closest('.compartment-row').remove()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
      <input type="hidden" name="comp_id_${idx}" value="${comp.id ? App.escapeHtml(comp.id) : ''}">
      <div class="form-row">
        <div class="form-group">
          <label>Name <span class="required">*</span></label>
          <input type="text" name="comp_name_${idx}" required maxlength="60"
                 value="${App.escapeHtml(comp.name || `Compartment ${idx}`)}"
                 placeholder="e.g. Compartiment A">
        </div>
        <div class="form-group">
          <label>Capacity (L) <span class="required">*</span></label>
          <input type="number" name="comp_capacity_${idx}" required min="1" step="1"
                 value="${comp.capacity || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Allowed Products <span class="form-hint">(hold Ctrl/Cmd for multiple; empty = any)</span></label>
        <select name="comp_products_${idx}" multiple style="height:80px;">
          ${productOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Notes</label>
        <input type="text" name="comp_notes_${idx}"
               value="${App.escapeHtml(comp.notes || '')}">
      </div>`;

    container.appendChild(row);
  }

  /** Basic truck form validation. */
  function _validateTruckForm() {
    let valid = true;
    const nameEl = document.getElementById('tf-name');
    const errEl  = document.getElementById('err-tf-name');
    if (!nameEl.value.trim()) {
      nameEl.classList.add('invalid');
      if (errEl) errEl.classList.add('visible');
      valid = false;
    } else {
      nameEl.classList.remove('invalid');
      if (errEl) errEl.classList.remove('visible');
    }

    // Validate each compartment row
    document.querySelectorAll('#compartments-container .compartment-row').forEach(row => {
      const idx = row.dataset.idx;
      const nameInput = row.querySelector(`[name="comp_name_${idx}"]`);
      const capInput  = row.querySelector(`[name="comp_capacity_${idx}"]`);
      if (nameInput && !nameInput.value.trim()) {
        nameInput.classList.add('invalid'); valid = false;
      } else {
        nameInput?.classList.remove('invalid');
      }
      if (capInput && (!capInput.value || Number(capInput.value) <= 0)) {
        capInput.classList.add('invalid'); valid = false;
      } else {
        capInput?.classList.remove('invalid');
      }
    });
    return valid;
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Build truck payload from FormData and save.
   * @param {FormData} fd
   */
  function saveTruck(fd) {
    const rows = document.querySelectorAll('#compartments-container .compartment-row');
    const compartments = [];

    rows.forEach(row => {
      const idx = row.dataset.idx;
      // Collect selected allowed products
      const select = row.querySelector(`[name="comp_products_${idx}"]`);
      const allowedProducts = select
        ? Array.from(select.selectedOptions).map(o => o.value)
        : [];

      compartments.push({
        id:              fd.get(`comp_id_${idx}`) || _generateCompId(),
        name:            (fd.get(`comp_name_${idx}`) || '').trim(),
        capacity:        parseFloat(fd.get(`comp_capacity_${idx}`)) || 0,
        allowedProducts,
        notes:           (fd.get(`comp_notes_${idx}`) || '').trim(),
      });
    });

    const total = compartments.reduce((s, c) => s + c.capacity, 0);

    const payload = {
      name:          (fd.get('name') || '').trim(),
      licensePlate:  (fd.get('licensePlate') || '').trim(),
      totalCapacity: total,
      compartments,
    };

    const id = fd.get('id');
    if (id) {
      Storage.update(KEYS.TRUCKS, id, payload);
      App.showToast(`Truck "${payload.name}" updated.`, 'success');
    } else {
      Storage.save(KEYS.TRUCKS, payload);
      App.showToast(`Truck "${payload.name}" added.`, 'success');
    }

    App.closeModal();
    renderTrucksTable();
  }

  function _generateCompId() {
    return 'comp-' + Math.random().toString(36).slice(2, 9);
  }

  /**
   * Delete a truck after confirmation.
   * @param {string} id
   */
  function deleteTruck(id) {
    const truck = Storage.getById(KEYS.TRUCKS, id);
    if (!truck) return;
    if (!confirm(`Delete truck "${truck.name}"? This cannot be undone.`)) return;
    Storage.remove(KEYS.TRUCKS, id);
    App.showToast(`Truck "${truck.name}" deleted.`, 'success');
    renderTrucksTable();
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    const addBtn = document.getElementById('btn-add-truck');
    if (addBtn) addBtn.addEventListener('click', () => openTruckForm());

    const searchEl = document.getElementById('truck-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        _searchTerm = searchEl.value;
        renderTrucksTable();
      });
    }
  }

  return { init, renderTrucksTable, openTruckForm, saveTruck, deleteTruck };

})();
