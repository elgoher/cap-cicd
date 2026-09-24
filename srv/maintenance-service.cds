using { petrobras.maintenance as db } from '../db/schema';

/**
 * MaintenanceService
 *
 * Session 01 established the base service (no auth).
 * Session 02 adds:
 *   · @requires + @restrict   → XSUAA role-based access control
 *
 * Projection principle (from Session 01): the service never exposes domain
 * entities directly — always via projections that control visible fields
 * and navigation associations.
 */
service MaintenanceService @(
    path    : '/maintenance',
    requires: 'authenticated-user'
) {

    /**
     * Equipment: read-only from this service.
     * The back-reference 'orders' is excluded to prevent circular navigation
     * (carried forward from Session 01).
     */
    @readonly
    entity Equipment as projection on db.Equipment
        excluding { orders };

    /**
     * MaintenanceOrders: role-based read/write.
     * Navigation to Equipment and WorkItems is redirected to service projections.
     */
    @(restrict: [
        { grant: 'READ',  to: ['MaintenanceViewer', 'MaintenanceAdmin'] },
        { grant: 'WRITE', to: 'MaintenanceAdmin' }
    ])
    entity MaintenanceOrders as projection on db.MaintenanceOrder {
        *,
        equipment : redirected to Equipment,
        workItems : redirected to WorkItems
    };

    /**
     * WorkItems: same authorization pattern as MaintenanceOrders.
     * Navigation back to the parent order is redirected to MaintenanceOrders.
     */
    @(restrict: [
        { grant: 'READ',  to: ['MaintenanceViewer', 'MaintenanceAdmin'] },
        { grant: 'WRITE', to: 'MaintenanceAdmin' }
    ])
    entity WorkItems as projection on db.WorkItem {
        *,
        order : redirected to MaintenanceOrders
    };
}
