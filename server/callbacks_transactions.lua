local bridge = exports.tc_lib:use("bridge")

---Callback: Handles apartment purchase or rental transaction.
---@param source number Player server ID
---@param unitId number Unit ID to purchase/rent
---@param paymentMethod string Payment method ('bank', 'cash', etc.)
---@param mode string Transaction mode ('buy' or 'rent')
---@param days number Number of days for rental (1-30)
---@return table Result with success boolean, error string if failed, or complex data if successful
lib.callback.register('tc_housing:server:buyApartment', function(source, unitId, paymentMethod, mode, days)
    mode = mode == 'rent' and 'rent' or 'buy'
    paymentMethod = paymentMethod or 'bank'
    days = tonumber(days) or 1

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

    local propertyId = unit.property_id
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'apartment' then
        return { success = false, error = 'invalid_property' }
    end

    local owners = SQL.PropertyOwner:query():where('unit_id', unitId):get()
    if owners and #owners > 0 then
        for _, owner in ipairs(owners) do
            if owner.ownership_type == 'owner' or owner.ownership_type == 'renter' then
                return { success = false, error = 'unit_taken' }
            end
        end
    end

    local price
    local reason
    local rentExpires = nil

    if mode == 'rent' then
        if days < 1 or days > 30 then
            return { success = false, error = 'invalid_days' }
        end

        local basePrice = tonumber(unit.purchase_price or unit.base_price or 0) or 0
        price = Config.Market.calculateRent(basePrice, days)

        if price <= 0 then
            return { success = false, error = 'no_rent_price' }
        end
        reason = string.format('Rent apartment #%d in %s for %d days', unitId, property.name, days)
        rentExpires = os.date('%Y-%m-%d %H:%M:%S', os.time() + (days * 86400))
    else
        price = tonumber(unit.purchase_price or unit.base_price or 0) or 0
        if price <= 0 then
            return { success = false, error = 'no_price' }
        end
        reason = string.format('Purchased apartment #%d in %s', unitId, property.name)
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return { success = false, error = 'no_player' }
    end

    local balance = bridge.GetMoney(source, paymentMethod)
    if type(balance) ~= 'number' or balance < price then
        return { success = false, error = 'not_enough_money' }
    end

    bridge.RemoveMoney(source, price, paymentMethod)

    SQL.PropertyOwner:create({
        unit_id = unitId,
        owner_identifier = citizenId,
        ownership_type = mode == 'rent' and 'renter' or 'owner',
        rent_expires = rentExpires,
        created_at = os.date('%Y-%m-%d %H:%M:%S')
    })

    SQL.PropertyKey:create({
        unit_id = unitId,
        key_holder = citizenId,
        given_by = citizenId,
        created_at = os.date('%Y-%m-%d %H:%M:%S')
    })

    exports.qbx_core:Notify(source, mode == 'rent'
        and string.format('You rented apartment #%d in %s for $%d', unitId, property.name, price)
        or string.format('You purchased apartment #%d in %s for $%d', unitId, property.name, price),
        'success')

    local complex = buildApartmentComplexData(propertyId)
    return { success = true, complex = complex }
end)

---Callback: Handles house purchase or rental transaction.
---@param source number Player server ID
---@param unitId number Unit ID to purchase/rent
---@param paymentMethod string Payment method ('bank', 'cash', etc.)
---@param mode string Transaction mode ('buy' or 'rent')
---@param days number Number of days for rental (1-30)
---@return table Result with success boolean, error string if failed, or house data if successful
lib.callback.register('tc_housing:server:buyHouse', function(source, unitId, paymentMethod, mode, days)
    mode = mode == 'rent' and 'rent' or 'buy'
    paymentMethod = paymentMethod or 'bank'
    days = tonumber(days) or 1

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

    local propertyId = unit.property_id
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'house' then
        return { success = false, error = 'invalid_property' }
    end

    local owners = SQL.PropertyOwner:query():where('unit_id', unitId):get()
    if owners and #owners > 0 then
        for _, owner in ipairs(owners) do
            if owner.ownership_type == 'owner' or owner.ownership_type == 'renter' then
                return { success = false, error = 'house_taken' }
            end
        end
    end

    local price
    local reason
    local rentExpires = nil

    if mode == 'rent' then
        if days < 1 or days > 30 then
            return { success = false, error = 'invalid_days' }
        end

        local basePrice = tonumber(unit.purchase_price or unit.base_price or 0) or 0
        price = Config.Market.calculateRent(basePrice, days)

        if price <= 0 then
            return { success = false, error = 'no_rent_price' }
        end
        reason = string.format('Rent house %s for %d days', property.name, days)
        rentExpires = os.date('%Y-%m-%d %H:%M:%S', os.time() + (days * 86400))
    else
        price = tonumber(unit.purchase_price or unit.base_price or 0) or 0
        if price <= 0 then
            return { success = false, error = 'no_price' }
        end
        reason = string.format('Purchased house %s', property.name)
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return { success = false, error = 'no_player' }
    end

    local balance = bridge.GetMoney(source, paymentMethod)
    if type(balance) ~= 'number' or balance < price then
        return { success = false, error = 'not_enough_money' }
    end

    bridge.RemoveMoney(source, price, paymentMethod)

    SQL.PropertyOwner:create({
        unit_id = unitId,
        owner_identifier = citizenId,
        ownership_type = mode == 'rent' and 'renter' or 'owner',
        rent_expires = rentExpires,
        created_at = os.date('%Y-%m-%d %H:%M:%S')
    })

    SQL.PropertyKey:create({
        unit_id = unitId,
        key_holder = citizenId,
        given_by = citizenId,
        created_at = os.date('%Y-%m-%d %H:%M:%S')
    })

    exports.qbx_core:Notify(source, mode == 'rent'
        and string.format('You rented %s for $%d', property.name, price)
        or string.format('You purchased %s for $%d', property.name, price),
        'success')

    local status = mode == 'rent' and 'rented' or 'owned'
    local basePrice = tonumber(unit.purchase_price or unit.base_price or 0) or 0
    local rentPrice = unit.rent_price and tonumber(unit.rent_price) or nil
    if (not rentPrice or rentPrice <= 0) and basePrice > 0 then
        rentPrice = math.floor(basePrice * 0.1)
    end

    local houseData = {
        id = property.id,
        unitId = unitId,
        name = property.name,
        address = property.address or property.name,
        price = basePrice,
        rentPrice = rentPrice,
        status = status,
        isRentable = rentPrice and rentPrice > 0 or false
    }

    TriggerClientEvent('tc_housing:client:reloadMloHouses', -1)

    return { success = true, house = houseData }
end)

---Callback: Handles player entering an apartment shell.
---@param source number Player server ID
---@param unitId number Unit ID to enter
---@return table Result with success boolean and error string if failed
lib.callback.register('tc_housing:server:enterApartment', function(source, unitId)
    if type(unitId) ~= 'number' then
        unitId = tonumber(unitId)
    end
    if not unitId then
        return { success = false, error = 'invalid_unit' }
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return { success = false, error = 'no_player' }
    end

    local ownership = SQL.PropertyOwner:query()
        :where('unit_id', unitId)
        :where('owner_identifier', citizenId)
        :first()

    if not ownership then
        return { success = false, error = 'not_owner' }
    end

    local unit = SQL.PropertyUnit:query():where('id', unitId):first()
    if not unit then
        return { success = false, error = 'unit_not_found' }
    end

    local propertyId = unit.property_id
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'apartment' then
        return { success = false, error = 'invalid_property' }
    end

    local shellKey = unit.shell_name or property.shellName
    if not shellKey or not Config.Shells[shellKey] then
        return { success = false, error = 'no_shell_configured' }
    end

    local coords = property.coordinates or { x = 0, y = 0, z = 0 }
    local exitCoords = vec3(coords.x or 0.0, coords.y or 0.0, coords.z or 0.0)

    local shell = CreateHousingShell(shellKey, vec3(-100, -100, -100), source, exitCoords)
    if not shell then
        return { success = false, error = 'shell_spawn_failed' }
    end

    TriggerClientEvent('tc_housing:client:enteredApartmentShell', source, {
        shellKey = shellKey,
        exitCoords = exitCoords
    })

    return { success = true }
end)

---Callback: Handles player entering a house shell.
---@param source number Player server ID
---@param unitId number Unit ID to enter
---@return table Result with success boolean and error string if failed
lib.callback.register('tc_housing:server:enterHouse', function(source, unitId)
    if type(unitId) ~= 'number' then
        unitId = tonumber(unitId)
    end
    if not unitId then
        return { success = false, error = 'invalid_unit' }
    end

    local citizenId = bridge.GetPlayerCitizenId(source)
    if not citizenId then
        return { success = false, error = 'no_player' }
    end

    local ownership = SQL.PropertyOwner:query()
        :where('unit_id', unitId)
        :where('owner_identifier', citizenId)
        :first()

    if not ownership then
        return { success = false, error = 'not_owner' }
    end

    local unit = SQL.PropertyUnit:query():where('id', unitId):first()
    if not unit then
        return { success = false, error = 'unit_not_found' }
    end

    local propertyId = unit.property_id
    local property = PropertiesCache[propertyId]
    if not property or property.type ~= 'house' then
        return { success = false, error = 'invalid_property' }
    end

    local shellKey = unit.shell_name
    if not shellKey or shellKey == '' then
        shellKey = property.shellName
    end

    if not shellKey or shellKey == '' or not Config.Shells[shellKey] then
        return { success = false, error = 'no_shell_configured' }
    end

    local coords = property.coordinates or { x = 0, y = 0, z = 0 }
    local exitCoords = vec3(coords.x or 0.0, coords.y or 0.0, coords.z or 0.0)

    local shell = CreateHousingShell(shellKey, vec3(-100, -100, -100), source, exitCoords)
    if not shell then
        return { success = false, error = 'shell_spawn_failed' }
    end

    TriggerClientEvent('tc_housing:client:enteredApartmentShell', source, {
        shellKey = shellKey,
        exitCoords = exitCoords
    })

    return { success = true }
end)

