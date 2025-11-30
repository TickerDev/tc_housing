local textui = exports.tc_lib:use("textui")
local apartmentPoints = {}
local currentLeaveZoneName = nil

---Removes all apartment point markers from the world.
local function removeApartmentPoints()
    for _, entry in ipairs(apartmentPoints) do
        if entry.point and entry.point.remove then
            entry.point:remove()
        end
    end
    apartmentPoints = {}
end

---Creates an interactive apartment or house point marker at the specified coordinates.
---@param entry table Entry data with coords, id, name, and type
local function createApartmentPoint(entry)
    if not entry.coords then return end
    local coords = vec3(
        entry.coords.x or 0.0,
        entry.coords.y or 0.0,
        (entry.coords.z or 0.0) - 1.0
    )
    local marker = lib.marker.new({
        coords = coords,
        type = 1,
        width = 1.5,
        height = 1.0,
        color = { r = 53, g = 168, b = 255, a = 220 }
    })

    local point = lib.points.new({
        coords = coords,
        distance = 60.0
    })

    function point:nearby()
        if self.currentDistance <= 30.0 then
            marker:draw()
            if self.currentDistance <= 1.5 then
                if entry.type == 'house' then
                    local label = entry.name or 'House'
                    textui.ShowTextUI(string.format('[E] View House\n%s', label))
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
                        end, entry.id)
                    end
                else
                    local label = entry.name or 'Apartment'
                    textui.ShowTextUI(string.format('[E] Your Apartments  |  [H] Complex Menu\n%s', label))
                    if IsControlJustReleased(0, 38) then
                        lib.callback('tc_housing:server:getMyApartmentsInComplex', false, function(complex)
                            textui.HideTextUI()
                            if not complex then
                                return
                            end
                            SetNuiFocus(true, true)
                            SendNuiMessage(json.encode({
                                type = 'displaying',
                                data = {
                                    type = 'my_apartments',
                                    complex = complex
                                }
                            }))
                        end, entry.id)
                    elseif IsControlJustReleased(0, 74) then
                        textui.HideTextUI()
                        lib.callback('tc_housing:server:getApartmentComplex', false, function(complex)
                            if not complex then
                                return
                            end
                            SetNuiFocus(true, true)
                            SendNuiMessage(json.encode({
                                type = 'displaying',
                                data = {
                                    type = 'apartment_complex',
                                    complex = complex
                                }
                            }))
                        end, entry.id)
                    end
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

    table.insert(apartmentPoints, { point = point })
end

RegisterNetEvent('tc_housing:client:setApartmentPoints', function(entries)
    removeApartmentPoints()
    if type(entries) ~= 'table' then return end
    for _, entry in ipairs(entries) do
        if entry.coords and entry.coords.x and entry.coords.y and entry.coords.z then
            createApartmentPoint(entry)
        end
    end
end)

RegisterNetEvent('tc_housing:client:enteredApartmentShell', function(data)
    local target = exports.tc_lib:use("target")
    if not data or not data.shellKey then return end
    if not Config or not Config.Shells or not Config.Shells[data.shellKey] then return end

    local shellCfg = Config.Shells[data.shellKey]
    if not shellCfg or not shellCfg.entranceCoords then return end

    local coords = shellCfg.entranceCoords
    local name = ('tc_housing_leave_%s'):format(data.shellKey)

    if currentLeaveZoneName then
        target.RemoveZone(currentLeaveZoneName)
        currentLeaveZoneName = nil
    end

    target.AddCircleZone(name, coords, 1.5, {
        name = name,
        debugPoly = false,
        useZ = true,
    }, {
        options = {
            {
                type = 'client',
                event = 'tc_housing:client:leaveApartment',
                icon = 'fas fa-door-open',
                label = 'Leave',
            },
        },
        distance = 2.0,
    })

    currentLeaveZoneName = name
end)

RegisterNetEvent('tc_housing:client:leaveApartment', function()
    TriggerServerEvent('tc_housing:server:leaveApartment')
end)

RegisterNetEvent('tc_housing:client:clearApartmentLeaveTarget', function()
    local target = exports.tc_lib:use("target")
    if currentLeaveZoneName then
        target.RemoveZone(currentLeaveZoneName)
        currentLeaveZoneName = nil
    end
    textui.HideTextUI()
end)

