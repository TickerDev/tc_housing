local bridge = exports.tc_lib:use("bridge")

---Builds apartment complex data for units owned by a specific player.
---@param source number Player server ID
---@param propertyId number Property ID of the apartment complex
---@return table|nil Complex data with id, name, and units array, or nil if invalid
function buildPlayerApartmentsInComplex(source, propertyId)
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'apartment' then
        return nil
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return nil
    end
    local units = SQL.PropertyUnit:query():where('property_id', propertyId):get()
    if not units or type(units) ~= 'table' then
        return {
            id = propertyId,
            name = property.name,
            units = {}
        }
    end

    local complexUnits = {}

    for _, unit in ipairs(units) do
        local owners = SQL.PropertyOwner:query()
            :where('unit_id', unit.id)
            :where('owner_identifier', citizenId)
            :get()

        if owners and #owners > 0 then
            local ownershipType = 'renter'
            for _, owner in ipairs(owners) do
                if owner.ownership_type == 'owner' then
                    ownershipType = 'owner'
                    break
                end
            end

            local basePrice = tonumber(unit.purchase_price or unit.base_price or 0) or 0
            local rentPrice = unit.rent_price and tonumber(unit.rent_price) or nil
            if (not rentPrice or rentPrice <= 0) and basePrice > 0 then
                local factor = (Config.Market and Config.Market.RentFactor) or 0.0075
                rentPrice = math.floor(basePrice * factor)
            end

            table.insert(complexUnits, {
                id = unit.id,
                name = unit.unit_name,
                price = basePrice,
                rentPrice = rentPrice,
                ownershipType = ownershipType,
            })
        end
    end

    return {
        id = propertyId,
        name = property.name,
        units = complexUnits
    }
end

---Builds complete apartment complex data including all units and their status.
---@param propertyId number Property ID of the apartment complex
---@return table|nil Complex data with id, name, and units array, or nil if invalid
function buildApartmentComplexData(propertyId)
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'apartment' then
        return nil
    end

    local units = SQL.PropertyUnit:query():where('property_id', propertyId):get()
    if not units or type(units) ~= 'table' then
        return {
            id = propertyId,
            name = property.name,
            units = {}
        }
    end

    local complexUnits = {}

    for _, unit in ipairs(units) do
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

        table.insert(complexUnits, {
            id = unit.id,
            name = unit.unit_name,
            price = basePrice,
            rentPrice = rentPrice,
            status = status,
            isRentable = unit.is_rentable ~= false
        })
    end

    return {
        id = propertyId,
        name = property.name,
        units = complexUnits
    }
end

---Builds data for all MLO (Multi-Level Object) houses with configured doors and signs.
---@return table Array of MLO house entries with propertyId, unitId, name, coordinates, mloDoors, mloForSaleSign, and status
function buildMloHousesData()
    local results = {}

    for _, prop in pairs(PropertiesCache) do
        if prop.type == 'house' and prop.interiorType == 'MLO' then
            local unit = SQL.PropertyUnit:query():where('property_id', prop.id):first()

            if unit then
                local doors = unit.mlo_doors or {}
                local sign = unit.mlo_forsale_sign or nil

                if type(doors) == 'string' then
                    doors = json.decode(doors) or {}
                end

                if type(sign) == 'string' then
                    sign = json.decode(sign) or nil
                end

                if (doors and #doors > 0) or sign then
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

                    table.insert(results, {
                        propertyId = prop.id,
                        unitId = unit.id,
                        name = prop.name,
                        coordinates = prop.coordinates,
                        mloDoors = doors,
                        mloForSaleSign = sign,
                        status = status
                    })
                end
            end
        end
    end

    return results
end

