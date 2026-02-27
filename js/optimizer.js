'use strict';

/**
 * optimizer.js — Route optimization algorithms and UI
 *
 * Algorithms implemented:
 *   1. Nearest Neighbor heuristic (fast initial solution)
 *   2. 2-opt improvement (local search)
 */

const Optimizer = (() => {

  // Currently selected tour id
  let _selectedTourId = null;

  // ─── Math helpers ────────────────────────────────────────────

  /**
   * Calculate the great-circle distance between two GPS points using the Haversine formula.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number} Distance in kilometres
   */
  function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth radius in km
    const dLat = _toRad(lat2 - lat1);
    const dLng = _toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(_toRad(lat1)) * Math.cos(_toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function _toRad(deg) { return deg * Math.PI / 180; }

  /**
   * Build an NxN symmetric distance matrix for an ordered array of points.
   * @param {Array<{lat:number, lng:number}>} points
   * @returns {number[][]}
   */
  function buildDistanceMatrix(points) {
    const n = points.length;
    const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const d = haversineDistance(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
        matrix[i][j] = d;
        matrix[j][i] = d;
      }
    }
    return matrix;
  }

  /**
   * Calculate total tour distance: depot → stops[0] → … → stops[n-1] → depot.
   * @param {Array<{lat,lng}>} stops  Ordered stops
   * @param {{lat,lng}} depot
   * @returns {number} km
   */
  function calculateTotalDistance(stops, depot) {
    if (!stops.length) return 0;
    let dist = haversineDistance(depot.lat, depot.lng, stops[0].lat, stops[0].lng);
    for (let i = 0; i < stops.length - 1; i++) {
      dist += haversineDistance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    }
    dist += haversineDistance(stops[stops.length - 1].lat, stops[stops.length - 1].lng, depot.lat, depot.lng);
    return dist;
  }

  // ─── Nearest Neighbour ────────────────────────────────────────

  /**
   * Nearest-Neighbour heuristic: always go to the closest unvisited stop.
   * @param {Array<{id,lat,lng}>} stops  Stops to visit (any order)
   * @param {{lat,lng}} depot
   * @returns {Array}  Ordered stops
   */
  function nearestNeighbor(stops, depot) {
    if (!stops.length) return [];
    const remaining = [...stops];
    const ordered   = [];
    let current = depot;

    while (remaining.length) {
      let bestIdx = 0;
      let bestDist = Infinity;
      remaining.forEach((stop, i) => {
        const d = haversineDistance(current.lat, current.lng, stop.lat, stop.lng);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      });
      const next = remaining.splice(bestIdx, 1)[0];
      ordered.push(next);
      current = next;
    }

    return ordered;
  }

  // ─── 2-opt ───────────────────────────────────────────────────

  /**
   * 2-opt local search: iteratively try reversing sub-routes to find improvements.
   *
   * Matrix layout: allPoints = [depot, stops[0], stops[1], …, stops[n-1]]
   *   → depot     = matrix index 0
   *   → stops[k]  = matrix index k+1
   *
   * For a reversal of stops[i..j]:
   *   Break edges: (prev(i) → stops[i])  and  (stops[j] → next(j))
   *   Add  edges: (prev(i) → stops[j])  and  (stops[i] → next(j))
   *
   * @param {Array<{lat,lng}>} stops   Ordered stops
   * @param {number[][]}       matrix  Distance matrix with depot at index 0, stops at 1..n
   * @returns {Array}  Improved stop order
   */
  function twoOpt(stops, matrix) {
    if (stops.length < 3) return stops; // Need at least 3 stops to improve

    const n    = stops.length;
    let best     = [...stops];
    let improved = true;

    while (improved) {
      improved = false;
      for (let i = 0; i < n - 1; i++) {
        for (let j = i + 1; j < n; j++) {
          // Matrix indices (depot is at index 0, stops[k] is at index k+1):
          //   prevI  = node before stops[i]: depot (0) when i=0, else stops[i-1] at index i
          //   nodeI  = stops[i]  → index i+1
          //   nodeJ  = stops[j]  → index j+1
          //   nextJ  = node after stops[j]: depot (0) when j=n-1, else stops[j+1] at index j+2
          // When i=0: prevI=0 → depot. When i>0: prevI=i → stops[i-1] (which is at matrix index i).
          const prevI = i;
          const nodeI = i + 1;
          const nodeJ = j + 1;
          const nextJ = j === n - 1 ? 0 : j + 2;

          const currentCost  = matrix[prevI][nodeI] + matrix[nodeJ][nextJ];
          const reversedCost = matrix[prevI][nodeJ] + matrix[nodeI][nextJ];

          if (reversedCost < currentCost - 1e-9) {
            // Reverse stops[i..j] in-place
            const seg = best.slice(i, j + 1).reverse();
            best = [...best.slice(0, i), ...seg, ...best.slice(j + 1)];
            improved = true;
          }
        }
      }
    }
    return best;
  }

  // ─── Main Optimizer ──────────────────────────────────────────

  /**
   * Run the full optimization pipeline for a given tour:
   *   1. Resolve client coordinates
   *   2. Nearest Neighbour
   *   3. 2-opt improvement
   *   4. Persist updated orderLines sequence
   *   5. Update tour status to "optimized"
   *
   * @param {string} tourId
   * @returns {{original:number, optimized:number, improvement:number, stops:Array}|null}
   */
  function optimizeTour(tourId) {
    const tour = Storage.getById(KEYS.TOURS, tourId);
    if (!tour) { App.showToast('Tour not found.', 'error'); return null; }

    const depot = { lat: tour.depotLat, lng: tour.depotLng };
    if (!depot.lat || !depot.lng) {
      App.showToast('Depot coordinates are missing. Please geocode the depot address.', 'warning');
      return null;
    }

    // Build enriched stop list
    const stops = _buildStopList(tour);
    if (!stops.length) {
      App.showToast('No stops with GPS coordinates found in this tour.', 'warning');
      return null;
    }

    // Calculate original distance (current sequence)
    const originalDist = calculateTotalDistance(stops, depot);

    // Step 1: Nearest Neighbour
    let optimized = nearestNeighbor(stops, depot);

    // Step 2: Build distance matrix for 2-opt (depot at index 0)
    const allPoints = [depot, ...optimized];
    const matrix    = buildDistanceMatrix(allPoints);
    optimized       = twoOpt(optimized, matrix);

    const optimizedDist = calculateTotalDistance(optimized, depot);
    const improvement   = originalDist > 0
      ? ((originalDist - optimizedDist) / originalDist) * 100
      : 0;

    // Persist new order: map back to orderLine ids
    const newOrderLines = optimized.map(stop => stop._line);
    Storage.update(KEYS.TOURS, tourId, {
      orderLines: newOrderLines,
      status: 'optimized',
    });

    return {
      original:    originalDist,
      optimized:   optimizedDist,
      improvement: Math.max(0, improvement),
      stops:       optimized,
    };
  }

  /**
   * Build an enriched list of stops from a tour's order lines.
   * Each stop contains client info + the original orderLine for re-saving.
   * Skips lines where the client has no coordinates.
   * @param {Object} tour
   * @returns {Array}
   */
  function _buildStopList(tour) {
    const stops = [];
    (tour.orderLines || []).forEach(line => {
      const client  = Storage.getById(KEYS.CLIENTS, line.clientId);
      const product = Storage.getById(KEYS.PRODUCTS, line.productId);
      if (!client || !client.lat || !client.lng) return;
      stops.push({
        lat:         client.lat,
        lng:         client.lng,
        clientId:    client.id,
        clientName:  client.name,
        address:     client.address || '',
        productName: product ? product.name : '—',
        quantity:    line.quantity || 0,
        _line:       line, // original line object for re-saving
      });
    });
    return stops;
  }

  // ─── UI Rendering ────────────────────────────────────────────

  /**
   * Render the optimizer section.
   * @param {string} [preselectedTourId]  Tour to pre-select
   */
  function renderOptimizerSection(preselectedTourId) {
    const container = document.getElementById('optimizer-content');
    if (!container) return;

    if (preselectedTourId) _selectedTourId = preselectedTourId;

    const tours = Storage.getAll(KEYS.TOURS);

    if (tours.length === 0) {
      container.innerHTML = `
        <div class="alert alert-info">
          <i class="fa-solid fa-circle-info"></i>
          No tours found. Please <a href="#" onclick="App.showSection('orders')">create a tour order</a> first.
        </div>`;
      return;
    }

    const tourOpts = tours.map(t =>
      `<option value="${t.id}" ${_selectedTourId === t.id ? 'selected' : ''}>
        ${App.escapeHtml(t.name)} (${t.status || 'draft'}) — ${(t.orderLines || []).length} stops
      </option>`
    ).join('');

    container.innerHTML = `
      <div class="optimizer-controls">
        <div class="form-group">
          <label for="opt-tour-select">Select Tour</label>
          <select id="opt-tour-select">${tourOpts}</select>
        </div>
        <button class="btn btn-primary" id="btn-run-optimizer">
          <i class="fa-solid fa-play"></i> Run Optimizer
        </button>
        <button class="btn btn-secondary" id="btn-view-loading-from-opt">
          <i class="fa-solid fa-layer-group"></i> View Loading Plan
        </button>
      </div>
      <div id="optimizer-map-section" style="margin-bottom:1.25rem;">
        <div id="tour-map" class="map-container"></div>
      </div>
      <div id="optimizer-results"></div>`;

    // Show current tour on map immediately
    _selectedTourId = _selectedTourId || tours[0].id;
    document.getElementById('opt-tour-select').value = _selectedTourId;
    _renderCurrentTourOnMap(_selectedTourId);
    _renderStopsList(_selectedTourId);

    document.getElementById('opt-tour-select').addEventListener('change', (e) => {
      _selectedTourId = e.target.value;
      _renderCurrentTourOnMap(_selectedTourId);
      _renderStopsList(_selectedTourId);
    });

    document.getElementById('btn-run-optimizer').addEventListener('click', () => {
      if (!_selectedTourId) { App.showToast('Select a tour first.', 'warning'); return; }
      App.showSpinner('Optimizing route…');
      setTimeout(() => {
        const result = optimizeTour(_selectedTourId);
        App.hideSpinner();
        if (result) {
          App.showToast(`Route optimised! Saved ${result.improvement.toFixed(1)}% distance.`, 'success');
          _renderOptimizerResults(result);
          _renderCurrentTourOnMap(_selectedTourId);
          _renderStopsList(_selectedTourId);
        }
      }, 100); // allow spinner to render first
    });

    document.getElementById('btn-view-loading-from-opt').addEventListener('click', () => {
      if (!_selectedTourId) { App.showToast('Select a tour first.', 'warning'); return; }
      Loading.renderLoadingPlan(_selectedTourId);
      App.showSection('loading');
    });
  }

  /** Render the tour route on the map. */
  function _renderCurrentTourOnMap(tourId) {
    const tour = Storage.getById(KEYS.TOURS, tourId);
    if (!tour) return;
    const stops = _buildStopList(tour);
    const depot = { lat: tour.depotLat, lng: tour.depotLng, name: tour.depotAddress || 'Depot' };
    MapManager.showTourRoute(stops, depot, 'tour-map');
  }

  /** Render the stops list panel. */
  function _renderStopsList(tourId) {
    const resultsDiv = document.getElementById('optimizer-results');
    if (!resultsDiv) return;

    const tour = Storage.getById(KEYS.TOURS, tourId);
    if (!tour) return;

    const stops = _buildStopList(tour);

    if (stops.length === 0) {
      resultsDiv.innerHTML = `
        <div class="alert alert-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          No stops have GPS coordinates. Please geocode client addresses in the Clients section.
        </div>`;
      return;
    }

    const depot = { lat: tour.depotLat, lng: tour.depotLng };
    const dist  = calculateTotalDistance(stops, depot);

    const stopsHtml = stops.map((stop, idx) => `
      <div class="stop-item">
        <div class="stop-number">${idx + 1}</div>
        <div class="stop-info">
          <div class="stop-name">${App.escapeHtml(stop.clientName)}</div>
          <div class="stop-address">${App.escapeHtml(stop.address)} — ${App.escapeHtml(stop.productName)} · ${Number(stop.quantity).toLocaleString()} L</div>
        </div>
        <div class="stop-reorder">
          <button class="btn-icon btn-sm" title="Move up"   onclick="Optimizer.moveStop('${tourId}',${idx},'up')">
            <i class="fa-solid fa-arrow-up"></i>
          </button>
          <button class="btn-icon btn-sm" title="Move down" onclick="Optimizer.moveStop('${tourId}',${idx},'down')">
            <i class="fa-solid fa-arrow-down"></i>
          </button>
        </div>
      </div>`).join('');

    resultsDiv.innerHTML = `
      <div class="optimizer-results">
        <div class="distance-comparison">
          <div class="distance-metric">
            <div class="metric-label">Current Distance</div>
            <div class="metric-value">${dist.toFixed(1)}</div>
            <div class="metric-unit">kilometres</div>
          </div>
          <div class="distance-metric">
            <div class="metric-label">Stops</div>
            <div class="metric-value">${stops.length}</div>
            <div class="metric-unit">deliveries</div>
          </div>
          <div class="distance-metric">
            <div class="metric-label">Status</div>
            <div class="metric-value" style="font-size:1rem;">
              <span class="badge badge-${tour.status || 'draft'}">${tour.status || 'draft'}</span>
            </div>
          </div>
        </div>
        <h3 class="dashboard-section-title mt-2">
          <i class="fa-solid fa-list-ol"></i> Delivery Sequence
        </h3>
        <div class="stops-list">${stopsHtml}</div>
      </div>`;
  }

  /**
   * Render the before/after optimizer results panel.
   * @param {{original,optimized,improvement}} result
   */
  function _renderOptimizerResults(result) {
    const panel = document.getElementById('optimizer-results');
    if (!panel) return;

    // Inject comparison metrics at the top of the results div
    const compHtml = `
      <div class="optimizer-results" id="opt-comparison" style="margin-bottom:1rem;">
        <div class="distance-comparison">
          <div class="distance-metric">
            <div class="metric-label">Original Distance</div>
            <div class="metric-value">${result.original.toFixed(1)}</div>
            <div class="metric-unit">km</div>
          </div>
          <div class="distance-metric">
            <div class="metric-label">Optimised Distance</div>
            <div class="metric-value">${result.optimized.toFixed(1)}</div>
            <div class="metric-unit">km</div>
          </div>
          <div class="distance-metric improvement">
            <div class="metric-label">Distance Saved</div>
            <div class="metric-value">${result.improvement.toFixed(1)}%</div>
            <div class="metric-unit">${(result.original - result.optimized).toFixed(1)} km less</div>
          </div>
        </div>
      </div>`;

    // Prepend to panel (keeps stop list below)
    panel.insertAdjacentHTML('afterbegin', compHtml);
  }

  /**
   * Manually reorder a stop by moving it up or down.
   * @param {string} tourId
   * @param {number} idx      Current index
   * @param {'up'|'down'} dir
   */
  function moveStop(tourId, idx, dir) {
    const tour = Storage.getById(KEYS.TOURS, tourId);
    if (!tour) return;

    const lines = [...(tour.orderLines || [])];
    const swapWith = dir === 'up' ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= lines.length) return;

    [lines[idx], lines[swapWith]] = [lines[swapWith], lines[idx]];
    Storage.update(KEYS.TOURS, tourId, { orderLines: lines });

    _renderCurrentTourOnMap(tourId);
    _renderStopsList(tourId);
  }

  // ─── Init ─────────────────────────────────────────────────────

  function init() {
    // Nothing to wire on page load; rendering is triggered by showSection.
  }

  return {
    init,
    haversineDistance,
    nearestNeighbor,
    twoOpt,
    buildDistanceMatrix,
    optimizeTour,
    calculateTotalDistance,
    renderOptimizerSection,
    moveStop,
  };

})();
