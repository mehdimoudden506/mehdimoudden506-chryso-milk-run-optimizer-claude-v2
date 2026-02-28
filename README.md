# Chryso Bulk Milk‑Run Optimizer

An AI-powered web portal for managing **milk-run truck distribution tours** of bulk products loaded in truck compartments. Runs entirely in the browser — no server, no install, no admin rights required.

## Screenshots

> *(Open `index.html` in your browser to see the application.)*

## How to Run Locally

**Option 1 — Direct file open (easiest):**
1. Clone or download this repository
2. Double-click `index.html` (or drag it into Chrome / Firefox / Edge)
3. The app launches immediately

**Option 2 — VS Code Live Server:**
1. Open the repository folder in VS Code
2. Install the *Live Server* extension
3. Right-click `index.html` → *Open with Live Server*

**Option 3 — GitHub Pages:**
1. Go to your repository **Settings → Pages**
2. Set source to **main** branch, root `/`
3. Visit the published URL

> No Node.js, Python, Java or any local runtime is needed.

## Features

| Section | What you can do |
|---|---|
| **Dashboard** | View summary stats, recent tours, load sample demo data |
| **Clients** | Create/edit/delete customer sites with address geocoding and map preview |
| **Trucks** | Define trucks with multiple compartments, capacities and product restrictions |
| **Products** | Manage product catalogue with categories, units and colour codes |
| **Orders** | Build delivery tour orders (truck + depot + customer lines with quantities) |
| **Optimizer** | Run Nearest-Neighbour + 2-opt route optimisation, view on interactive Leaflet map |
| **Loading Plan** | Auto-generate reverse bin-packing compartment assignments with Chart.js diagrams |

## Data Model (localStorage)

| Key | Contents |
|---|---|
| `mropt_clients` | Customer sites (name, address, GPS, contact) |
| `mropt_trucks` | Trucks with nested compartment definitions |
| `mropt_products` | Product catalogue |
| `mropt_tours` | Tour orders (status: draft / optimised / executed) |
| `mropt_settings` | Application settings (API keys, depot address) |

## Optimisation Algorithms

### Route Optimisation
1. **Nearest-Neighbour heuristic** — builds an initial tour by always visiting the closest unvisited customer
2. **2-opt improvement** — repeatedly reverses sub-segments of the tour whenever doing so reduces total distance
3. **Haversine distance** — great-circle distance formula used for GPS-coordinate pairs (fallback when OSRM is unavailable)

### Loading Plan
- Products are loaded in **reverse delivery order** (last delivery = first loaded)
- **First-Fit Decreasing bin-packing** assigns deliveries to compartments respecting capacity limits and allowed-product-type constraints
- Infeasible assignments (capacity exceeded or incompatible product) are flagged in the UI

## File Structure

```
/
├── index.html          ← SPA entry point (open this in a browser)
├── css/
│   ├── style.css       ← Main stylesheet (responsive, professional blue/white/gray)
│   └── print.css       ← Print stylesheet for loading-plan pages
├── js/
│   ├── storage.js      ← localStorage CRUD helpers (UUID, timestamps)
│   ├── app.js          ← Navigation, toasts, spinner, modal manager
│   ├── clients.js      ← Client master data + Nominatim geocoding + map
│   ├── trucks.js       ← Truck + compartment management
│   ├── products.js     ← Product catalogue management
│   ├── orders.js       ← Tour order entry with smart quantity suggestions
│   ├── optimizer.js    ← Nearest-Neighbour + 2-opt + Haversine
│   ├── loading.js      ← Reverse bin-packing + Chart.js visualisation
│   ├── map.js          ← Leaflet map: numbered markers, route polylines
│   └── dashboard.js    ← Dashboard statistics and quick actions
├── sample-data.js      ← Demo data loader (3 trucks, 8 clients, 5 products, 1 tour)
└── README.md
```

## CDN Dependencies (specific versions, no build step)

| Library | Version | Purpose |
|---|---|---|
| [Leaflet.js](https://leafletjs.com) | 1.9.4 | Interactive route maps |
| [Chart.js](https://www.chartjs.org) | 4.4.0 | Compartment loading diagrams |
| [Font Awesome](https://fontawesome.com) | 6.4.0 | UI icons |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes — all logic runs in plain JavaScript, no build step needed
4. Open a Pull Request describing what you changed and why

> **Code style:** all JS files use `'use strict'` and JSDoc comments. No frameworks, no npm.
