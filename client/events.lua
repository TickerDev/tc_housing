RegisterNetEvent("tc_housing:openHousesMenu", function()
    SetNuiFocus(true, true)

    lib.callback('tc_housing:server:loadProperties', false, function(properties)
        SendNuiMessage(json.encode({
            type = 'displaying',
            data = {
                type = 'houses',
                houses = properties or {}
            }
        }))
    end)
end)

