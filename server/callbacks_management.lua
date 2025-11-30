---Callback: Creates a new property (house or apartment complex) in the database.
---@param source number Player server ID
---@param data table Property data with type, name, address, coords, interiorType, shellName, description, and optional units array
---@return table Result with success boolean, error string if failed, or property ID if successful
lib.callback.register('tc_housing:server:createProperty', function(source, data)
    local newProperty = SQL.Property:create({
        type = data.type,
        label = data.name,
        address = data.address,
        entrance_coords = data.coords,
        interior_type = data.interiorType or 'Shell',
        shell_name = data.shellName or '',
        description = data.description or ''
    })

    if not newProperty or not newProperty.id then
        print("[Housing] ERROR: Failed to create property")
        return { success = false, error = 'Failed to create property' }
    end

    print(string.format("[Housing] Created property: id=%d, name=%s", newProperty.id, newProperty.label))

    local propertyId = newProperty.id
    local units = nil

    if data.type == 'apartment' and data.units then
        units = {}
        for _, unit in ipairs(data.units) do
            local newUnit = SQL.PropertyUnit:create({
                property_id = propertyId,
                unit_name = unit.name,
                unit_address = unit.address or '',
                interior_type = unit.interiorType or 'Shell',
                shell_name = unit.shellName or '',
                description = unit.description or '',
                interior_coords = { x = 0, y = 0, z = 0 },
                purchase_price = tonumber(unit.price) or 0,
                base_price = tonumber(unit.price) or 0
            })
            if newUnit and newUnit.id then
                table.insert(units, {
                    id = newUnit.id,
                    name = unit.name,
                    address = unit.address,
                    interiorType = unit.interiorType or 'Shell',
                    shellName = unit.shellName,
                    description = unit.description,
                    price = unit.price
                })
            end
        end
    end

    if data.type == 'house' then
        SQL.PropertyUnit:create({
            property_id = propertyId,
            unit_name = data.name,
            unit_address = data.address or '',
            interior_type = data.interiorType or 'Shell',
            shell_name = data.shellName or '',
            description = data.description or '',
            interior_coords = { x = 0, y = 0, z = 0 },
            purchase_price = tonumber(data.price) or 0,
            base_price = tonumber(data.price) or 0
        })
    end

    LoadPropertiesCache()

    local cacheCount = 0
    for _ in pairs(PropertiesCache) do
        cacheCount = cacheCount + 1
    end
    print(string.format("[Housing] Property created successfully, cache reloaded. Total properties in cache: %d",
        cacheCount))

    broadcastApartmentMarkers()
    return { success = true, id = propertyId }
end)

---Callback: Updates an existing property's information.
---@param source number Player server ID
---@param propertyId number Property ID to update
---@param data table Update data with name, address, interiorType, shellName, description, optional coordinates, and optional price
---@return table Result with success boolean
lib.callback.register('tc_housing:server:updateProperty', function(source, propertyId, data)
    local updateData = {
        label = data.name,
        address = data.address,
        interior_type = data.interiorType,
        shell_name = data.shellName,
        description = data.description
    }

    if data.coordinates and data.coordinates.x and data.coordinates.y and data.coordinates.z then
        updateData.entrance_coords = json.encode({
            x = data.coordinates.x,
            y = data.coordinates.y,
            z = data.coordinates.z
        })
    end

    local updated = SQL.Property:update(updateData, { id = propertyId })

    if updated and PropertiesCache[propertyId] then
        PropertiesCache[propertyId].name = data.name
        PropertiesCache[propertyId].address = data.address
        PropertiesCache[propertyId].description = data.description
        PropertiesCache[propertyId].interiorType = data.interiorType
        PropertiesCache[propertyId].shellName = data.shellName

        if data.coordinates then
            PropertiesCache[propertyId].coordinates = {
                x = data.coordinates.x,
                y = data.coordinates.y,
                z = data.coordinates.z
            }
        end
    end

    if data.price and PropertiesCache[propertyId] and PropertiesCache[propertyId].type == 'house' then
        local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()
        if unit then
            local priceNum = tonumber(data.price) or 0
            SQL.PropertyUnit:update({
                purchase_price = priceNum,
                base_price = priceNum
            }, { id = unit.id })
        end
    end

    if updated then
        broadcastApartmentMarkers()
    end

    return { success = updated ~= nil }
end)

---Callback: Updates an existing property unit's information.
---@param source number Player server ID
---@param unitId number Unit ID to update
---@param data table Update data with name, address, interiorType, shellName, description, and price
---@return table Result with success boolean
lib.callback.register('tc_housing:server:updateUnit', function(source, unitId, data)
    local updated = SQL.PropertyUnit:update({
        unit_name = data.name,
        unit_address = data.address,
        interior_type = data.interiorType,
        shell_name = data.shellName,
        description = data.description,
        purchase_price = tonumber(data.price) or 0
    }, { id = unitId })

    if updated then
        for propId, prop in pairs(PropertiesCache) do
            if prop.units then
                for i, unit in ipairs(prop.units) do
                    if unit.id == unitId then
                        PropertiesCache[propId].units[i].name = data.name
                        PropertiesCache[propId].units[i].address = data.address
                        PropertiesCache[propId].units[i].interiorType = data.interiorType
                        PropertiesCache[propId].units[i].shellName = data.shellName
                        PropertiesCache[propId].units[i].description = data.description
                        PropertiesCache[propId].units[i].price = data.price
                        break
                    end
                end
            end
        end
    end

    return { success = updated ~= nil }
end)

---Callback: Sets or clears the owner of a property unit.
---@param source number Player server ID
---@param unitId number Unit ID
---@param citizenId string|nil Citizen ID to set as owner, or empty string/nil to clear ownership
---@return table Result with success boolean and error string if failed
lib.callback.register('tc_housing:server:setUnitOwner', function(source, unitId, citizenId)
    if type(unitId) ~= 'number' then
        unitId = tonumber(unitId)
    end
    if not unitId then
        return { success = false, error = 'invalid_unit' }
    end

    local unit = SQL.PropertyUnit:query():where('id', unitId):first()
    if not unit then
        return { success = false, error = 'unit_not_found' }
    end

    SQL.PropertyOwner:delete({ unit_id = unitId })
    SQL.PropertyKey:delete({ unit_id = unitId })

    if citizenId and citizenId ~= '' then
        SQL.PropertyOwner:create({
            unit_id = unitId,
            owner_identifier = citizenId,
            ownership_type = 'owner',
            rent_expires = nil,
            created_at = os.date('%Y-%m-%d %H:%M:%S')
        })

        SQL.PropertyKey:create({
            unit_id = unitId,
            key_holder = citizenId,
            given_by = citizenId,
            created_at = os.date('%Y-%m-%d %H:%M:%S')
        })
    end

    TriggerClientEvent('tc_housing:client:reloadMloHouses', -1)

    return { success = true }
end)

---Callback: Deletes a property and all associated data from the database.
---@param source number Player server ID
---@param propertyId number Property ID to delete
---@return table Result with success boolean and error string if failed
lib.callback.register('tc_housing:server:deleteProperty', function(source, propertyId)
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    if not propertyId then
        return { success = false, error = 'invalid_property' }
    end

    local property = SQL.Property:query():where('id', propertyId):first()
    if not property then
        return { success = false, error = 'not_found' }
    end

    SQL.Property:delete({ id = propertyId })

    LoadPropertiesCache()
    broadcastApartmentMarkers()

    TriggerClientEvent('tc_housing:client:deletedProperty', -1, propertyId)

    return { success = true }
end)

