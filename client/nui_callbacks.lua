local textui = exports.tc_lib:use("textui")

RegisterNuiCallback("loaded", function(_, cb)
    local newConfig = {}
    for k, v in pairs(Config) do
        if type(v) == 'function' then
            goto continue
        end
        newConfig[k] = v
        ::continue::
    end
    SendNuiMessage(json.encode({
        type = 'init',
        locale = lib.getLocales(),
        config = newConfig
    }))
    cb({})
end)

RegisterNuiCallback("loadProperties", function(_, cb)
    lib.callback('tc_housing:server:loadProperties', false, function(properties)
        cb(properties or {})
    end)
end)

RegisterNuiCallback("closeNui", function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNuiCallback("generateVector3", function(_, cb)
    SetNuiFocus(false, false)
    textui.ShowTextUI("Move to the location you want,  \nThen press ENTER to set the vector3")
    CreateThread(function()
        local vectorCoords = nil
        while vectorCoords == nil do
            if IsControlJustReleased(0, 191) then
                local coords = GetEntityCoords(PlayerPedId())
                vectorCoords = {
                    x = coords.x,
                    y = coords.y,
                    z = coords.z
                }

                local streetHash, _ = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
                if streetHash ~= nil then
                    local streetName = GetStreetNameFromHashKey(streetHash)
                    vectorCoords.streetName = streetName
                end

                textui.HideTextUI()
                SetNuiFocus(true, true)
                cb(vectorCoords)
            end
            Wait(0)
        end
    end)
end)

RegisterNuiCallback("configMloSettings", function(data, cb)
    local propertyId = data and data.propertyId
    if not propertyId then
        cb({ success = false, reason = 'invalid_property' })
        return
    end

    SetNuiFocus(false, false)

    CreateThread(function()
        local doors = {}
        local lastEntity = 0

        textui.ShowTextUI(
            "Aim at a door and LEFT-CLICK to add it.\nRIGHT-CLICK when you are done.\nESC/BACKSPACE to cancel.")

        local collectingDoors = true
        while collectingDoors do
            DisablePlayerFiring(PlayerId(), true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)

            local hit, entity, hitCoords = lib.raycast.cam(1 | 16)
            local changedEntity = lastEntity ~= entity

            if changedEntity and lastEntity ~= 0 then
                SetEntityDrawOutline(lastEntity, false)
            end

            lastEntity = entity

            if hit and entity and entity > 0 and GetEntityType(entity) == 3 then
                if changedEntity then
                    SetEntityDrawOutline(entity, true)
                end

                if IsDisabledControlJustPressed(0, 24) then
                    local coords = GetEntityCoords(entity)
                    local heading = GetEntityHeading(entity)
                    local model = GetEntityModel(entity)

                    doors[#doors + 1] = {
                        x = coords.x,
                        y = coords.y,
                        z = coords.z,
                        h = heading,
                        model = model,
                    }

                    textui.ShowTextUI(
                        ("Added door #%d.\nAim at another door and LEFT-CLICK to add, RIGHT-CLICK when done."):format(#
                            doors))
                end
            end

            if IsDisabledControlJustPressed(0, 25) then
                collectingDoors = false
            end

            if IsControlJustReleased(0, 177) or IsControlJustReleased(0, 322) then
                doors = {}
                collectingDoors = false
            end

            Wait(0)
        end

        if lastEntity ~= 0 then
            SetEntityDrawOutline(lastEntity, false)
        end

        textui.HideTextUI()

        if #doors == 0 then
            SetNuiFocus(true, true)
            cb({ success = false, reason = 'no_doors' })
            return
        end

        textui.ShowTextUI("Move to the For-Sale sign position and press ENTER.\nPress BACKSPACE to skip setting a sign.")

        local forSaleSign = nil
        local waitingForSign = true

        while waitingForSign do
            if IsControlJustReleased(0, 191) then
                local ped = PlayerPedId()
                local coords = GetEntityCoords(ped)
                local heading = GetEntityHeading(ped)

                forSaleSign = {
                    x = coords.x,
                    y = coords.y,
                    z = coords.z,
                    h = heading
                }

                waitingForSign = false
            elseif IsControlJustReleased(0, 177) then
                waitingForSign = false
            end

            Wait(0)
        end

        textui.HideTextUI()

        TriggerServerEvent('tc_housing:server:saveMloConfig', propertyId, {
            doors = doors,
            forSaleSign = forSaleSign
        })

        SetNuiFocus(true, true)
        cb({ success = true })
    end)
end)

RegisterNuiCallback("pickMloDoor", function(_, cb)
    SetNuiFocus(false, false)

    CreateThread(function()
        local lastEntity = 0
        local selectedDoor = nil
        local firstDoorEntity = nil

        SetEntityDrawOutlineColor(0, 255, 0, 255)

        textui.ShowTextUI(
            "Aim at a door and [E] to select the first door.  \nThe selected door will stay highlighted in green until you confirm your choice.  \n[E] another door to link as a double.\n[Q] to accept single door or cancel.")

        local running = true
        local firstDoor = nil
        while running do
            DisablePlayerFiring(cache.playerId, true)
            DisableControlAction(0, 24, true)
            DisableControlAction(0, 25, true)
            DisableControlAction(0, 44, true)
            DisableControlAction(0, 140, true)
            DisableControlAction(0, 141, true)
            DisableControlAction(0, 142, true)
            local hit, entity, hitCoords = lib.raycast.cam(1 | 16)
            local changedEntity = lastEntity ~= entity

            if changedEntity and lastEntity ~= 0 and lastEntity ~= firstDoorEntity then
                SetEntityDrawOutline(lastEntity, false)
            end

            lastEntity = entity

            if hit and entity and entity > 0 and GetEntityType(entity) == 3 then
                if changedEntity then
                    SetEntityDrawOutline(entity, true)
                end

                if IsControlJustReleased(0, 38) then
                    local coords = GetEntityCoords(entity)
                    local heading = GetEntityHeading(entity)
                    local model = GetEntityModel(entity)

                    local doorData = {
                        x = coords.x,
                        y = coords.y,
                        z = coords.z,
                        h = heading,
                        model = model,
                    }

                    if not firstDoor then
                        firstDoor = doorData
                        firstDoorEntity = entity
                        textui.ShowTextUI(
                            "First door selected (it will stay highlighted in green until you confirm your choice).\nAim at the second door and [E] to link, or [Q] to keep single.")
                    else
                        selectedDoor = {
                            doors = {
                                firstDoor,
                                doorData,
                            }
                        }
                        running = false
                    end
                end
            end

            if IsDisabledControlJustPressed(0, 44) then
                if firstDoor and not selectedDoor then
                    selectedDoor = firstDoor
                else
                    selectedDoor = nil
                end
                running = false
            end

            Wait(0)
        end

        if lastEntity ~= 0 and lastEntity ~= firstDoorEntity then
            SetEntityDrawOutline(lastEntity, false)
        end

        if firstDoorEntity and DoesEntityExist(firstDoorEntity) then
            SetEntityDrawOutline(firstDoorEntity, false)
        end

        textui.HideTextUI()
        SetNuiFocus(true, true)

        if selectedDoor then
            cb({ success = true, door = selectedDoor })
        else
            cb({ success = false })
        end
    end)
end)

RegisterNuiCallback("saveMloSettings", function(data, cb)
    local propertyId = data and data.propertyId
    local doors = data and data.doors or {}
    local forSaleSign = data and data.forSaleSign or nil

    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    if not propertyId or type(doors) ~= 'table' or #doors == 0 then
        cb({ success = false, reason = 'invalid_data' })
        return
    end

    TriggerServerEvent('tc_housing:server:saveMloConfig', propertyId, {
        doors = doors,
        forSaleSign = forSaleSign
    })

    cb({ success = true })
end)

RegisterNuiCallback("createProperty", function(data, cb)
    lib.callback('tc_housing:server:createProperty', false, function(result)
        cb(result)
    end, data)
end)

RegisterNuiCallback("updateProperty", function(data, cb)
    lib.callback('tc_housing:server:updateProperty', false, function(result)
        cb(result)
    end, data.id, data)
end)

RegisterNuiCallback("updateUnit", function(data, cb)
    lib.callback('tc_housing:server:updateUnit', false, function(result)
        cb(result)
    end, data.id, data)
end)

RegisterNuiCallback("getAllPlayers", function(_, cb)
    lib.callback('tc_housing:server:getAllPlayers', false, function(result)
        cb(result or {})
    end)
end)

RegisterNuiCallback("getHouseUnitId", function(data, cb)
    local propertyId = data and data.propertyId
    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end
    lib.callback('tc_housing:server:getHouseUnitId', false, function(result)
        cb(result)
    end, propertyId)
end)

RegisterNuiCallback("setUnitOwner", function(data, cb)
    local unitId = data and data.unitId
    local citizenId = data and data.citizenId
    if type(unitId) ~= 'number' then
        unitId = tonumber(unitId)
    end
    lib.callback('tc_housing:server:setUnitOwner', false, function(result)
        cb(result or { success = false })
    end, unitId, citizenId)
end)

RegisterNuiCallback("getMloConfig", function(data, cb)
    local propertyId = data and data.propertyId

    if type(propertyId) ~= 'number' then
        propertyId = tonumber(propertyId)
    end

    lib.callback('tc_housing:server:getMloHouses', false, function(entries)
        if type(entries) == 'table' then
            for _, entry in ipairs(entries) do
                if entry.propertyId == propertyId then
                    cb({
                        doors = entry.mloDoors or {},
                        forSaleSign = entry.mloForSaleSign or nil
                    })
                    return
                end
            end
        end

        lib.callback('tc_housing:server:getMloConfig', false, function(config)
            if not config then
                cb({ doors = {}, forSaleSign = nil })
            else
                cb({
                    doors = config.doors or {},
                    forSaleSign = config.forSaleSign or nil
                })
            end
        end, propertyId)
    end)
end)

RegisterNuiCallback("deleteProperty", function(data, cb)
    local propertyId = data and data.id
    lib.callback('tc_housing:server:deleteProperty', false, function(result)
        cb(result or { success = false })
    end, propertyId)
end)

RegisterNuiCallback("buyApartment", function(data, cb)
    local unitId = data.unitId
    local paymentMethod = data.paymentMethod or 'bank'
    local mode = data.mode or 'buy'

    lib.callback('tc_housing:server:buyApartment', false, function(result)
        cb(result or { success = false })

        if result and result.success and result.complex then
            SendNuiMessage(json.encode({
                type = 'displaying',
                data = {
                    type = 'apartment_complex',
                    complex = result.complex
                }
            }))
        end
    end, unitId, paymentMethod, mode)
end)

RegisterNuiCallback("buyHouse", function(data, cb)
    local unitId = data.unitId
    local paymentMethod = data.paymentMethod or 'bank'
    local mode = data.mode or 'buy'

    lib.callback('tc_housing:server:buyHouse', false, function(result)
        cb(result or { success = false })

        if result and result.success and result.house then
            SendNuiMessage(json.encode({
                type = 'displaying',
                data = {
                    type = 'house_purchase',
                    house = result.house
                }
            }))
        end
    end, unitId, paymentMethod, mode)
end)

RegisterNuiCallback("enterApartment", function(data, cb)
    local unitId = data.unitId

    lib.callback('tc_housing:server:enterApartment', false, function(result)
        cb(result or { success = false })

        if result and result.success then
            SetNuiFocus(false, false)
            SendNuiMessage(json.encode({
                type = 'displaying',
                data = {
                    type = nil
                }
            }))
        end
    end, unitId)
end)

RegisterNuiCallback("enterHouse", function(data, cb)
    local unitId = data.unitId

    lib.callback('tc_housing:server:enterHouse', false, function(result)
        print(json.encode(result))
        cb(result or { success = false })

        if result and result.success then
            SetNuiFocus(false, false)
            SendNuiMessage(json.encode({
                type = 'displaying',
                data = {
                    type = nil
                }
            }))
        end
    end, unitId)
end)

