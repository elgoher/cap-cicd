'use strict'

const cds = require('@sap/cds')

/**
 * SparePartsAPI client.
 *
 * In production : connects via BTP Destination (OAuth2 client credentials).
 * In test       : this module is mocked with jest.mock('../srv/parts-catalog').
 *
 * Returns { code, description, unitCost, available } or throws on failure.
 */
async function getPartInfo(partCode) {
    const api  = await cds.connect.to('SparePartsAPI')
    const data = await api.send({ method: 'GET', path: `/parts/${encodeURIComponent(partCode)}` })
    return data
}

module.exports = { getPartInfo }
