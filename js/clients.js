'use strict';

/**
 * clients.js — Client/Customer Site management
 * Fields: id, name, address, lat, lng, phone, contactPerson, notes, createdAt, updatedAt
 */

const Clients = (() => {

  // Track current sort state
  let _sortField = 'name';
  let _sortAsc   = true;
  let _searchTerm = '';
  // Leaflet map instance for the clients preview
  let _clientsMap = null;

  // ─── Rendering ───────────────────────────────────────────────

  /** Render the sortable, filterable clients table. */
  function renderClientsTable() {
    const container = document.getElementById('clients-table-container');
    if (!container) return;

    let clients = Storage.getAll(KEYS.CLIENTS);

    // Filter
    if (_searchTerm) {
      const term = _searchTerm.toLowerCase();
      clients = clients.filter(c =>
        c.name.toLowerCase().includes(term) ||
        (c.address || '').toLowerCase().includes(term) ||
        (c.contactPerson || '').toLowerCase().includes(term)
      );
    }

    // Sort
    clients.sort((a, b) => {
      const va = (a[_sortField] || '').toString().toLowerCase();
      const vb = (b[_sortField] || '').toString().toLowerCase();
      return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    if (clients.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-building-user"></i>
          <p>No clients found. <a href="#" id="link-add-client">Add your first client</a>.</p>
        </div>`;
      document.getElementById('link-add-client')?.addEventListener('click', (e) => {
        e.preventDefault(); openClientForm();
      });
      return;
    }

    const rows = clients.map(c => `
      <tr>
        <td>${App.escapeHtml(c.name)}</td>
        <td>${App.escapeHtml(c.address || '—')}</td>
        <td>${c.lat ? `${Number(c.lat).toFixed(5)}, ${Number(c.lng).toFixed(5)}` : '<span class="text-muted">No coords</span>'}</td>
        <td>${App.escapeHtml(c.phone || '—')}</td>
        <td>${App.escapeHtml(c.contactPerson || '—')}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon" title="Edit" onclick="Clients.openClientForm('${c.id}')">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-icon danger" title="Delete" onclick="Clients.deleteClient('${c.id}')">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`).join('');

    const sortIcon = (field) => {
      if (_sortField !== field) return '<span class="sort-icon"></span>';
      return `<span class="sort-icon"></span>`;
    };

    const thClass = (field) => `sortable${_sortField === field ? (_sortAsc ? ' sort-asc' : ' sort-desc') : ''}`;

    container.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="${thClass('name')}" data-sort="name">Name${sortIcon('name')}</th>
              <th class="${thClass('address')}" data-sort="address">Address${sortIcon('address')}</th>
              <th>Coordinates</th>
              <th>Phone</th>
              <th class="${thClass('contactPerson')}" data-sort="contactPerson">Contact${sortIcon('contactPerson')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    // Attach sort handlers
    container.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort');
        if (_sortField === field) _sortAsc = !_sortAsc;
        else { _sortField = field; _sortAsc = true; }
        renderClientsTable();
      });
    });
  }

  /** Render the small Leaflet map showing all client locations. */
  function renderClientsMap() {
    const clients = Storage.getAll(KEYS.CLIENTS).filter(c => c.lat && c.lng);

    if (!_clientsMap) {
      _clientsMap = MapManager.initMap('clients-map');
    }

    MapManager.showClientsMap('clients-map', clients, _clientsMap);
  }

  // ─── Form ────────────────────────────────────────────────────

  /**
   * Open the client create/edit modal.
   * @param {string} [id]  Existing client id for edit mode
   */
  function openClientForm(id) {
    const client = id ? Storage.getById(KEYS.CLIENTS, id) : null;
    const title  = client ? 'Edit Client' : 'Add Client';

    const html = `
      <form id="client-form" novalidate>
        <input type="hidden" name="id" value="${client ? App.escapeHtml(client.id) : ''}">
        <div class="form-row">
          <div class="form-group">
            <label for="cf-name">Name <span class="required">*</span></label>
            <input type="text" id="cf-name" name="name" required maxlength="120"
                   value="${client ? App.escapeHtml(client.name) : ''}">
            <div class="field-error" id="err-name">Name is required.</div>
          </div>
          <div class="form-group">
            <label for="cf-phone">Phone</label>
            <input type="tel" id="cf-phone" name="phone"
                   value="${client ? App.escapeHtml(client.phone || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="cf-address">Address <span class="required">*</span></label>
          <div class="address-row">
            <input type="text" id="cf-address" name="address" required
                   value="${client ? App.escapeHtml(client.address || '') : ''}"
                   placeholder="e.g. 10 rue de la Paix, 75001 Paris">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-geocode">
              <i class="fa-solid fa-location-crosshairs"></i> Geocode
            </button>
          </div>
          <div class="field-error" id="err-address">Address is required.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cf-lat">Latitude</label>
            <input type="number" id="cf-lat" name="lat" step="0.00001" min="-90" max="90"
                   value="${client ? client.lat || '' : ''}"
                   placeholder="48.85341">
          </div>
          <div class="form-group">
            <label for="cf-lng">Longitude</label>
            <input type="number" id="cf-lng" name="lng" step="0.00001" min="-180" max="180"
                   value="${client ? client.lng || '' : ''}"
                   placeholder="2.34880">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="cf-contact">Contact Person</label>
            <input type="text" id="cf-contact" name="contactPerson"
                   value="${client ? App.escapeHtml(client.contactPerson || '') : ''}">
          </div>
        </div>
        <div class="form-group">
          <label for="cf-notes">Notes</label>
          <textarea id="cf-notes" name="notes">${client ? App.escapeHtml(client.notes || '') : ''}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Client
          </button>
        </div>
      </form>`;

    App.openModal(title, html);

    // Geocode button
    document.getElementById('btn-geocode').addEventListener('click', async () => {
      const addr = document.getElementById('cf-address').value.trim();
      if (!addr) { App.showToast('Enter an address first.', 'warning'); return; }
      await geocodeAddress(addr);
    });

    // Form submit
    document.getElementById('client-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!_validateClientForm()) return;
      const fd = new FormData(e.target);
      saveClient(Object.fromEntries(fd.entries()));
    });
  }

  /** Validate the client form; highlight errors. Returns boolean. */
  function _validateClientForm() {
    let valid = true;
    const nameEl    = document.getElementById('cf-name');
    const addressEl = document.getElementById('cf-address');

    [{ el: nameEl,    errId: 'err-name',    msg: 'Name is required.' },
     { el: addressEl, errId: 'err-address', msg: 'Address is required.' }]
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
    return valid;
  }

  // ─── CRUD ─────────────────────────────────────────────────────

  /**
   * Save a client (create or update).
   * @param {Object} data  Form data from the client form
   */
  function saveClient(data) {
    const payload = {
      name:          data.name.trim(),
      address:       data.address.trim(),
      lat:           data.lat ? parseFloat(data.lat) : null,
      lng:           data.lng ? parseFloat(data.lng) : null,
      phone:         data.phone.trim(),
      contactPerson: data.contactPerson.trim(),
      notes:         data.notes.trim(),
    };

    if (data.id) {
      Storage.update(KEYS.CLIENTS, data.id, payload);
      App.showToast(`Client "${payload.name}" updated.`, 'success');
    } else {
      Storage.save(KEYS.CLIENTS, payload);
      App.showToast(`Client "${payload.name}" added.`, 'success');
    }

    App.closeModal();
    renderClientsTable();
    renderClientsMap();
  }

  /**
   * Delete a client after confirmation.
   * @param {string} id
   */
  function deleteClient(id) {
    const client = Storage.getById(KEYS.CLIENTS, id);
    if (!client) return;
    if (!confirm(`Delete client "${client.name}"? This cannot be undone.`)) return;
    Storage.remove(KEYS.CLIENTS, id);
    App.showToast(`Client "${client.name}" deleted.`, 'success');
    renderClientsTable();
    renderClientsMap();
  }

  // ─── Geocoding ────────────────────────────────────────────────

  /**
   * Geocode an address using Nominatim and fill the lat/lng fields.
   * @param {string} address
   */
  async function geocodeAddress(address) {
    App.showSpinner('Geocoding address…');
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (!data.length) {
        App.showToast('Address not found. Try a more specific address.', 'warning');
        return;
      }

      const { lat, lon } = data[0];
      const latEl = document.getElementById('cf-lat');
      const lngEl = document.getElementById('cf-lng');
      if (latEl) latEl.value = parseFloat(lat).toFixed(6);
      if (lngEl) lngEl.value = parseFloat(lon).toFixed(6);
      App.showToast(`Coordinates found: ${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`, 'success');
    } catch (err) {
      console.error('[Clients] Geocode error:', err);
      App.showToast('Geocoding failed. Check your connection.', 'error');
    } finally {
      App.hideSpinner();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    // Add Client button
    const addBtn = document.getElementById('btn-add-client');
    if (addBtn) addBtn.addEventListener('click', () => openClientForm());

    // Search input
    const searchEl = document.getElementById('client-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        _searchTerm = searchEl.value;
        renderClientsTable();
      });
    }

    // Sort select
    const sortEl = document.getElementById('client-sort');
    if (sortEl) {
      sortEl.addEventListener('change', () => {
        _sortField = sortEl.value;
        _sortAsc   = true;
        renderClientsTable();
      });
    }
  }

  return { init, renderClientsTable, renderClientsMap, openClientForm, saveClient, deleteClient, geocodeAddress };

})();
