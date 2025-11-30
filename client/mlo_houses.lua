local textui = exports.tc_lib:use("textui")
local target = exports.tc_lib:use("target")
local mloHouses = {}
local mloHouseTargets = {}
local doorZoneToPropertyId = {}
local doorStates = {}

---Clears all MLO house targets (zones, entities, points) for a specific property.
---@param propertyId number Property ID to clear targets for
local function clearMloHouseTargets(propertyId)
    local data = mloHouseTargets[propertyId]
    if not data then return end

    if data.doorZones then
        for _, zoneName in ipairs(data.doorZones) do
            target.RemoveZone(zoneName)
            doorZoneToPropertyId[zoneName] = nil
        end
    end

    if data.doorZoneIds then
        for _, zoneId in ipairs(data.doorZoneIds) do
            doorZoneToPropertyId[zoneId] = nil
        end
    end

    if data.signZone then
        target.RemoveZone(data.signZone)
    end

    if data.signEntity and DoesEntityExist(data.signEntity) then
        DeleteEntity(data.signEntity)
    end

    if data.signPoint and data.signPoint.remove then
        data.signPoint:remove()
    end

    doorStates[propertyId] = nil
    mloHouseTargets[propertyId] = nil
end

---Generates target options for an MLO door based on its lock state.
---@param propertyId number Property ID
---@param doorIndex number Door index
---@param isLocked boolean Whether the door is currently locked
---@return table Array of target options
local function getDoorOptions(propertyId, doorIndex, isLocked)
    local options = {
        {
            type = 'client',
            event = isLocked and 'tc_housing:client:mloToggleDoor' or 'tc_housing:client:mloToggleDoor',
            icon = isLocked and 'fas fa-door-open' or 'fas fa-lock',
            label = isLocked and 'Open door' or 'Lock door',
            propertyId = propertyId,
            doorIndex = doorIndex,
        },
        {
            type = 'client',
            event = 'tc_housing:client:mloRingDoorbell',
            icon = 'fas fa-bell',
            label = 'Ring doorbell',
            propertyId = propertyId,
        },
    }
    return options
end

---Sets up all MLO house targets including door zones, door systems, and for-sale signs.
---@param entry table MLO house entry data with propertyId, mloDoors, mloForSaleSign, and status
local function setupMloHouseTargets(entry)
    local propertyId = entry.propertyId
    if not propertyId then
        return
    end

    clearMloHouseTargets(propertyId)

    if not doorStates[propertyId] then
        doorStates[propertyId] = {}
    end

    local targets = {
        doorZones = {},
        doorZoneIds = {},
        signZone = nil,
        signEntity = nil
    }

    if entry.mloDoors and type(entry.mloDoors) == 'table' then
        for index, door in ipairs(entry.mloDoors) do
            local doorParts = nil

            if door.doors and type(door.doors) == 'table' then
                doorParts = door.doors
            else
                doorParts = { door }
            end

            local sumX, sumY, sumZ, count = 0.0, 0.0, 0.0, 0
            for _, part in ipairs(doorParts) do
                if part.x and part.y and part.z then
                    sumX = sumX + part.x
                    sumY = sumY + part.y
                    sumZ = sumZ + part.z
                    count = count + 1
                end
            end

            if count > 0 then
                local center = vec3(sumX / count, sumY / count, sumZ / count)
                local zoneName = ('tc_housing_mlo_door_%s_%s'):format(tostring(propertyId), tostring(index))

                if not doorStates[propertyId][index] then
                    doorStates[propertyId][index] = 1
                end
                local isLocked = doorStates[propertyId][index] == 1

                local zoneId = target.AddCircleZone(zoneName, center, 1.2, {
                    name = zoneName,
                    debugPoly = false,
                    useZ = true,
                }, {
                    options = getDoorOptions(propertyId, index, isLocked),
                    distance = 2.0,
                })

                doorZoneToPropertyId[zoneId] = propertyId
                doorZoneToPropertyId[zoneName] = { propertyId = propertyId, doorIndex = index }

                targets.doorZones[#targets.doorZones + 1] = zoneName
                targets.doorZoneIds[#targets.doorZoneIds + 1] = zoneId

                for partIndex, part in ipairs(doorParts) do
                    if part.model and part.x and part.y and part.z then
                        local coords = vec3(part.x, part.y, part.z)
                        local doorHash = GetHashKey(
                            ('tc_housing_mlo_%s_%s_%s'):format(tostring(propertyId), tostring(index), tostring(partIndex)))
                        AddDoorToSystem(doorHash, part.model, coords.x, coords.y, coords.z, false, false, false)
                        DoorSystemSetDoorState(doorHash, doorStates[propertyId][index], false, false)
                    end
                end
            end
        end
    end

    local isAvailable = not entry.status or entry.status == 'available'
    if isAvailable and entry.mloForSaleSign and entry.mloForSaleSign.x and entry.mloForSaleSign.y and entry.mloForSaleSign.z then
        local signCoords = vec3(entry.mloForSaleSign.x, entry.mloForSaleSign.y, entry.mloForSaleSign.z)
        local heading = entry.mloForSaleSign.h or 0.0

        if Config and Config.ForSaleSignModel then
            local modelName = Config.ForSaleSignModel
            local modelHash
            if type(modelName) == 'string' then
                modelHash = joaat(modelName)
            else
                modelHash = modelName
            end

            if not HasModelLoaded(modelHash) then
                RequestModel(modelHash)
                local timeout = GetGameTimer() + 10000
                while not HasModelLoaded(modelHash) and GetGameTimer() < timeout do
                    Wait(0)
                end
            end

            if HasModelLoaded(modelHash) then
                local foundGround, groundZ = GetGroundZFor_3dCoord(signCoords.x, signCoords.y, signCoords.z + 10.0, false)
                if foundGround then
                    signCoords = vec3(signCoords.x, signCoords.y, groundZ)
                end

                local signEntity = CreateObject(modelHash, signCoords.x, signCoords.y, signCoords.z, false, false, false)
                SetEntityHeading(signEntity, heading)
                PlaceObjectOnGroundProperly(signEntity)
                Wait(100)

                local finalCoords = GetEntityCoords(signEntity)
                local foundFinalGround, finalGroundZ = GetGroundZFor_3dCoord(finalCoords.x, finalCoords.y,
                    finalCoords.z + 5.0, false)
                if foundFinalGround then
                    SetEntityCoordsNoOffset(signEntity, finalCoords.x, finalCoords.y, finalGroundZ, false, false, false)
                    signCoords = vec3(finalCoords.x, finalCoords.y, finalGroundZ)
                else
                    signCoords = finalCoords
                end

                FreezeEntityPosition(signEntity, true)
                SetModelAsNoLongerNeeded(modelHash)
                targets.signEntity = signEntity
            end
        end

        if targets.signEntity and DoesEntityExist(targets.signEntity) then
            signCoords = GetEntityCoords(targets.signEntity)
        end

        local marker = lib.marker.new({
            coords = signCoords,
            type = 1,
            width = 1.5,
            height = 1.0,
            color = { r = 53, g = 168, b = 255, a = 220 }
        })

        local point = lib.points.new({
            coords = signCoords,
            distance = 60.0
        })

        function point:nearby()
            if self.currentDistance <= 30.0 then
                marker:draw()
                if self.currentDistance <= 1.5 then
                    textui.ShowTextUI('[E] View house listing')
                    if IsControlJustReleased(0, 38) then
                        textui.HideTextUI()
                        lib.callback('tc_housing:server:getHouseData', false, function(house)
                            if not house then return end
                            SetNuiFocus(true, true)
                            SendNuiMessage(json.encode({
                                type = 'displaying',
                                data = {
                                    type = 'house_purchase',
                                    house = house
                                }
                            }))
                        end, propertyId)
                    end
                else
                    textui.HideTextUI()
                end
            else
                textui.HideTextUI()
            end
        end

        function point:onExit()
            textui.HideTextUI()
        end

        targets.signPoint = point
    end

    mloHouseTargets[propertyId] = targets
    mloHouses[propertyId] = entry
end

---Reloads all MLO houses from the server and sets up their targets.
local function reloadMloHouses()
    for propertyId in pairs(mloHouseTargets) do
        clearMloHouseTargets(propertyId)
    end

    mloHouses = {}

    lib.callback('tc_housing:server:getMloHouses', false, function(entries)
        if type(entries) ~= 'table' then return end

        for _, entry in ipairs(entries) do
            if type(entry) == 'table' and entry.propertyId then
                setupMloHouseTargets(entry)
            end
        end
    end)
end

---Updates a door zone after its lock state changes.
---@param propertyId number Property ID
---@param doorIndex number Door index
local function updateDoorZone(propertyId, doorIndex)
    local entry = mloHouses[propertyId]
    if not entry or not entry.mloDoors or not entry.mloDoors[doorIndex] then return end

    local door = entry.mloDoors[doorIndex]
    local doorParts = door.doors and type(door.doors) == 'table' and door.doors or { door }

    local sumX, sumY, sumZ, count = 0.0, 0.0, 0.0, 0
    for _, part in ipairs(doorParts) do
        if part.x and part.y and part.z then
            sumX = sumX + part.x
            sumY = sumY + part.y
            sumZ = sumZ + part.z
            count = count + 1
        end
    end

    if count == 0 then return end

    local center = vec3(sumX / count, sumY / count, sumZ / count)
    local zoneName = ('tc_housing_mlo_door_%s_%s'):format(tostring(propertyId), tostring(doorIndex))

    target.RemoveZone(zoneName)

    local isLocked = doorStates[propertyId][doorIndex] == 1

    local zoneId = target.AddCircleZone(zoneName, center, 1.2, {
        name = zoneName,
        debugPoly = false,
        useZ = true,
    }, {
        options = getDoorOptions(propertyId, doorIndex, isLocked),
        distance = 2.0,
    })

    doorZoneToPropertyId[zoneId] = propertyId
    doorZoneToPropertyId[zoneName] = { propertyId = propertyId, doorIndex = doorIndex }

    if mloHouseTargets[propertyId] then
        local foundIndex = nil
        for i, name in ipairs(mloHouseTargets[propertyId].doorZones) do
            if name == zoneName then
                foundIndex = i
                break
            end
        end
        if foundIndex then
            mloHouseTargets[propertyId].doorZoneIds[foundIndex] = zoneId
        else
            mloHouseTargets[propertyId].doorZones[#mloHouseTargets[propertyId].doorZones + 1] = zoneName
            mloHouseTargets[propertyId].doorZoneIds[#mloHouseTargets[propertyId].doorZoneIds + 1] = zoneId
        end
    end
end

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end

    for propertyId, data in pairs(mloHouseTargets) do
        if data.doorZones then
            for _, zoneName in ipairs(data.doorZones) do
                target.RemoveZone(zoneName)
            end
        end

        if data.signZone then
            target.RemoveZone(data.signZone)
        end

        if data.signEntity and DoesEntityExist(data.signEntity) then
            DeleteEntity(data.signEntity)
        end

        if data.signPoint and data.signPoint.remove then
            data.signPoint:remove()
        end
    end

    mloHouseTargets = {}
    mloHouses = {}
end)

RegisterNetEvent('tc_housing:client:updateMloHouse', function(entry)
    if type(entry) ~= 'table' or not entry.propertyId then return end
    setupMloHouseTargets(entry)
end)

RegisterNetEvent('tc_housing:client:resetMloTargets', function()
    reloadMloHouses()
end)

CreateThread(function()
    Wait(1500)
    reloadMloHouses()
end)

RegisterNetEvent('tc_housing:client:deletedProperty', function(propertyId)
    if not propertyId then return end
    if mloHouseTargets[propertyId] then
        clearMloHouseTargets(propertyId)
    end
    mloHouses[propertyId] = nil
end)

RegisterNetEvent('tc_housing:client:mloToggleDoor', function(data)
    local propertyId = nil
    local doorIndex = nil

    if type(data) == 'table' then
        if data.doorIndex then
            propertyId = data.propertyId
            doorIndex = data.doorIndex
        else
            local zoneData = data.zone and doorZoneToPropertyId[data.zone]
            if zoneData then
                if type(zoneData) == 'table' then
                    propertyId = zoneData.propertyId
                    doorIndex = zoneData.doorIndex
                else
                    propertyId = zoneData
                end
            elseif data.name and doorZoneToPropertyId[data.name] then
                local zoneData = doorZoneToPropertyId[data.name]
                if type(zoneData) == 'table' then
                    propertyId = zoneData.propertyId
                    doorIndex = zoneData.doorIndex
                else
                    propertyId = zoneData
                end
            elseif data.name and type(data.name) == 'string' then
                local propMatch, doorMatch = data.name:match('tc_housing_mlo_door_(%d+)_(%d+)')
                if propMatch and doorMatch then
                    propertyId = tonumber(propMatch)
                    doorIndex = tonumber(doorMatch)
                else
                    local propOnly = data.name:match('tc_housing_mlo_door_(%d+)_')
                    if propOnly then
                        propertyId = tonumber(propOnly)
                    end
                end
            end
        end
    end

    if not propertyId then
        return
    end

    if not doorIndex then
        doorIndex = 1
    end

    lib.callback('tc_housing:server:canEnterMloHouse', false, function(canEnter)
        if not canEnter then
            exports.qbx_core:Notify('You do not have keys to this house.', 'error')
            return
        end

        local entry = mloHouses[propertyId]
        if not entry or not entry.mloDoors or not entry.mloDoors[doorIndex] then
            return
        end

        local currentState = doorStates[propertyId][doorIndex] or 1
        local newState = currentState == 1 and 0 or 1
        doorStates[propertyId][doorIndex] = newState

        local door = entry.mloDoors[doorIndex]
        local doorParts = door.doors and type(door.doors) == 'table' and door.doors or { door }

        for partIndex, part in ipairs(doorParts) do
            if part.x and part.y and part.z and part.model then
                local coords = vec3(part.x, part.y, part.z)
                local doorHash = GetHashKey(
                    ('tc_housing_mlo_%s_%s_%s'):format(tostring(propertyId), tostring(doorIndex), tostring(partIndex)))
                AddDoorToSystem(doorHash, part.model, coords.x, coords.y, coords.z, false, false, false)
                DoorSystemSetDoorState(doorHash, newState, false, false)
            end
        end

        if newState == 0 then
            exports.qbx_core:Notify('You unlock the door.', 'success')
        else
            exports.qbx_core:Notify('You lock the door.', 'success')
        end

        updateDoorZone(propertyId, doorIndex)
    end, propertyId)
end)

RegisterNetEvent('tc_housing:client:mloRingDoorbell', function(data)
    local propertyId = nil
    if type(data) == 'table' then
        if data.propertyId then
            propertyId = data.propertyId
        elseif data.zone and doorZoneToPropertyId[data.zone] then
            local zoneData = doorZoneToPropertyId[data.zone]
            propertyId = type(zoneData) == 'table' and zoneData.propertyId or zoneData
        elseif data.name and doorZoneToPropertyId[data.name] then
            local zoneData = doorZoneToPropertyId[data.name]
            propertyId = type(zoneData) == 'table' and zoneData.propertyId or zoneData
        elseif data.name and type(data.name) == 'string' then
            local match = data.name:match('tc_housing_mlo_door_(%d+)_')
            if match then
                propertyId = tonumber(match)
            end
        end
    end

    if not propertyId then return end

    exports.qbx_core:Notify('You ring the doorbell.', 'info')
end)

RegisterNetEvent('tc_housing:client:mloOpenHouseListing', function(data)
    local propertyId = (type(data) == 'table' and data.propertyId) or data
    if not propertyId then return end

    lib.callback('tc_housing:server:getApartmentComplex', false, function(complex)
        if not complex then return end

        SetNuiFocus(true, true)
        SendNuiMessage(json.encode({
            type = 'displaying',
            data = {
                type = 'apartment_complex',
                complex = complex
            }
        }))
    end, propertyId)
end)

