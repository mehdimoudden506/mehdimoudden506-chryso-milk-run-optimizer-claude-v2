'use strict';

/**
 * dashboard.js — Dashboard statistics and quick actions
 */

const Dashboard = (() => {

  // ─── Rendering ───────────────────────────────────────────────

  /** Render the full dashboard. */
  function renderDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!container) return;

    const clients  = Storage.getAll(KEYS.CLIENTS);
    const trucks   = Storage.getAll(KEYS.TRUCKS);
    const products = Storage.getAll(KEYS.PRODUCTS);
    const tours    = Storage.getAll(KEYS.TOURS);

    // Calculate pending (draft) tours
    const pendingTours = tours.filter(t => t.status === 'draft').length;

    // ── Stats ──
    const statsHtml = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon"><i class="fa-solid fa-building-user"></i></div>
          <div class="stat-info">
            <div class="stat-value">${clients.length}</div>
            <div class="stat-label">Clients</div>
          </div>
        </div>
        <div class="stat-card" style="border-left-color:#E65100;">
          <div class="stat-icon" style="background:rgba(230,81,0,.1);color:#E65100;">
            <i class="fa-solid fa-truck"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${trucks.length}</div>
            <div class="stat-label">Trucks</div>
          </div>
        </div>
        <div class="stat-card" style="border-left-color:#2E7D32;">
          <div class="stat-icon" style="background:rgba(46,125,50,.1);color:#2E7D32;">
            <i class="fa-solid fa-box"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${products.length}</div>
            <div class="stat-label">Products</div>
          </div>
        </div>
        <div class="stat-card" style="border-left-color:#9C27B0;">
          <div class="stat-icon" style="background:rgba(156,39,176,.1);color:#9C27B0;">
            <i class="fa-solid fa-clipboard-list"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${pendingTours}</div>
            <div class="stat-label">Pending Tours</div>
          </div>
        </div>
      </div>`;

    // ── Quick actions ──
    const actionsHtml = `
      <p class="dashboard-section-title">
        <i class="fa-solid fa-bolt"></i> Quick Actions
      </p>
      <div class="quick-actions">
        <button class="btn btn-primary" onclick="App.showSection('orders'); Orders.openOrderForm();">
          <i class="fa-solid fa-plus"></i> New Tour Order
        </button>
        <button class="btn btn-secondary" onclick="App.showSection('optimizer');">
          <i class="fa-solid fa-route"></i> Optimize Route
        </button>
        <button class="btn btn-secondary" onclick="App.showSection('loading');">
          <i class="fa-solid fa-layer-group"></i> View Loading Plan
        </button>
        <button class="btn btn-warning" id="btn-load-sample-data">
          <i class="fa-solid fa-database"></i> Load Sample Data
        </button>
      </div>`;

    // ── Recent tours ──
    const recentTours = [...tours]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    let recentHtml = '';
    if (recentTours.length > 0) {
      const rows = recentTours.map(t => {
        const truck   = Storage.getById(KEYS.TRUCKS, t.truckId);
        const dateStr = t.date ? new Date(t.date + 'T00:00:00').toLocaleDateString() : '—';
        const stops   = (t.orderLines || []).length;
        return `
          <tr>
            <td><strong>${App.escapeHtml(t.name)}</strong></td>
            <td>${dateStr}</td>
            <td>${truck ? App.escapeHtml(truck.name) : '—'}</td>
            <td>${stops} stop${stops !== 1 ? 's' : ''}</td>
            <td><span class="badge badge-${t.status || 'draft'}">${t.status || 'draft'}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" title="Optimize" onclick="App.showSection('optimizer'); Optimizer.renderOptimizerSection('${t.id}');">
                  <i class="fa-solid fa-route"></i>
                </button>
                <button class="btn-icon" title="Loading Plan" onclick="Loading.renderLoadingPlan('${t.id}'); App.showSection('loading');">
                  <i class="fa-solid fa-layer-group"></i>
                </button>
              </div>
            </td>
          </tr>`;
      }).join('');

      recentHtml = `
        <p class="dashboard-section-title">
          <i class="fa-solid fa-clock-rotate-left"></i> Recent Tours
        </p>
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Truck</th>
                <th>Stops</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    } else {
      recentHtml = `
        <p class="dashboard-section-title"><i class="fa-solid fa-clock-rotate-left"></i> Recent Tours</p>
        <div class="empty-state">
          <i class="fa-solid fa-clipboard-list"></i>
          <p>No tours yet. Use the button above to create your first tour!</p>
        </div>`;
    }

    // ── System info ──
    const totalCapacity = trucks.reduce((s, t) => s + (t.totalCapacity || 0), 0);
    const infoHtml = `
      <p class="dashboard-section-title"><i class="fa-solid fa-circle-info"></i> Fleet Overview</p>
      <div class="stats-grid">
        <div class="stat-card" style="border-left-color:#607D8B;">
          <div class="stat-icon" style="background:rgba(96,125,139,.1);color:#607D8B;">
            <i class="fa-solid fa-gauge"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${(totalCapacity / 1000).toFixed(0)}k</div>
            <div class="stat-label">Total Fleet Capacity (L)</div>
          </div>
        </div>
        <div class="stat-card" style="border-left-color:#0277BD;">
          <div class="stat-icon" style="background:rgba(2,119,189,.1);color:#0277BD;">
            <i class="fa-solid fa-route"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${tours.filter(t => t.status === 'optimized').length}</div>
            <div class="stat-label">Optimised Tours</div>
          </div>
        </div>
        <div class="stat-card" style="border-left-color:#4CAF50;">
          <div class="stat-icon" style="background:rgba(76,175,80,.1);color:#4CAF50;">
            <i class="fa-solid fa-check-circle"></i>
          </div>
          <div class="stat-info">
            <div class="stat-value">${tours.filter(t => t.status === 'executed').length}</div>
            <div class="stat-label">Executed Tours</div>
          </div>
        </div>
      </div>`;

    container.innerHTML = statsHtml + actionsHtml + recentHtml + infoHtml;

    // Wire the "Load Sample Data" button
    const sampleBtn = document.getElementById('btn-load-sample-data');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        if (typeof SampleData !== 'undefined') {
          SampleData.loadSampleData();
          // Re-render dashboard to show new counts
          renderDashboard();
        } else {
          App.showToast('Sample data module not loaded.', 'error');
        }
      });
    }
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    // Initial render is triggered by showSection('dashboard') in app.js
  }

  return { init, renderDashboard };

})();
