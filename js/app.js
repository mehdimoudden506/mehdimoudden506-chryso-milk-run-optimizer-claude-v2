'use strict';

/**
 * app.js — Main application bootstrap
 * Handles: section navigation, toast notifications, spinner, modal management.
 * All module init() functions are called from App.init().
 */

const App = (() => {

  // Track the currently active section name
  let _currentSection = 'dashboard';

  // ─── Toast Notification ─────────────────────────────────────

  /**
   * Display a toast notification.
   * @param {string} message  Text to show
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} [duration=3500]  Auto-dismiss delay in ms
   */
  function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      warning: 'fa-triangle-exclamation',
      info:    'fa-circle-info',
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    // Auto-dismiss
    const timer = setTimeout(() => dismissToast(toast), duration);

    // Click-to-dismiss
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      dismissToast(toast);
    });
  }

  function dismissToast(toast) {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  // ─── Loading Spinner ─────────────────────────────────────────

  /**
   * Show the full-page loading spinner.
   * @param {string} [message='Processing…']
   */
  function showSpinner(message = 'Processing…') {
    const overlay = document.getElementById('spinner-overlay');
    const msg     = document.getElementById('spinner-message');
    if (overlay) overlay.classList.remove('hidden');
    if (msg)     msg.textContent = message;
  }

  /** Hide the loading spinner. */
  function hideSpinner() {
    const overlay = document.getElementById('spinner-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ─── Modal ───────────────────────────────────────────────────

  /**
   * Open the shared modal dialog.
   * @param {string} title    Modal heading
   * @param {string} content  Inner HTML for the modal body
   * @param {string} [size]   Optional extra CSS class on the dialog
   */
  function openModal(title, content, size) {
    const overlay = document.getElementById('modal-overlay');
    const dialog  = document.getElementById('modal-dialog');
    const titleEl = document.getElementById('modal-title');
    const bodyEl  = document.getElementById('modal-body');

    titleEl.textContent = title;
    bodyEl.innerHTML    = content;

    // Optional size class
    dialog.className = 'modal-dialog' + (size ? ` modal-${size}` : '');

    overlay.classList.remove('hidden');
    // Focus first focusable element
    const focusable = bodyEl.querySelector('input, select, textarea, button');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  }

  /** Close the modal dialog. */
  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }

  // ─── Section Navigation ──────────────────────────────────────

  /**
   * Show a named section and update nav state.
   * @param {string} sectionName  e.g. 'dashboard', 'clients', …
   */
  function showSection(sectionName) {
    // Deactivate all sections
    document.querySelectorAll('.app-section').forEach(s => s.classList.remove('active'));
    // Deactivate all nav items
    document.querySelectorAll('.nav-item').forEach(a => a.classList.remove('active'));

    const target = document.getElementById(`section-${sectionName}`);
    if (target) {
      target.classList.add('active');
      _currentSection = sectionName;
    }

    // Highlight matching nav link
    const link = document.querySelector(`.nav-item[data-section="${sectionName}"]`);
    if (link) link.classList.add('active');

    // Call each module's onShow hook when switching sections
    _onSectionShown(sectionName);

    // Collapse mobile nav
    document.getElementById('nav-links').classList.remove('open');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Delegate rendering to the relevant module when a section becomes active. */
  function _onSectionShown(name) {
    switch (name) {
      case 'dashboard': Dashboard.renderDashboard(); break;
      case 'clients':
        Clients.renderClientsTable();
        Clients.renderClientsMap();
        break;
      case 'trucks':   Trucks.renderTrucksTable(); break;
      case 'products': Products.renderProductsTable(); break;
      case 'orders':   Orders.renderOrdersList(); break;
      case 'optimizer':Optimizer.renderOptimizerSection(); break;
      case 'loading':  Loading.renderLoadingPlan(); break;
    }
  }

  // ─── Utility — HTML escape ───────────────────────────────────

  /**
   * Escape HTML entities to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Initialisation ──────────────────────────────────────────

  function init() {
    // Wire up navigation clicks
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const section = link.getAttribute('data-section');
        if (section) showSection(section);
      });
    });

    // Mobile nav toggle
    const toggle = document.getElementById('nav-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        document.getElementById('nav-links').classList.toggle('open');
      });
    }

    // Modal backdrop click — close modal
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Modal close button
    const closeBtn = document.getElementById('modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Keyboard: Escape → close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    // Initialise all modules
    Clients.init();
    Trucks.init();
    Products.init();
    Orders.init();
    Optimizer.init();
    Loading.init();
    Dashboard.init();

    // Show default section
    showSection('dashboard');
  }

  // Boot on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  return { showSection, showToast, showSpinner, hideSpinner, openModal, closeModal, escapeHtml };

})();
