'use strict';

/**
 * loading.js — Truck loading plan calculation and visualization
 *
 * Loading algorithm:
 *   1. Stops are sorted in REVERSE delivery order (last stop gets loaded first → is at the back).
 *   2. For each product batch, attempt First-Fit Decreasing bin-packing into truck compartments.
 *   3. Compartment constraints (allowed products, capacity) are respected.
 *   4. Infeasible assignments are flagged visually.
 */

const Loading = (() => {

  // References to Chart.js instances keyed by compartment id
  const _charts = {};

  // ─── Algorithm ───────────────────────────────────────────────

  /**
   * Calculate the loading plan for a given tour and truck.
   *
   * @param {Object} tour   Tour document from storage
   * @param {Object} truck  Truck document from storage
   * @returns {{
   *   loadingOrder: Array,          // stops in loading order (reverse delivery)
   *   compartmentAssignments: Object, // compartmentId → [{stopName, productName, quantity, color}]
   *   infeasible: Array,            // lines that could not be assigned
   *   utilization: Object           // compartmentId → {used, total, pct}
   * }}
   */
  function calculateLoadingPlan(tour, truck) {
    const compartments = (truck.compartments || []).map(c => ({
      ...c,
      remaining: Number(c.capacity) || 0,
    }));

    // Build reverse delivery order (last delivery = loaded first)
    // We track the original delivery position explicitly for accurate stop labelling.
    const orderedLines = tour.orderLines || [];
    const allLines = orderedLines.map((line, origIdx) => ({ line, origIdx })).reverse();

    const assignments  = {};  // compartmentId → assignment rows
    const infeasible   = [];
    const utilization  = {};

    compartments.forEach(c => {
      assignments[c.id]  = [];
      utilization[c.id]  = { used: 0, total: Number(c.capacity) || 0, pct: 0 };
    });

    // Process each order line
    allLines.forEach(({ line, origIdx }, loadIdx) => {
      const client  = Storage.getById(KEYS.CLIENTS, line.clientId);
      const product = Storage.getById(KEYS.PRODUCTS, line.productId);
      if (!client || !product) return;

      const qty = Number(line.quantity) || 0;
      if (qty <= 0) return;

      // Find the best compartment using First-Fit:
      // 1. Must allow this product (or allow any)
      // 2. Must have enough remaining capacity
      let assigned = false;
      for (const comp of compartments) {
        const allowsProduct =
          !comp.allowedProducts ||
          comp.allowedProducts.length === 0 ||
          comp.allowedProducts.includes(product.id);

        if (allowsProduct && comp.remaining >= qty) {
          comp.remaining -= qty;
          assignments[comp.id].push({
            loadOrder:    loadIdx + 1,
            // origIdx is 0-based delivery position; +1 for human-readable stop number
            deliveryStop: `Stop ${origIdx + 1} — ${client.name}`,
            clientName:  client.name,
            productName: product.name,
            productColor: product.color || '#999',
            quantity:    qty,
            unit:        product.unit || 'L',
          });
          utilization[comp.id].used += qty;
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        infeasible.push({
          clientName:  client.name,
          productName: product.name,
          quantity:    qty,
          reason:      _infeasibleReason(compartments, product, qty),
        });
      }
    });

    // Calculate utilization percentages
    compartments.forEach(c => {
      const u = utilization[c.id];
      u.pct = u.total > 0 ? (u.used / u.total) * 100 : 0;
    });

    return {
      // Extract just the line objects for the loading order table
      loadingOrder:            allLines.map(({ line }) => line),
      compartmentAssignments:  assignments,
      infeasible,
      utilization,
    };
  }

  /**
   * Determine why a line could not be assigned.
   * @param {Array}  compartments  Compartments with 'remaining'
   * @param {Object} product
   * @param {number} qty
   * @returns {string}
   */
  function _infeasibleReason(compartments, product, qty) {
    const anyAllows = compartments.some(c =>
      !c.allowedProducts || c.allowedProducts.length === 0 || c.allowedProducts.includes(product.id)
    );
    if (!anyAllows) return `No compartment is allowed to carry ${product.name}.`;
    const anyFits = compartments.some(c => c.remaining >= qty);
    if (!anyFits) return `No compartment has enough remaining capacity (${qty} L needed).`;
    return 'No suitable compartment found (capacity + product constraint conflict).';
  }

  // ─── Rendering ───────────────────────────────────────────────

  /**
   * Render the full loading plan section.
   * @param {string} [tourId]  Pre-select this tour
   */
  function renderLoadingPlan(tourId) {
    _destroyAllCharts();

    const container = document.getElementById('loading-plan-content');
    if (!container) return;

    // Populate the tour selector
    const select = document.getElementById('loading-tour-select');
    if (select) {
      const tours = Storage.getAll(KEYS.TOURS);
      select.innerHTML = tours.length
        ? `<option value="">— Select tour —</option>` +
          tours.map(t => `<option value="${t.id}" ${tourId === t.id ? 'selected' : ''}>${App.escapeHtml(t.name)}</option>`).join('')
        : `<option value="">No tours available</option>`;

      if (tourId) select.value = tourId;

      // Re-render when selection changes
      select.onchange = () => renderLoadingPlan(select.value);
    }

    const selectedId = (select && select.value) || tourId;
    if (!selectedId) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="fa-solid fa-circle-info"></i>
          Select a tour above to generate the loading plan.
        </div>`;
      return;
    }

    const tour  = Storage.getById(KEYS.TOURS, selectedId);
    if (!tour) {
      container.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Tour not found.</div>`;
      return;
    }

    const truck = Storage.getById(KEYS.TRUCKS, tour.truckId);
    if (!truck) {
      container.innerHTML = `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> Truck not assigned or not found. Please edit the tour.</div>`;
      return;
    }

    const plan = calculateLoadingPlan(tour, truck);

    // ── Tour info banner ──
    const infoHtml = `
      <div class="loading-tour-info">
        <div class="loading-info-item">
          <span class="loading-info-label">Tour</span>
          <span class="loading-info-value">${App.escapeHtml(tour.name)}</span>
        </div>
        <div class="loading-info-item">
          <span class="loading-info-label">Date</span>
          <span class="loading-info-value">${tour.date ? new Date(tour.date + 'T00:00:00').toLocaleDateString() : '—'}</span>
        </div>
        <div class="loading-info-item">
          <span class="loading-info-label">Truck</span>
          <span class="loading-info-value">${App.escapeHtml(truck.name)} (${App.escapeHtml(truck.licensePlate || 'N/A')})</span>
        </div>
        <div class="loading-info-item">
          <span class="loading-info-label">Depot</span>
          <span class="loading-info-value">${App.escapeHtml(tour.depotAddress || '—')}</span>
        </div>
        <div class="loading-info-item">
          <span class="loading-info-label">Status</span>
          <span class="loading-info-value"><span class="badge badge-${tour.status || 'draft'}">${tour.status || 'draft'}</span></span>
        </div>
        <div class="loading-info-item">
          <span class="loading-info-label">Total Capacity</span>
          <span class="loading-info-value">${(truck.totalCapacity || 0).toLocaleString()} L</span>
        </div>
      </div>`;

    // ── Loading order table ──
    const orderRows = plan.loadingOrder.map((line, idx) => {
      const client  = Storage.getById(KEYS.CLIENTS, line.clientId);
      const product = Storage.getById(KEYS.PRODUCTS, line.productId);
      return `
        <tr>
          <td style="font-weight:700;text-align:center;">${idx + 1}</td>
          <td>${client ? App.escapeHtml(client.name) : '—'}</td>
          <td>
            ${product ? `<span class="color-swatch" style="background:${App.escapeHtml(product.color || '#999')}"></span>${App.escapeHtml(product.name)}` : '—'}
          </td>
          <td style="text-align:right;">${Number(line.quantity || 0).toLocaleString()} L</td>
          <td>${App.escapeHtml(line.timeWindowStart || '')}${line.timeWindowEnd ? ' – ' + App.escapeHtml(line.timeWindowEnd) : ''}</td>
        </tr>`;
    }).join('');

    const orderHtml = `
      <div class="loading-order-section">
        <div class="loading-order-title">
          <i class="fa-solid fa-arrow-up-from-bracket"></i> Loading Order (loaded first → at back of truck)
        </div>
        <div class="table-wrapper">
          <table class="assignment-table">
            <thead>
              <tr>
                <th style="width:50px;">Load #</th>
                <th>Client</th>
                <th>Product</th>
                <th style="text-align:right;">Quantity</th>
                <th>Time Window</th>
              </tr>
            </thead>
            <tbody>${orderRows || '<tr><td colspan="5" class="empty-state">No order lines.</td></tr>'}</tbody>
          </table>
        </div>
      </div>`;

    // ── Compartment diagrams ──
    const compartmentCards = (truck.compartments || []).map(comp => {
      const assignments = plan.compartmentAssignments[comp.id] || [];
      const util        = plan.utilization[comp.id] || { used: 0, total: comp.capacity, pct: 0 };
      const chartId     = `chart-comp-${comp.id}`;

      const assignRows = assignments.map(a => `
        <tr>
          <td style="text-align:center;">${a.loadOrder}</td>
          <td>${App.escapeHtml(a.clientName)}</td>
          <td>
            <span class="color-swatch" style="background:${App.escapeHtml(a.productColor)}"></span>
            ${App.escapeHtml(a.productName)}
          </td>
          <td style="text-align:right;">${Number(a.quantity).toLocaleString()} L</td>
        </tr>`).join('');

      return `
        <div class="compartment-plan-card">
          <div class="compartment-plan-header">
            <div class="compartment-plan-title">
              <i class="fa-solid fa-box"></i> ${App.escapeHtml(comp.name)}
            </div>
            <span class="compartment-capacity-badge">
              ${Number(util.used).toLocaleString()} / ${Number(util.total).toLocaleString()} L
              (${util.pct.toFixed(0)}%)
            </span>
          </div>
          <div class="chart-container">
            <canvas id="${chartId}"></canvas>
          </div>
          <table class="assignment-table">
            <thead>
              <tr>
                <th style="width:50px;">Load #</th>
                <th>Client</th>
                <th>Product</th>
                <th style="text-align:right;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${assignRows || '<tr><td colspan="4" style="text-align:center;color:#90a4ae;font-style:italic;">Empty compartment</td></tr>'}
            </tbody>
          </table>
        </div>`;
    }).join('');

    // ── Infeasible warnings ──
    const infeasibleHtml = plan.infeasible.map(item => `
      <div class="infeasible-warning">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div>
          <strong>${App.escapeHtml(item.clientName)}</strong> — ${App.escapeHtml(item.productName)}
          · ${Number(item.quantity).toLocaleString()} L<br>
          <span style="font-size:.8rem;">${App.escapeHtml(item.reason)}</span>
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="loading-plan-wrapper">
        ${infoHtml}
        ${plan.infeasible.length ? `<div style="margin-bottom:1rem;">${infeasibleHtml}</div>` : ''}
        ${orderHtml}
        <h2 class="dashboard-section-title">
          <i class="fa-solid fa-layer-group"></i> Compartment Assignments
        </h2>
        ${compartmentCards || '<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i> No compartments defined for this truck.</div>'}
      </div>`;

    // Render Chart.js diagrams after DOM is ready
    requestAnimationFrame(() => {
      (truck.compartments || []).forEach(comp => {
        const assignments = plan.compartmentAssignments[comp.id] || [];
        const chartId = `chart-comp-${comp.id}`;
        renderCompartmentDiagram(comp, assignments, chartId, plan.utilization[comp.id]);
      });
    });
  }

  /**
   * Render a stacked horizontal bar chart for one compartment.
   * @param {Object} comp          Compartment definition
   * @param {Array}  assignments   Assignment rows for this compartment
   * @param {string} canvasId      Canvas element id
   * @param {Object} utilization   {used, total, pct}
   */
  function renderCompartmentDiagram(comp, assignments, canvasId, utilization) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy old chart if it exists
    if (_charts[canvasId]) {
      _charts[canvasId].destroy();
      delete _charts[canvasId];
    }

    const total = Number(comp.capacity) || 1;

    const datasets = assignments.map(a => ({
      label:           `${a.productName} (${a.clientName})`,
      data:            [Number(a.quantity)],
      backgroundColor: a.productColor,
      borderColor:     'rgba(255,255,255,.4)',
      borderWidth:     1,
    }));

    // Remaining/empty space
    const used = assignments.reduce((s, a) => s + Number(a.quantity), 0);
    const remaining = Math.max(0, total - used);
    if (remaining > 0) {
      datasets.push({
        label:           'Empty',
        data:            [remaining],
        backgroundColor: '#ECEFF1',
        borderColor:     '#B0BEC5',
        borderWidth:     1,
      });
    }

    _charts[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: { labels: [''], datasets },
      options: {
        indexAxis:   'y',
        responsive:  true,
        maintainAspectRatio: false,
        plugins: {
          legend:  { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString()} L`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            max:     total,
            ticks:   { callback: (v) => `${v} L` },
            grid:    { color: 'rgba(0,0,0,.06)' },
          },
          y: {
            stacked: true,
            display: false,
          },
        },
      },
    });
  }

  /** Destroy all Chart.js instances to prevent memory leaks on re-render. */
  function _destroyAllCharts() {
    Object.keys(_charts).forEach(id => {
      try { _charts[id].destroy(); } catch (e) { /* ignore */ }
      delete _charts[id];
    });
  }

  /** Open a print-friendly loading plan page using window.print(). */
  function exportLoadingPlan() {
    window.print();
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    const printBtn = document.getElementById('btn-print-loading');
    if (printBtn) printBtn.addEventListener('click', exportLoadingPlan);
  }

  return {
    init,
    calculateLoadingPlan,
    renderLoadingPlan,
    renderCompartmentDiagram,
    exportLoadingPlan,
  };

})();
