'use strict'

/**
 * Mock SparePartsAPI — CAP Workshop Session 2
 *
 * Simulates a REST spare-parts catalog.
 * Run standalone:  node mock-parts-api/server.js
 * Or via npm:      npm run mock
 *
 * Endpoints:
 *   GET  /health            → 200 { status: "ok" }
 *   GET  /parts             → 200  [ ...all parts ]
 *   GET  /parts/:code       → 200  { code, description, category, unitCost, unit, available }
 *                           → 404  { error: "Part not found" }
 */

const http = require('http')

const PORT = process.env.MOCK_PORT || 3002

// ─── Spare Parts Catalog ──────────────────────────────────────────────────────
// Codes referenced in db/data/petrobras.maintenance-WorkItem.csv are marked
// available:true so the app works out-of-the-box with seed data.

const CATALOG = {
  // ── Seals & Gaskets ──────────────────────────────────────────────────────────
  'P-SEAL-001': {
    code: 'P-SEAL-001', description: 'Pump Shaft Seal Kit — 50mm',
    category: 'Seals & Gaskets', unitCost: 450.00, unit: 'KIT',
    leadTimeDays: 2, available: true
  },
  'P-SEAL-002': {
    code: 'P-SEAL-002', description: 'Valve Stem Seal — PTFE',
    category: 'Seals & Gaskets', unitCost: 85.50, unit: 'PC',
    leadTimeDays: 1, available: true
  },
  'P-GASK-001': {
    code: 'P-GASK-001', description: 'Flange Gasket — Spiral Wound 4"',
    category: 'Seals & Gaskets', unitCost: 120.00, unit: 'PC',
    leadTimeDays: 3, available: true
  },

  // ── Bearings ─────────────────────────────────────────────────────────────────
  'P-BEAR-001': {
    code: 'P-BEAR-001', description: 'Deep Groove Ball Bearing 6205-2RS',
    category: 'Bearings', unitCost: 95.00, unit: 'PC',
    leadTimeDays: 1, available: true
  },
  'P-BEAR-002': {
    code: 'P-BEAR-002', description: 'Tapered Roller Bearing 32210',
    category: 'Bearings', unitCost: 210.00, unit: 'PC',
    leadTimeDays: 5, available: true
  },

  // ── Filters ──────────────────────────────────────────────────────────────────
  'P-FILT-001': {
    code: 'P-FILT-001', description: 'Hydraulic Filter Element — 10 micron',
    category: 'Filters', unitCost: 180.00, unit: 'PC',
    leadTimeDays: 2, available: true
  },
  'P-FILT-002': {
    code: 'P-FILT-002', description: 'Gas Turbine Air Filter — Stage 1',
    category: 'Filters', unitCost: 620.00, unit: 'PC',
    leadTimeDays: 7, available: true
  },
  'P-FILT-003': {
    code: 'P-FILT-003', description: 'Lube Oil Filter — Duplex Housing',
    category: 'Filters', unitCost: 340.00, unit: 'PC',
    leadTimeDays: 3, available: false   // temporarily out of stock
  },

  // ── Valves ───────────────────────────────────────────────────────────────────
  'P-VALV-001': {
    code: 'P-VALV-001', description: 'Ball Valve 2" — 150# Flanged',
    category: 'Valves', unitCost: 890.00, unit: 'PC',
    leadTimeDays: 10, available: true
  },
  'P-VALV-002': {
    code: 'P-VALV-002', description: 'Check Valve 3" — Swing Type',
    category: 'Valves', unitCost: 1250.00, unit: 'PC',
    leadTimeDays: 14, available: true
  },
  'P-VALV-003': {
    code: 'P-VALV-003', description: 'Safety Relief Valve — 300# ANSI',
    category: 'Valves', unitCost: 3200.00, unit: 'PC',
    leadTimeDays: 21, available: true
  },

  // ── Electrical ───────────────────────────────────────────────────────────────
  'P-ELEC-001': {
    code: 'P-ELEC-001', description: 'Motor Contactor — 37kW 400V',
    category: 'Electrical', unitCost: 560.00, unit: 'PC',
    leadTimeDays: 5, available: true
  },
  'P-ELEC-002': {
    code: 'P-ELEC-002', description: 'VFD Drive — 15kW 480V',
    category: 'Electrical', unitCost: 4800.00, unit: 'PC',
    leadTimeDays: 30, available: false  // on order from supplier
  },

  // ── Lubricants ───────────────────────────────────────────────────────────────
  'P-LUBR-001': {
    code: 'P-LUBR-001', description: 'Turbine Oil ISO VG 46 — 20L',
    category: 'Lubricants', unitCost: 280.00, unit: 'CAN',
    leadTimeDays: 1, available: true
  },
  'P-LUBR-002': {
    code: 'P-LUBR-002', description: 'Grease — Lithium Complex NLGI 2 — 5kg',
    category: 'Lubricants', unitCost: 95.00, unit: 'TUB',
    leadTimeDays: 1, available: true
  },

  // ── Obsolete / unavailable (useful for testing error paths) ──────────────────
  'P-OBS-999': {
    code: 'P-OBS-999', description: 'Legacy Seal Kit — Discontinued',
    category: 'Seals & Gaskets', unitCost: 0, unit: 'KIT',
    leadTimeDays: null, available: false
  }
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────

function send(res, status, body) {
  const payload = JSON.stringify(body, null, 2)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  })
  res.end(payload)
}

const server = http.createServer((req, res) => {
  // CORS — allows cds watch (localhost:4004) to reach us
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  if (req.method !== 'GET')     { return send(res, 405, { error: 'Method Not Allowed' }) }

  const url = req.url.split('?')[0]   // ignore query params

  // ── GET /health ──────────────────────────────────────────────────────────────
  if (url === '/health') {
    return send(res, 200, {
      status: 'ok',
      service: 'Mock SparePartsAPI',
      totalParts: Object.keys(CATALOG).length,
      availableParts: Object.values(CATALOG).filter(p => p.available).length,
      timestamp: new Date().toISOString()
    })
  }

  // ── GET /parts ───────────────────────────────────────────────────────────────
  if (url === '/parts') {
    return send(res, 200, Object.values(CATALOG))
  }

  // ── GET /parts/:code ─────────────────────────────────────────────────────────
  const match = url.match(/^\/parts\/([^/]+)$/)
  if (match) {
    const code = decodeURIComponent(match[1]).toUpperCase()
    const part = CATALOG[code]
    if (!part) return send(res, 404, { error: `Part '${code}' not found in catalog` })
    return send(res, 200, part)
  }

  // ── 404 fallback ─────────────────────────────────────────────────────────────
  send(res, 404, { error: `Unknown endpoint: ${url}` })
})

server.listen(PORT, () => {
  console.log(`\n  Mock SparePartsAPI listening on http://localhost:${PORT}`)
  console.log(`  GET http://localhost:${PORT}/health`)
  console.log(`  GET http://localhost:${PORT}/parts`)
  console.log(`  GET http://localhost:${PORT}/parts/P-SEAL-001`)
  console.log(`  GET http://localhost:${PORT}/parts/P-OBS-999   (unavailable)\n`)
})

server.on('error', err => {
  if (err.code === 'EADDRINUSE')
    console.error(`\n  ERROR: Port ${PORT} is already in use. Set MOCK_PORT=<other> to change.\n`)
  else
    console.error(err)
  process.exit(1)
})
