'use strict';

/**
 * map.js — Leaflet map management
 * Provides: initMap, showTourRoute, showClientsMap, clearMap
 */

const MapManager = (() => {

  // Registry of all Leaflet map instances, keyed by container id
  const _maps   = {};
  // Registry of layer groups, keyed by container id
  const _layers = {};

  // ─── Map Initialization ──────────────────────────────────────

  /**
   * Initialize (or retrieve) a Leaflet map in the given container.
   * @param {string} containerId  HTML element id
   * @returns {L.Map}
   */
  function initMap(containerId) {
    // Return existing map instance if already initialised
    if (_maps[containerId]) return _maps[containerId];

    const container = document.getElementById(containerId);
    if (!container) return null;

    // Default view: Paris, France
    const map = L.map(containerId, {
      center: [48.8566, 2.3522],
      zoom:   11,
      zoomControl: true,
    });

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Layer group for dynamic features
    const layerGroup = L.layerGroup().addTo(map);

    _maps[containerId]   = map;
    _layers[containerId] = layerGroup;

    return map;
  }

  // ─── Icons ───────────────────────────────────────────────────

  /**
   * Create a numbered circle marker icon.
   * @param {number} number
   * @param {string} [bgColor='#1565C0']
   * @returns {L.DivIcon}
   */
  function _numberedIcon(number, bgColor = '#1565C0') {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:${bgColor};color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:12px;
        border:2px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      ">${number}</div>`,
      iconSize:   [28, 28],
      iconAnchor: [14, 14],
      popupAnchor:[0, -16],
    });
  }

  /**
   * Create a depot/home icon.
   * @returns {L.DivIcon}
   */
  function _depotIcon() {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:34px;height:34px;border-radius:50%;
        background:#E65100;color:#fff;
        display:flex;align-items:center;justify-content:center;
        font-size:14px;
        border:2px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
      "><i class='fa-solid fa-warehouse'></i></div>`,
      iconSize:   [34, 34],
      iconAnchor: [17, 17],
      popupAnchor:[0, -18],
    });
  }

  /**
   * Create a small client pin icon.
   * @returns {L.DivIcon}
   */
  function _clientIcon(color = '#1565C0') {
    return L.divIcon({
      className: '',
      html: `<div style="
        width:14px;height:14px;border-radius:50%;
        background:${color};
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,.3);
      "></div>`,
      iconSize:   [14, 14],
      iconAnchor: [7, 7],
      popupAnchor:[0, -10],
    });
  }

  // ─── Clear ────────────────────────────────────────────────────

  /**
   * Clear all dynamic layers from a map.
   * @param {string} containerId
   */
  function clearMap(containerId) {
    if (_layers[containerId]) _layers[containerId].clearLayers();
  }

  // ─── Tour Route ──────────────────────────────────────────────

  /**
   * Render an ordered tour route on the map.
   *
   * @param {Array<{lat,lng,clientName,productName,quantity}>} stops  Ordered stops
   * @param {{lat,lng,name}} depot
   * @param {string} [containerId='tour-map']
   */
  function showTourRoute(stops, depot, containerId = 'tour-map') {
    // Ensure map exists
    const map = _maps[containerId] || initMap(containerId);
    if (!map) return;

    clearMap(containerId);
    const layer = _layers[containerId];

    const allPoints = [];

    // Depot marker
    if (depot && depot.lat && depot.lng) {
      L.marker([depot.lat, depot.lng], { icon: _depotIcon() })
        .bindPopup(`<strong><i class='fa-solid fa-warehouse'></i> Depot</strong><br>${App.escapeHtml(depot.name || 'Depot')}`)
        .addTo(layer);
      allPoints.push([depot.lat, depot.lng]);
    }

    if (!stops.length) {
      if (allPoints.length) map.setView(allPoints[0], 11);
      return;
    }

    // Stop markers
    stops.forEach((stop, idx) => {
      if (!stop.lat || !stop.lng) return;

      const popupContent = `
        <div style="min-width:160px;">
          <strong>${idx + 1}. ${App.escapeHtml(stop.clientName || 'Client')}</strong><br>
          <span style="color:#607D8B;font-size:.85em;">${App.escapeHtml(stop.address || '')}</span><br>
          <span style="margin-top:.4em;display:inline-block;">
            📦 ${App.escapeHtml(stop.productName || '—')} · ${Number(stop.quantity || 0).toLocaleString()} L
          </span>
        </div>`;

      L.marker([stop.lat, stop.lng], { icon: _numberedIcon(idx + 1) })
        .bindPopup(popupContent)
        .addTo(layer);

      allPoints.push([stop.lat, stop.lng]);
    });

    // Polyline: depot → stop1 → … → stopN → depot
    const linePoints = [];
    if (depot && depot.lat && depot.lng) linePoints.push([depot.lat, depot.lng]);
    stops.forEach(s => { if (s.lat && s.lng) linePoints.push([s.lat, s.lng]); });
    if (depot && depot.lat && depot.lng) linePoints.push([depot.lat, depot.lng]);

    if (linePoints.length > 1) {
      L.polyline(linePoints, {
        color:  '#1565C0',
        weight: 3,
        opacity: 0.75,
        dashArray: '8, 4',
      }).addTo(layer);
    }

    // Fit map to all points
    if (allPoints.length > 0) {
      try { map.fitBounds(allPoints, { padding: [40, 40], maxZoom: 14 }); } catch (e) { /* ignore */ }
    }
  }

  // ─── Clients Map ─────────────────────────────────────────────

  /**
   * Display all clients on a small preview map.
   * @param {string} containerId
   * @param {Array<{lat,lng,name,address}>} clients
   * @param {L.Map} [existingMap]  Re-use an existing map instance
   */
  function showClientsMap(containerId, clients, existingMap) {
    const map = existingMap || _maps[containerId] || initMap(containerId);
    if (!map) return;

    clearMap(containerId);
    const layer = _layers[containerId];

    const validClients = clients.filter(c => c.lat && c.lng);
    if (!validClients.length) {
      map.setView([48.8566, 2.3522], 11);
      return;
    }

    const bounds = [];
    validClients.forEach(c => {
      L.marker([c.lat, c.lng], { icon: _clientIcon() })
        .bindPopup(`<strong>${App.escapeHtml(c.name)}</strong><br>${App.escapeHtml(c.address || '')}`)
        .addTo(layer);
      bounds.push([c.lat, c.lng]);
    });

    try { map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 }); } catch (e) { /* ignore */ }
  }

  // ─── Init ─────────────────────────────────────────────────────

  /** Called by app.js — nothing to pre-initialize here. */
  function init() {}

  return { init, initMap, showTourRoute, showClientsMap, clearMap };

})();
