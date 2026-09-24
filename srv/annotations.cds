using MaintenanceService from './maintenance-service';

/**
 * Fiori Elements annotations — Session 02
 *
 * Incremental over Session 01 (which had no UI annotations).
 * Session 02 introduces the full List Report + Object Page for MaintenanceOrders.
 *
 * @UI.SelectionFields  → filter bar fields in the List Report
 * @UI.LineItem         → table columns in the List Report
 * @UI.HeaderInfo       → Object Page header (title + subtitle)
 * @UI.FieldGroup       → field groups for Object Page sections
 * @UI.Facets           → Object Page layout sections
 */

// ── MaintenanceOrders ─────────────────────────────────────────────────────────

annotate MaintenanceService.MaintenanceOrders with @(

    UI.SelectionFields: [ status, priority, equipment_ID, responsible ],

    UI.LineItem: [
        { Value: orderNumber,  Label: 'Order #'      },
        { Value: equipment_ID, Label: 'Equipment'    },
        { Value: description,  Label: 'Description'  },
        { Value: priority,     Label: 'Priority'     },
        { Value: status,       Label: 'Status'       },
        { Value: responsible,  Label: 'Responsible'  }
    ],

    UI.HeaderInfo: {
        TypeName       : 'Maintenance Order',
        TypeNamePlural : 'Maintenance Orders',
        Title          : { Value: orderNumber },
        Description    : { Value: description }
    },

    UI.Facets: [
        { $Type: 'UI.ReferenceFacet', Label: 'General Information',
          Target: '@UI.FieldGroup#General' },
        { $Type: 'UI.ReferenceFacet', Label: 'Work Items',
          Target: 'workItems/@UI.LineItem' }
    ],

    UI.FieldGroup#General: {
        Data: [
            { Value: orderNumber  },
            { Value: equipment_ID },
            { Value: description  },
            { Value: priority     },
            { Value: status       },
            { Value: responsible  },   // Session 02 addition
            { Value: notes        },   // Session 02 addition
            { Value: plannedStart },
            { Value: plannedEnd   }
        ]
    }
);

// ── WorkItems sub-table ───────────────────────────────────────────────────────

annotate MaintenanceService.WorkItems with @(
    UI.LineItem: [
        { Value: description,    Label: 'Task'             },
        { Value: technician,     Label: 'Technician'       },  // Session 01 field
        { Value: partCode,       Label: 'Part Code'        },  // Session 02 addition
        { Value: estimatedHours, Label: 'Est. Hours'       },  // Session 02 addition
        { Value: status,         Label: 'Status'           }
    ]
);