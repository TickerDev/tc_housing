print('tc_housing commands loaded')

lib.addCommand("houses", { help = "Open the houses menu" }, function(source, args, rawCommand)
    TriggerClientEvent("tc_housing:openHousesMenu", source)
end)

lib.addCommand("leave", { help = "Leave your current housing interior" }, function(source, args, rawCommand)
    LeaveHousingShell(source)
end)

lib.addCommand("testResetTargets", { help = "Reset MLO housing targets (testing only)" },
    function(source, args, rawCommand)
        TriggerClientEvent("tc_housing:client:resetMloTargets", source)
    end)
