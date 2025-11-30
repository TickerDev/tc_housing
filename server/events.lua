---Event handler: Saves MLO configuration (doors and for-sale sign) for a property.
---@param propertyId number Property ID
---@param data table Configuration data with doors array and optional forSaleSign
RegisterNetEvent('tc_housing:server:saveMloConfig', function(propertyId, data)
    local src = source

    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    if not propertyId or type(data) ~= 'table' then return end

    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'house' then
        return
    end

    local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()
    if not unit then
        return
    end

    local doors = data.doors or {}
    local forSaleSign = data.forSaleSign or nil

    SQL.PropertyUnit:update({
        mlo_doors = doors,
        mlo_forsale_sign = forSaleSign
    }, { id = unit.id })

    TriggerClientEvent('tc_housing:client:updateMloHouse', -1, {
        propertyId = propertyId,
        unitId = unit.id,
        name = property.name,
        coordinates = property.coordinates,
        mloDoors = doors,
        mloForSaleSign = forSaleSign
    })
end)

RegisterNetEvent('tc_housing:requestApartmentPoints', function()
    sendApartmentMarkers(source)
end)

RegisterNetEvent('tc_housing:leaveApartment', function()
    LeaveHousingShell(source)
end)

RegisterNetEvent('tc_housing:server:requestApartmentPoints', function()
    sendApartmentMarkers(source)
end)

RegisterNetEvent('tc_housing:server:leaveApartment', function()
    LeaveHousingShell(source)
end)

