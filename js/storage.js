'use strict';

/**
 * storage.js — LocalStorage CRUD helpers
 * Each item automatically receives:
 *   - id        : UUID v4
 *   - createdAt : ISO timestamp (on create)
 *   - updatedAt : ISO timestamp (on create & update)
 */

const Storage = (() => {

  // ---------- Private helpers ----------

  /**
   * Generate a simple UUID v4.
   * @returns {string} UUID string
   */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Read the full array stored under a key.
   * @param {string} key  LocalStorage key
   * @returns {Array}
   */
  function readStore(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error(`[Storage] Failed to read "${key}":`, e);
      return [];
    }
  }

  /**
   * Persist an array under a key.
   * @param {string} key
   * @param {Array}  items
   */
  function writeStore(key, items) {
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch (e) {
      console.error(`[Storage] Failed to write "${key}":`, e);
    }
  }

  // ---------- Public API ----------

  /**
   * Get all items for a key.
   * @param {string} key
   * @returns {Array}
   */
  function getAll(key) {
    return readStore(key);
  }

  /**
   * Get a single item by id.
   * @param {string} key
   * @param {string} id
   * @returns {Object|undefined}
   */
  function getById(key, id) {
    return readStore(key).find(item => item.id === id);
  }

  /**
   * Save (insert) a new item. Assigns id, createdAt, updatedAt.
   * @param {string} key
   * @param {Object} item  Data to save (without id/timestamps)
   * @returns {Object}     Saved item with generated fields
   */
  function save(key, item) {
    const items = readStore(key);
    const now = new Date().toISOString();
    const newItem = {
      ...item,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    items.push(newItem);
    writeStore(key, items);
    return newItem;
  }

  /**
   * Update an existing item by id (shallow merge).
   * @param {string} key
   * @param {string} id
   * @param {Object} updates  Fields to update
   * @returns {Object|null}   Updated item, or null if not found
   */
  function update(key, id, updates) {
    const items = readStore(key);
    const idx = items.findIndex(item => item.id === id);
    if (idx === -1) return null;

    const updatedItem = {
      ...items[idx],
      ...updates,
      id,                           // id must not change
      createdAt: items[idx].createdAt, // createdAt must not change
      updatedAt: new Date().toISOString(),
    };
    items[idx] = updatedItem;
    writeStore(key, items);
    return updatedItem;
  }

  /**
   * Remove an item by id.
   * @param {string} key
   * @param {string} id
   * @returns {boolean}  true if removed, false if not found
   */
  function remove(key, id) {
    const items = readStore(key);
    const filtered = items.filter(item => item.id !== id);
    if (filtered.length === items.length) return false;
    writeStore(key, filtered);
    return true;
  }

  /**
   * Clear all items under a key.
   * @param {string} key
   */
  function clear(key) {
    localStorage.removeItem(key);
  }

  // Expose public API
  return { getAll, getById, save, update, remove, clear };

})();

// Storage keys used across the app
const KEYS = {
  CLIENTS:  'mropt_clients',
  TRUCKS:   'mropt_trucks',
  PRODUCTS: 'mropt_products',
  TOURS:    'mropt_tours',
  SETTINGS: 'mropt_settings',
};
