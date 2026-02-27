'use strict';

/**
 * sample-data.js — Sample data loader for the Milk Run Optimizer
 *
 * Loads realistic French/Belgian dairy distribution data:
 *   - 3 trucks with compartments
 *   - 5 products (dairy goods)
 *   - 8 customer sites in the Paris region
 *   - 1 sample tour order with 6 stops
 */

const SampleData = (() => {

  // ─── Data Definitions ────────────────────────────────────────

  const SAMPLE_PRODUCTS = [
    {
      name: 'Lait entier',
      category: 'Lait',
      unit: 'liters',
      density: 1.030,
      color: '#2196F3',
      notes: 'Lait entier pasteurisé, 3,5% MG',
    },
    {
      name: 'Crème fraîche',
      category: 'Crème',
      unit: 'liters',
      density: 0.994,
      color: '#FF9800',
      notes: 'Crème fraîche épaisse 30% MG',
    },
    {
      name: 'Beurre',
      category: 'Beurre',
      unit: 'kg',
      density: 0.911,
      color: '#FFEB3B',
      notes: 'Beurre doux AOP',
    },
    {
      name: 'Yaourt nature',
      category: 'Yaourt',
      unit: 'units',
      density: 1.050,
      color: '#9C27B0',
      notes: 'Yaourt nature brassé, pots 125g',
    },
    {
      name: 'Lait écrémé',
      category: 'Lait',
      unit: 'liters',
      density: 1.035,
      color: '#4CAF50',
      notes: 'Lait écrémé UHT, 0,5% MG',
    },
  ];

  const SAMPLE_TRUCKS = [
    {
      name: 'Camion Laitier 01',
      licensePlate: 'AA-001-BB',
      compartments: [
        { name: 'Compartiment A', capacity: 8000, allowedProducts: [], notes: 'Avant du camion' },
        { name: 'Compartiment B', capacity: 6000, allowedProducts: [], notes: 'Milieu du camion' },
        { name: 'Compartiment C', capacity: 4000, allowedProducts: [], notes: 'Arrière du camion' },
      ],
    },
    {
      name: 'Camion Laitier 02',
      licensePlate: 'AA-002-BB',
      compartments: [
        { name: 'Compartiment A', capacity: 5000, allowedProducts: [], notes: '' },
        { name: 'Compartiment B', capacity: 5000, allowedProducts: [], notes: '' },
        { name: 'Compartiment C', capacity: 5000, allowedProducts: [], notes: '' },
        { name: 'Compartiment D', capacity: 3000, allowedProducts: [], notes: 'Réservé crème' },
      ],
    },
    {
      name: 'Tanker Crème 01',
      licensePlate: 'AA-003-TK',
      compartments: [
        { name: 'Cuve Principale', capacity: 10000, allowedProducts: [], notes: 'Lait & crème' },
        { name: 'Cuve Secondaire', capacity: 8000,  allowedProducts: [], notes: '' },
        { name: 'Cuve Auxiliaire', capacity: 6000,  allowedProducts: [], notes: 'Produits dérivés' },
      ],
    },
  ];

  // 8 customer sites in the Paris/Île-de-France region
  const SAMPLE_CLIENTS = [
    {
      name: 'Supermarché Leclerc — Versailles',
      address: '35 Avenue de Paris, 78000 Versailles',
      lat: 48.8012, lng: 2.1217,
      phone: '+33 1 30 21 00 01',
      contactPerson: 'Marie Dupont',
      notes: 'Quai de déchargement au fond du parking',
    },
    {
      name: 'Carrefour Market — Boulogne-Billancourt',
      address: '12 Rue du Vieux Pont, 92100 Boulogne-Billancourt',
      lat: 48.8347, lng: 2.2399,
      phone: '+33 1 46 03 00 02',
      contactPerson: 'Jean Martin',
      notes: '',
    },
    {
      name: 'Monoprix — Paris 15ème',
      address: '93 Rue de la Convention, 75015 Paris',
      lat: 48.8412, lng: 2.2917,
      phone: '+33 1 45 32 00 03',
      contactPerson: 'Sophie Bernard',
      notes: 'Livraison avant 8h00',
    },
    {
      name: 'Fromagerie Centrale — Rungis',
      address: 'MIN de Rungis, 94150 Rungis',
      lat: 48.7477, lng: 2.3598,
      phone: '+33 1 46 87 00 04',
      contactPerson: 'Pierre Leroy',
      notes: 'Ouvert 4h-12h, secteur D3',
    },
    {
      name: 'Intermarché — Massy',
      address: '2 Allée des Champs Élysées, 91300 Massy',
      lat: 48.7257, lng: 2.2721,
      phone: '+33 1 69 30 00 05',
      contactPerson: 'Isabelle Moreau',
      notes: '',
    },
    {
      name: 'Casino Supermarché — Vincennes',
      address: '14 Avenue de Paris, 94300 Vincennes',
      lat: 48.8466, lng: 2.4393,
      phone: '+33 1 43 28 00 06',
      contactPerson: 'François Thomas',
      notes: 'Accès par rue latérale',
    },
    {
      name: 'Auchan — Rosny-sous-Bois',
      address: 'Centre Commercial Rosny 2, 93110 Rosny-sous-Bois',
      lat: 48.8693, lng: 2.4929,
      phone: '+33 1 48 94 00 07',
      contactPerson: 'Cécile Petit',
      notes: 'Dock B, 2ème sous-sol',
    },
    {
      name: 'Système U — Saint-Denis',
      address: '48 Rue de la République, 93200 Saint-Denis',
      lat: 48.9363, lng: 2.3529,
      phone: '+33 1 48 09 00 08',
      contactPerson: 'Alain Girard',
      notes: '',
    },
  ];

  // ─── Loader ──────────────────────────────────────────────────

  /**
   * Load all sample data into LocalStorage.
   * Clears existing data before loading to ensure a clean state.
   */
  function loadSampleData() {
    // Confirm before overwriting
    if (!confirm('Load sample data? This will replace ALL existing clients, trucks, products and add a sample tour.')) {
      return;
    }

    App.showSpinner('Loading sample data…');

    try {
      // Clear existing data
      Storage.clear(KEYS.CLIENTS);
      Storage.clear(KEYS.TRUCKS);
      Storage.clear(KEYS.PRODUCTS);
      // Keep existing tours — just add a new sample

      // ── Save products and collect their IDs ──
      const savedProducts = SAMPLE_PRODUCTS.map(p => Storage.save(KEYS.PRODUCTS, p));
      const productMap    = {};
      SAMPLE_PRODUCTS.forEach((p, i) => { productMap[p.name] = savedProducts[i].id; });

      // ── Save trucks (link allowed products for Compartiment D of truck 2 → cream) ──
      const savedTrucks = SAMPLE_TRUCKS.map((truck, tIdx) => {
        // Assign compartment IDs
        const compartments = truck.compartments.map((c, cIdx) => {
          let allowedProducts = [];
          // Truck 2, last compartment: allow only Crème fraîche
          if (tIdx === 1 && cIdx === 3) {
            allowedProducts = [productMap['Crème fraîche']].filter(Boolean);
          }
          return {
            id: `comp-${tIdx + 1}-${cIdx + 1}`,
            name: c.name,
            capacity: c.capacity,
            allowedProducts,
            notes: c.notes,
          };
        });
        const totalCapacity = compartments.reduce((s, c) => s + c.capacity, 0);
        return Storage.save(KEYS.TRUCKS, { ...truck, compartments, totalCapacity });
      });

      // ── Save clients and collect their IDs ──
      const savedClients = SAMPLE_CLIENTS.map(c => Storage.save(KEYS.CLIENTS, c));
      const clientIdByName = {};
      SAMPLE_CLIENTS.forEach((c, i) => { clientIdByName[c.name] = savedClients[i].id; });

      // ── Build sample tour order with 6 of the 8 clients ──
      const tourClients = savedClients.slice(0, 6); // first 6 clients
      const truck1 = savedTrucks[0];

      const orderLines = tourClients.map((client, idx) => {
        // Alternate products across stops
        const productNames = ['Lait entier', 'Crème fraîche', 'Lait entier', 'Yaourt nature', 'Lait écrémé', 'Beurre'];
        const quantities   = [2500, 1200, 3000, 800, 1500, 400];
        return {
          id:              `sample-line-${idx + 1}`,
          clientId:        client.id,
          productId:       productMap[productNames[idx]] || productMap['Lait entier'],
          quantity:        quantities[idx],
          timeWindowStart: ['06:00', '07:00', '07:30', '08:00', '09:00', '10:00'][idx],
          timeWindowEnd:   ['08:00', '09:00', '09:30', '10:00', '11:00', '12:00'][idx],
          priority:        2,
        };
      });

      Storage.save(KEYS.TOURS, {
        name:         'Tournée Paris Sud — Exemple',
        date:         new Date().toISOString().slice(0, 10),
        truckId:      truck1.id,
        depotAddress: 'MIN de Rungis, Secteur Laitier, 94150 Rungis',
        depotLat:     48.7477,
        depotLng:     2.3598,
        status:       'draft',
        orderLines,
      });

      App.hideSpinner();
      App.showToast(
        `Sample data loaded: ${savedClients.length} clients, ${savedTrucks.length} trucks, ${savedProducts.length} products, 1 tour.`,
        'success',
        5000
      );

      // Refresh the current section
      Dashboard.renderDashboard();

    } catch (err) {
      App.hideSpinner();
      console.error('[SampleData] Error loading sample data:', err);
      App.showToast('Failed to load sample data. See console for details.', 'error');
    }
  }

  return { loadSampleData };

})();
