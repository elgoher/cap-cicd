'use strict'

const cds = require('@sap/cds')

// ─── Mock the external SparePartsAPI wrapper ───────────────────────────────────
// jest.mock is hoisted before any require, so maintenance-service.js
// will receive the mocked version of parts-catalog when it initialises.

jest.mock('../srv/parts-catalog')
const { getPartInfo } = require('../srv/parts-catalog')

// ─── Resilience utilities (imported directly for unit tests) ───────────────────

const { withRetry, CircuitBreaker } = require('../srv/resilience')

// ─── Seed IDs — match db/data CSVs ────────────────────────────────────────────

const EQ_ACTIVE_ID   = 'e1000000-0000-0000-0000-000000000001'  // ACTIVE
const EQ_INACTIVE_ID = 'e1000000-0000-0000-0000-000000000003'  // INACTIVE

const ORDER_DRAFT_ID = '02000000-0000-0000-0000-000000000004'  // DRAFT, equipment ACTIVE
const ORDER_OPEN_ID  = '02000000-0000-0000-0000-000000000003'  // OPEN

// ─── Test setup ───────────────────────────────────────────────────────────────

// Save Jest's native expect (for mock assertions and .rejects) before cds.test
// shadows it with a chai-based wrapper.
const jestExpect = global.expect

const { GET, POST, expect } = cds.test(__dirname + '/..')

// Reset mocks between tests so call counts are clean
beforeEach(() => jest.resetAllMocks())

// ─────────────────────────────────────────────────────────────────────────────
describe('MaintenanceService — Session 2: Security, External APIs & Resilience', () => {

    // ══════════════════════════════════════════════════════════════════════════
    // GROUP 1 — XSUAA Security
    // ══════════════════════════════════════════════════════════════════════════

    describe('security — @requires + @restrict', () => {

        test('anonymous request is rejected (403)', async () => {
            // No user set — cds.User.default is Anonymous
            const original = cds.User.default
            cds.User.default = cds.User.Anonymous
            try {
                const res = await GET('/maintenance/MaintenanceOrders')
                    .catch(err => err.response)
                expect(res.status).to.be.oneOf([401, 403])
            } finally {
                cds.User.default = original
            }
        })

        test('MaintenanceViewer can read orders (200)', async () => {
            const original = cds.User.default
            cds.User.default = new cds.User({ id: 'bob', roles: ['MaintenanceViewer'] })
            try {
                const res = await GET('/maintenance/MaintenanceOrders')
                expect(res.status).to.equal(200)
                expect(res.data.value).to.be.an('array')
            } finally {
                cds.User.default = original
            }
        })

        test('MaintenanceViewer cannot create an order (403)', async () => {
            const original = cds.User.default
            cds.User.default = new cds.User({ id: 'bob', roles: ['MaintenanceViewer'] })
            try {
                const res = await POST('/maintenance/MaintenanceOrders', {
                    orderNumber:  'OM-SEC-001',
                    description:  'Viewer attempts write',
                    equipment_ID: EQ_ACTIVE_ID
                }).catch(err => err.response)
                expect(res.status).to.equal(403)
            } finally {
                cds.User.default = original
            }
        })

        test('MaintenanceAdmin can create an order (201)', async () => {
            const original = cds.User.default
            cds.User.default = new cds.User({ id: 'alice', roles: ['MaintenanceAdmin'] })
            try {
                const res = await POST('/maintenance/MaintenanceOrders', {
                    orderNumber:  'OM-ADM-001',
                    description:  'Admin creates order',
                    equipment_ID: EQ_ACTIVE_ID,
                    priority:     'MEDIUM'
                })
                expect(res.status).to.equal(201)
                expect(res.data.orderNumber).to.equal('OM-ADM-001')
            } finally {
                cds.User.default = original
            }
        })

    })

    // ══════════════════════════════════════════════════════════════════════════
    // GROUP 2 — External API: SparePartsAPI
    // ══════════════════════════════════════════════════════════════════════════

    describe('external API — SparePartsAPI part validation', () => {

        // Helper: create WorkItem as admin
        async function createWorkItem(data) {
            const original = cds.User.default
            cds.User.default = new cds.User({ id: 'alice', roles: ['MaintenanceAdmin'] })
            try {
                return await POST('/maintenance/WorkItems', {
                    order_ID:    ORDER_OPEN_ID,
                    description: 'Test task',
                    status:      'PENDING',
                    ...data
                }).catch(err => err.response)
            } finally {
                cds.User.default = original
            }
        }

        test('WorkItem without partCode: created without calling the API', async () => {
            const res = await createWorkItem({ description: 'No part required' })
            expect(res.status).to.equal(201)
            jestExpect(getPartInfo).not.toHaveBeenCalled()
        })

        test('WorkItem with available part: API called, item created (201)', async () => {
            getPartInfo.mockResolvedValueOnce({
                code: 'P-SEAL-001', description: 'Pump Seal Kit',
                available: true, unitCost: 450.00
            })
            const res = await createWorkItem({ partCode: 'P-SEAL-001' })
            expect(res.status).to.equal(201)
            jestExpect(getPartInfo).toHaveBeenCalledWith('P-SEAL-001')
        })

        test('WorkItem with unavailable part: API rejects with 422', async () => {
            getPartInfo.mockResolvedValueOnce({ code: 'P-OBS-999', available: false })
            const res = await createWorkItem({ partCode: 'P-OBS-999' })
            expect(res.status).to.equal(422)
            expect(res.data.error.message).to.include('P-OBS-999')
        })

        test('API throws (unavailable): graceful degradation — WorkItem still created (201)', async () => {
            getPartInfo.mockRejectedValueOnce(new Error('ECONNREFUSED'))
            const res = await createWorkItem({ partCode: 'P-SEAL-001' })
            // Handler catches the error and issues a warning — creation proceeds
            expect(res.status).to.equal(201)
        })

    })

    // ══════════════════════════════════════════════════════════════════════════
    // GROUP 3 — Resilience utilities (unit tests)
    // ══════════════════════════════════════════════════════════════════════════

    describe('resilience — withRetry', () => {

        test('succeeds on 3rd attempt after 2 failures', async () => {
            let calls = 0
            const fn = jest.fn(async () => {
                calls++
                if (calls < 3) throw new Error('transient error')
                return 'ok'
            })
            const result = await withRetry(fn, 3, 1) // baseDelay=1ms for speed
            expect(result).to.equal('ok')
            jestExpect(fn).toHaveBeenCalledTimes(3)
        })

        test('throws after maxRetries exhausted', async () => {
            const fn = jest.fn(async () => { throw new Error('permanent error') })
            await jestExpect(withRetry(fn, 3, 1)).rejects.toThrow('permanent error')
            jestExpect(fn).toHaveBeenCalledTimes(3)
        })

    })

    describe('resilience — CircuitBreaker', () => {

        test('CLOSED state: allows calls and resets failures on success', async () => {
            const cb = new CircuitBreaker({ threshold: 3, resetTimeout: 10000 })
            const result = await cb.call(async () => 'success')
            expect(result).to.equal('success')
            expect(cb.isClosed).to.be.true
            expect(cb.failures).to.equal(0)
        })

        test('opens after reaching failure threshold', async () => {
            const cb  = new CircuitBreaker({ threshold: 3, resetTimeout: 10000 })
            const err = new Error('downstream error')

            // 3 failures → circuit opens
            for (let i = 0; i < 3; i++) {
                await cb.call(async () => { throw err }).catch(() => {})
            }

            expect(cb.isOpen).to.be.true

            // Next call is rejected immediately (no downstream call)
            const fastReject = await cb.call(async () => 'should not run').catch(e => e)
            expect(fastReject.code).to.equal('CIRCUIT_OPEN')
        })

        test('HALF-OPEN: allows one probe call after resetTimeout elapses', async () => {
            const cb = new CircuitBreaker({ threshold: 2, resetTimeout: 1 }) // 1ms timeout

            // Open the circuit
            for (let i = 0; i < 2; i++) {
                await cb.call(async () => { throw new Error('fail') }).catch(() => {})
            }
            expect(cb.isOpen).to.be.true

            // Wait for resetTimeout
            await new Promise(r => setTimeout(r, 5))

            // Probe call succeeds → back to CLOSED
            const result = await cb.call(async () => 'recovered')
            expect(result).to.equal('recovered')
            expect(cb.isClosed).to.be.true
        })

    })

})
