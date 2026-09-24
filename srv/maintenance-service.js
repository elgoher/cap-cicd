'use strict'

const cds = require('@sap/cds')
const { getPartInfo } = require('./parts-catalog')
const { withRetry } = require('./resilience')

/**
 * MaintenanceService — Custom Handlers (Sessions 1 + 2)
 *
 * Session 1 handlers:
 *   1. before CREATE  MaintenanceOrders — Equipment must be ACTIVE
 *   2. before UPDATE  MaintenanceOrders — State-machine transition guard
 *   3. after  UPDATE  WorkItems         — Auto-close order when all items COMPLETED
 *
 * Session 2 handlers:
 *   4. before CREATE  WorkItems         — Validate partCode via SparePartsAPI
 *                                         (with graceful degradation)
 */
module.exports = class MaintenanceService extends cds.ApplicationService {

    async init() {
        const { MaintenanceOrders, WorkItems, Equipment } = this.entities

        // Valid status transitions for MaintenanceOrder
        const ALLOWED_TRANSITIONS = {
            DRAFT:       ['OPEN', 'CANCELLED'],
            OPEN:        ['IN_PROGRESS', 'CANCELLED'],
            IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
            COMPLETED:   [],
            CANCELLED:   []
        }

        // ── Handler 1: Equipment must be ACTIVE on order creation ──────────────
        this.before('CREATE', MaintenanceOrders, async (req) => {
            const { equipment_ID } = req.data
            if (!equipment_ID)
                return req.error(400, 'equipment_ID is required.')

            const eq = await SELECT.one.from(Equipment)
                .columns('ID', 'code', 'status').where({ ID: equipment_ID })

            if (!eq)
                return req.error(404, `Equipment '${equipment_ID}' not found.`)

            if (eq.status !== 'ACTIVE')
                return req.error(422,
                    `Equipment '${eq.code}' is ${eq.status}. ` +
                    `Only ACTIVE equipment accepts maintenance orders.`)
        })

        // ── Handler 2: Status transition state machine ─────────────────────────
        this.before('UPDATE', MaintenanceOrders, async (req) => {
            const newStatus = req.data.status
            if (!newStatus) return

            const id    = req.data?.ID ?? req.params?.[0]?.ID
            if (!id) return

            const order = await SELECT.one.from(MaintenanceOrders)
                .columns('ID', 'orderNumber', 'status').where({ ID: id })

            if (!order) return req.error(404, 'Maintenance order not found.')

            const allowed = ALLOWED_TRANSITIONS[order.status] ?? []
            if (!allowed.includes(newStatus))
                return req.error(422,
                    `Order '${order.orderNumber}' cannot transition from ` +
                    `${order.status} to ${newStatus}. ` +
                    `Allowed: [${allowed.join(', ') || 'none'}].`)
        })

        // ── Handler 3: Auto-close order when all work items are COMPLETED ──────
        this.after('UPDATE', WorkItems, async (_, req) => {
            const id = req.data?.ID ?? req.params?.[0]?.ID
            if (!id) return

            const item = await SELECT.one.from(WorkItems)
                .columns('order_ID').where({ ID: id })
            if (!item?.order_ID) return

            const siblings = await SELECT.from(WorkItems)
                .columns('status').where({ order_ID: item.order_ID })

            const allDone = siblings.length > 0 &&
                siblings.every(w => w.status === 'COMPLETED')

            if (allDone) {
                await UPDATE(MaintenanceOrders)
                    .set({ status: 'COMPLETED' })
                    .where({ ID: item.order_ID })
            }
        })

        // ── Handler 4: Validate spare part via external SparePartsAPI ──────────
        this.before('CREATE', WorkItems, async (req) => {
            const { partCode } = req.data
            if (!partCode?.trim()) return  // partCode is optional — skip validation

            try {
                const part = await getPartInfo(partCode)
               // const part = await withRetry(getPartInfo(partCode), 3, 100)

                if (!part || !part.available) {
                    return req.error(422,
                        `Part '${partCode}' is not available in the catalog. ` +
                        `Please choose an available spare part or leave partCode empty.`)
                }
                // Optionally enrich: req.data.estimatedHours already set by caller
            } catch (err) {
                // Graceful degradation: Parts Catalog is not mission-critical.
                // Warn the user but allow the work item to be created.
                req.warn(503,
                    `Spare parts catalog is temporarily unavailable. ` +
                    `Work item created without part validation.`)
            }
        })

        return super.init()
    }
}
