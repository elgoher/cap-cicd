namespace petrobras.maintenance;

using { cuid, managed } from '@sap/cds/common';

// ─────────────────────────────────────────────────────────────────────────────
// Enumerations  (carried forward from Session 01 — unchanged)
//
// Using enum types instead of free strings:
//   · Documents the valid values explicitly
//   · CAP validates automatically in OData v4
//   · OData metadata lists the allowed values
// ─────────────────────────────────────────────────────────────────────────────

type EquipmentStatus : String(20) enum {
    ACTIVE         = 'ACTIVE';
    INACTIVE       = 'INACTIVE';
    DECOMMISSIONED = 'DECOMMISSIONED';
}

type OrderStatus : String(20) enum {
    DRAFT       = 'DRAFT';
    OPEN        = 'OPEN';
    IN_PROGRESS = 'IN_PROGRESS';
    COMPLETED   = 'COMPLETED';
    CANCELLED   = 'CANCELLED';
}

type WorkItemStatus : String(20) enum {
    PENDING     = 'PENDING';
    IN_PROGRESS = 'IN_PROGRESS';
    COMPLETED   = 'COMPLETED';
}

type Priority : String(10) enum {
    LOW      = 'LOW';
    MEDIUM   = 'MEDIUM';
    HIGH     = 'HIGH';
    CRITICAL = 'CRITICAL';
}

// ─────────────────────────────────────────────────────────────────────────────
// Equipment  (Session 01 — no new fields in Session 02)
//
// · cuid    → auto-generated UUID primary key
// · managed → adds createdAt/By, modifiedAt/By automatically
// · orders  → back-reference kept for domain navigation;
//             excluded from service projection to avoid circular navigation
// ─────────────────────────────────────────────────────────────────────────────

entity Equipment : cuid, managed {
    @assert.notNull
    code        : String(20);

    @assert.notNull
    description : String(100);

    status      : EquipmentStatus not null default 'ACTIVE';
    type        : String(50);
    location    : String(100);
    plant       : String(10);   // plant / installation code (e.g. P55, P62)

    orders      : Association to many MaintenanceOrder on orders.equipment = $self;
}

// ─────────────────────────────────────────────────────────────────────────────
// MaintenanceOrder
//
// Session 01 base fields (orderNumber … workItems)
// Session 02 additions  ← responsible, notes
// ─────────────────────────────────────────────────────────────────────────────

entity MaintenanceOrder : cuid, managed {
    @assert.notNull
    orderNumber  : String(20);

    equipment    : Association to Equipment not null;
    status       : OrderStatus not null default 'DRAFT';
    priority     : Priority    not null default 'MEDIUM';
    description  : String(500);
    plannedStart : Date;
    plannedEnd   : Date;

    workItems    : Composition of many WorkItem on workItems.order = $self;

    // ── Session 02 additions ──────────────────────────────────────────────────
    responsible  : String(100);   // assigned technician or team leader
    notes        : String(500);   // general notes and observations
}

// ─────────────────────────────────────────────────────────────────────────────
// WorkItem
//
// Session 01 base fields (order … notes)
// Session 02 additions  ← partCode, estimatedHours
// ─────────────────────────────────────────────────────────────────────────────

entity WorkItem : cuid, managed {
    order          : Association to MaintenanceOrder not null;

    @assert.notNull
    description    : String(200);

    technician     : String(100);        // Session 01: who performs the task
    status         : WorkItemStatus not null default 'PENDING';
    notes          : String(500);        // Session 01: task notes and findings

    // ── Session 02 additions ──────────────────────────────────────────────────
    partCode       : String(20);         // spare part reference — validated via SparePartsAPI
    estimatedHours : Decimal(4,1);       // estimated work hours for this task
}
