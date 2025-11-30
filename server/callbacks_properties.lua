local bridge = exports.tc_lib:use("bridge")

---Callback: Returns all cached properties to the requesting client.
---@param source number Player server ID
---@return table Array of all properties in the cache
lib.callback.register('tc_housing:server:loadProperties', function(source)
    local result = {}
    local count = 0
    for _, prop in pairs(PropertiesCache) do
        table.insert(result, prop)
        count = count + 1
    end
    print(string.format("[Housing] loadProperties callback: returning %d properties to client %d", count, source))
    return result
end)

---Callback: Returns apartment complex data for a given property ID.
---@param source number Player server ID
---@param propertyId number Property ID of the apartment complex
---@return table|nil Complex data with id, name, and units array
lib.callback.register('tc_housing:server:getApartmentComplex', function(source, propertyId)
    return buildApartmentComplexData(propertyId)
end)

---Callback: Returns apartment complex data for units owned by the requesting player.
---@param source number Player server ID
---@param propertyId number Property ID of the apartment complex
---@return table|nil Complex data with id, name, and units array owned by the player
lib.callback.register('tc_housing:server:getMyApartmentsInComplex', function(source, propertyId)
    return buildPlayerApartmentsInComplex(source, propertyId)
end)

---Callback: Returns all MLO houses data with configured doors and signs.
---@param source number Player server ID
---@return table Array of MLO house entries
lib.callback.register('tc_housing:server:getMloHouses', function(source)
    return buildMloHousesData()
end)

---Callback: Returns house data including price, rent price, and ownership status.
---@param source number Player server ID
---@param propertyId number Property ID of the house
---@return table|nil House data with id, unitId, name, address, price, rentPrice, status, and isRentable, or nil if invalid
lib.callback.register('tc_housing:server:getHouseData', function(source, propertyId)
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end
    if not propertyId then return nil end

    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'house' then
        return nil
    end

    local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()
    if not unit then return nil end

    local status = 'available'
    local owners = SQL.PropertyOwner:query():where('unit_id', unit.id):get()
    if owners and #owners > 0 then
        for _, owner in ipairs(owners) do
            if owner.ownership_type == 'owner' then
                status = 'owned'
                break
            elseif owner.ownership_type == 'renter' then
                status = 'rented'
            end
        end
    end

    local basePrice = tonumber(unit.purchase_price or unit.base_price or 0) or 0
    local rentPrice = unit.rent_price and tonumber(unit.rent_price) or nil
    if (not rentPrice or rentPrice <= 0) and basePrice > 0 then
        local factor = (Config.Market and Config.Market.RentFactor) or 0.0075
        rentPrice = math.floor(basePrice * factor)
    end

    return {
        id = propertyId,
        unitId = unit.id,
        name = property.name,
        address = property.address,
        price = basePrice,
        rentPrice = rentPrice,
        status = status,
        isRentable = unit.is_rentable ~= false
    }
end)

---Callback: Returns MLO configuration (doors and for-sale sign) for a property.
---@param source number Player server ID
---@param propertyId number Property ID
---@return table|nil Config data with doors array and forSaleSign, or nil if invalid
lib.callback.register('tc_housing:server:getMloConfig', function(source, propertyId)
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    if not propertyId then return nil end

    local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()
    if not unit then return nil end

    local doors = unit.mlo_doors or {}
    local sign = unit.mlo_forsale_sign or nil

    if type(doors) == 'string' then
        doors = json.decode(doors) or {}
    end

    if type(sign) == 'string' then
        sign = json.decode(sign) or nil
    end

    return {
        doors = doors,
        forSaleSign = sign
    }
end)

---Callback: Checks if a player can enter an MLO house (has ownership or keys).
---@param source number Player server ID
---@param propertyId number Property ID
---@return boolean True if player can enter, false otherwise
lib.callback.register('tc_housing:server:canEnterMloHouse', function(source, propertyId)
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    if not propertyId then
        return false
    end

    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'house' then
        return false
    end

    local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()
    if not unit then
        return false
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return false
    end

    local owners = SQL.PropertyOwner:query()
        :where('unit_id', unit.id)
        :where('owner_identifier', citizenId)
        :get()

    if owners and #owners > 0 then
        return true
    end

    local keys = SQL.PropertyKey:query()
        :where('unit_id', unit.id)
        :where('key_holder', citizenId)
        :get()

    if keys and #keys > 0 then
        return true
    end

    return false
end)

---Callback: Gets or creates a unit ID for a house property.
---@param source number Player server ID
---@param propertyId number Property ID
---@return number|nil Unit ID, or nil if property doesn't exist
lib.callback.register('tc_housing:server:getHouseUnitId', function(source, propertyId)
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end
    if not propertyId then return nil end

    local unit = SQL.PropertyUnit:query():where('property_id', propertyId):first()

    if not unit then
        local property = PropertiesCache[propertyId]
        if not property then
            property = SQL.Property:query():where('id', propertyId):first()
        end

        if not property then return nil end

        local newUnit = SQL.PropertyUnit:create({
            property_id = propertyId,
            unit_name = property.name or property.label or ('House ' .. tostring(propertyId)),
            unit_address = property.address or '',
            interior_type = property.interiorType or property.interior_type or 'Shell',
            shell_name = property.shellName or property.shell_name or '',
            description = property.description or '',
            interior_coords = { x = 0, y = 0, z = 0 },
            purchase_price = 0,
            base_price = 0
        })

        if not newUnit or not newUnit.id then
            return nil
        end

        unit = newUnit
    end

    return unit.id
end)

---Callback: Returns all connected players with their citizen IDs and names, sorted alphabetically.
---@param source number Player server ID
---@return table Array of player data with source, citizenId, and name
lib.callback.register('tc_housing:server:getAllPlayers', function(source)
    local players = {}
    for _, playerId in ipairs(GetPlayers()) do
        local id = tonumber(playerId)
        if id then
            local citizenId = bridge.GetPlayerCitizenId(id)
            local fullName = bridge.GetPlayerFullName(id)
            if citizenId and fullName then
                table.insert(players, {
                    source = id,
                    citizenId = citizenId,
                    name = fullName
                })
            end
        end
    end

    table.sort(players, function(a, b)
        return a.name < b.name
    end)

    return players
end)

