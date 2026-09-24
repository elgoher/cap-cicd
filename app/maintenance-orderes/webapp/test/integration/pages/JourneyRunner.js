sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/sap/mngords/maintenanceorderes/test/integration/pages/MaintenanceOrdersList.gen",
	"com/sap/mngords/maintenanceorderes/test/integration/pages/MaintenanceOrdersObjectPage.gen",
	"com/sap/mngords/maintenanceorderes/test/integration/pages/WorkItemsObjectPage.gen"
], function (JourneyRunner, MaintenanceOrdersListGenerated, MaintenanceOrdersObjectPageGenerated, WorkItemsObjectPageGenerated) {
    'use strict';

    const runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/sap/mngords/maintenanceorderes') + '/test/flp.html#app-preview',
        pages: {
			onTheMaintenanceOrdersListGenerated: MaintenanceOrdersListGenerated,
			onTheMaintenanceOrdersObjectPageGenerated: MaintenanceOrdersObjectPageGenerated,
			onTheWorkItemsObjectPageGenerated: WorkItemsObjectPageGenerated
        },
        async: true
    });

    return runner;
});

