PropertiesCache = PropertiesCache or {}

---Collects apartment and shell house markers from the properties cache.
---@return table markers Array of marker data with id, name, coords, and type
local function collectApartmentMarkers()
    local markers = {}
    for _, prop in pairs(PropertiesCache) do
        if prop.type == 'apartment' and prop.coordinates then
            table.insert(markers, {
                id = prop.id,
                name = prop.name,
                coords = prop.coordinates,
                type = 'apartment'
            })
        elseif prop.type == 'house' and prop.interiorType == 'Shell' and prop.coordinates then
            table.insert(markers, {
                id = prop.id,
                name = prop.name,
                coords = prop.coordinates,
                type = 'house'
            })
        end
    end
    return markers
end

---Sends apartment markers to a specific client.
---@param target number Player server ID to send markers to
function sendApartmentMarkers(target)
    local markers = collectApartmentMarkers()
    TriggerClientEvent('tc_housing:client:setApartmentPoints', target, markers)
end

---Broadcasts apartment markers to all connected players.
function broadcastApartmentMarkers()
    local markers = collectApartmentMarkers()
    for _, playerId in ipairs(GetPlayers()) do
        local id = tonumber(playerId)
        if id then
            TriggerClientEvent('tc_housing:client:setApartmentPoints', id, markers)
        end
    end
end

---Loads all properties from the database into the properties cache.
function LoadPropertiesCache()
    PropertiesCache = {}

    local properties = SQL.Property:query():get()
    if not properties then
        print("[Housing] No properties found in database (query returned nil)")
        return
    end

    if type(properties) ~= "table" or #properties == 0 then
        print("[Housing] No properties found in database (empty table)")
        return
    end

    local count = 0
    for _, prop in ipairs(properties) do
        local units = nil
        if prop.type == 'apartment' then
            units = SQL.PropertyUnit:query():where('property_id', prop.id):get()
            if units then
                local formattedUnits = {}
                for _, unit in ipairs(units) do
                    table.insert(formattedUnits, {
                        id = unit.id,
                        name = unit.unit_name,
                        address = unit.unit_address,
                        price = tostring(unit.purchase_price or ''),
                        description = unit.description or '',
                        interiorType = unit.interior_type or 'Shell',
                        shellName = unit.shell_name or ''
                    })
                end
                units = formattedUnits
            end
        end

        local coords = { x = 0, y = 0, z = 0 }
        if prop.entrance_coords then
            if type(prop.entrance_coords) == "string" then
                coords = json.decode(prop.entrance_coords) or coords
            else
                coords = prop.entrance_coords
            end
        end

        PropertiesCache[prop.id] = {
            id = prop.id,
            name = prop.label,
            address = prop.address,
            type = prop.type,
            description = prop.description or '',
            interiorType = prop.interior_type or 'Shell',
            shellName = prop.shell_name or '',
            coordinates = coords,
            units = units
        }
        count = count + 1
    end

    print(string.format("[Housing] Loaded %d properties into cache", count))
end

