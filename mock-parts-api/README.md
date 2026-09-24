# Mock SparePartsAPI

Local HTTP server that simulates the spare-parts catalog used by Session 2.  
No external dependencies — runs on plain Node.js `http`.

## Start

```bash
node mock-parts-api/server.js
# or
npm run mock
```

Default port: **3002**. Override with `MOCK_PORT=<port>`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check + catalog stats |
| GET | `/parts` | Full catalog (17 parts) |
| GET | `/parts/:code` | Single part by code |

## Test it

```bash
# Health
curl http://localhost:3002/health

# Available part
curl http://localhost:3002/parts/P-SEAL-001

# Unavailable part (triggers 422 in CAP)
curl http://localhost:3002/parts/P-OBS-999

# Unknown part (triggers graceful degradation in CAP)
curl http://localhost:3002/parts/DOES-NOT-EXIST
```

## Catalog summary

| Code | Description | Available |
|------|-------------|-----------|
| P-SEAL-001 | Pump Shaft Seal Kit — 50mm | ✓ |
| P-SEAL-002 | Valve Stem Seal — PTFE | ✓ |
| P-GASK-001 | Flange Gasket — Spiral Wound 4" | ✓ |
| P-BEAR-001 | Deep Groove Ball Bearing 6205-2RS | ✓ |
| P-BEAR-002 | Tapered Roller Bearing 32210 | ✓ |
| P-FILT-001 | Hydraulic Filter Element | ✓ |
| P-FILT-002 | Gas Turbine Air Filter — Stage 1 | ✓ |
| P-FILT-003 | Lube Oil Filter — Duplex Housing | ✗ (out of stock) |
| P-VALV-001 | Ball Valve 2" | ✓ |
| P-VALV-002 | Check Valve 3" | ✓ |
| P-VALV-003 | Safety Relief Valve — 300# ANSI | ✓ |
| P-ELEC-001 | Motor Contactor — 37kW | ✓ |
| P-ELEC-002 | VFD Drive — 15kW | ✗ (on order) |
| P-LUBR-001 | Turbine Oil ISO VG 46 | ✓ |
| P-LUBR-002 | Grease — Lithium Complex NLGI 2 | ✓ |
| P-OBS-999 | Legacy Seal Kit — Discontinued | ✗ (obsolete) |

## Running both servers together

```bash
npm run dev       # starts mock API (port 3002) + cds watch (port 4004) concurrently
```

Requires `concurrently` (already in devDependencies):  
```bash
npm install
```
