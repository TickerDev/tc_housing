print('shell')
local bridge = exports.tc_lib:use("bridge")
Shells = Shells or {}
ActiveShellsByPlayer = ActiveShellsByPlayer or {}

local Shell = lib.class("Shell")

---Constructs a new Shell instance and spawns it in a unique routing bucket.
---@param shell string Shell key from Config.Shells
---@param position vector3 Position to spawn the shell entity
---@param initialPlayer number Player server ID to assign to this shell
---@param exitCoords vector3|nil Exit coordinates for when players leave the shell
function Shell:constructor(shell, position, initialPlayer, exitCoords)
    local shellData = Config.Shells[shell]
    self.exitCoords = exitCoords
    CreateThread(function()
        local newRoutingBucket = #Shells + 1
        SetPlayerRoutingBucket(initialPlayer, newRoutingBucket)
        local entity = CreateObject(shellData.hash, position.x, position.y, position.z,
            true, true, true)
        while not DoesEntityExist(entity) do
            print("not entity")
            Wait(0)
        end
        print("Entity " .. entity)
        FreezeEntityPosition(entity, true)
        Config.Weather(initialPlayer, false)
        SetEntityCoords(GetPlayerPed(initialPlayer), shellData.entranceCoords.x, shellData.entranceCoords.y,
            shellData.entranceCoords.z, false, false, false, false)
        SetEntityHeading(GetPlayerPed(initialPlayer), shellData.heading)
        self.entity = entity
        self.players = { initialPlayer }
    end)
end

---Despawns the shell entity and returns all players to the default routing bucket.
function Shell:Despawn()
    if DoesEntityExist(self.entity) then DeleteEntity(self.entity) end

    if self.targets then
        for _, target in ipairs(self.targets) do
        end
    end
    if self.players and #self.players > 0 then
        for _, player in ipairs(self.players) do
            SetPlayerRoutingBucket(player, 0)
            Config.Weather(player, true)

            local exit = self.exitCoords
            if exit then
                SetEntityCoords(GetPlayerPed(player), exit.x, exit.y, exit.z, false, false, false, false)
            else
                SetEntityCoords(GetPlayerPed(player), -1.1705, 0.3511, 71.1505)
            end
        end
    end
    self.entity = nil
    self.players = nil
end

---Adds a player to this shell's player list.
---@param player number Player server ID to add
function Shell:AddPlayer(player) self.players[#self.players + 1] = player end

---Removes a player from this shell's player list.
---@param player number Player server ID to remove
function Shell:RemovePlayer(player)
    for i, p in ipairs(self.players) do
        if p == player then
            table.remove(self.players, i)
            break
        end
    end
end

RegisterCommand("createShell", function(source, args, rawCommand)
    if Config.Debug then
        local shell = Shell:new("Villa Shell", vec3(-100, -100, -100), source)
        Shells[#Shells + 1] = shell
    end
end)


---Creates a new housing shell instance for a player.
---@param shellKey string Shell key from Config.Shells
---@param position vector3|nil Position to spawn the shell (defaults to vec3(-100, -100, -100))
---@param source number Player server ID
---@param exitCoords vector3|nil Exit coordinates for when the player leaves
---@return Shell|nil Shell instance or nil if shell key is invalid
function CreateHousingShell(shellKey, position, source, exitCoords)
    if not Config.Shells[shellKey] then
        print(("[tc_housing] Unknown shell key '%s'"):format(tostring(shellKey)))
        return nil
    end

    position = position or vec3(-100, -100, -100)
    local shell = Shell:new(shellKey, position, source, exitCoords)
    Shells[#Shells + 1] = shell
    ActiveShellsByPlayer[source] = shell
    return shell
end

---Removes a player from their current housing shell and despawns it if empty.
---@param source number Player server ID
function LeaveHousingShell(source)
    local shell = ActiveShellsByPlayer and ActiveShellsByPlayer[source] or nil
    if not shell then return end

    shell:Despawn()
    ActiveShellsByPlayer[source] = nil

    TriggerClientEvent('tc_housing:client:clearApartmentLeaveTarget', source)
end

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for _, shell in pairs(Shells) do shell:Despawn() end
    Shells = {}
end)
