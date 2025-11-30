local textui = exports.tc_lib:use("textui")
local shellPreviewOrigin = vector3(-100.0, -100.0, -100.0)
local shellPreviewDistance = 12.0
local shellPreviewHeading = 90.0
local isPreviewingShell = false
local shellPreviewBucketActive = false
local previewShellBaseCoords = nil
local previewShellBaseHeading = 0.0
local previewShellRotation = 0.0
local previewShellOffset = vector3(0.0, 0.0, 0.0)
local shellMoveSpeed = 6.0
local shellRotationSpeed = 45.0
local previewContext = nil
local stateKeyOrigin = 'tc_shellPreviewOrigin'
local stateKeyNet = 'tc_shellPreviewNet'

---Builds a sorted list of all available shell configurations.
---@return table Array of shell entries with name and data
local function buildShellList()
    local list = {}
    if Config and Config.Shells then
        for name, data in pairs(Config.Shells) do
            list[#list + 1] = {
                name = name,
                data = data
            }
        end
    end

    table.sort(list, function(a, b)
        return a.name < b.name
    end)

    return list
end

---Updates the shell preview text UI with the current shell name.
---@param shellName string Name of the shell being previewed
local function updateShellPreviewText(shellName)
    textui.ShowTextUI(("[Shell Preview]\n%s\n← / → to cycle\nENTER to select, BACKSPACE to cancel"):format(shellName))
end

---Cleans up shell preview state, restoring player position and removing preview entity.
---@param opts table|nil Options table with optional restoreFocus boolean
local function cleanupShellPreview(opts)
    opts = opts or {}
    local ctx = previewContext
    local playerPed = (ctx and ctx.playerPed) or PlayerPedId()
    local state = LocalPlayer and LocalPlayer.state or nil
    local storedOrigin = state and state[stateKeyOrigin]
    local storedNet = state and state[stateKeyNet]

    if ctx and ctx.previewEntity and DoesEntityExist(ctx.previewEntity) then
        ResetEntityAlpha(ctx.previewEntity)
        DeleteEntity(ctx.previewEntity)
    elseif storedNet then
        local entity = NetworkGetEntityFromNetworkId(storedNet)
        if entity and DoesEntityExist(entity) then
            ResetEntityAlpha(entity)
            DeleteEntity(entity)
        end
    end

    textui.HideTextUI()
    FreezeEntityPosition(playerPed, false)

    local originCoords = ctx and ctx.originalCoords or (storedOrigin and storedOrigin.coords)
    if originCoords then
        SetEntityCoords(playerPed, originCoords.x, originCoords.y, originCoords.z, false, false, false, false)
    end

    local originHeading = ctx and ctx.originalHeading or (storedOrigin and storedOrigin.heading)
    if originHeading then
        SetEntityHeading(playerPed, originHeading)
    end

    local originVisibility = ctx and ctx.originalVisibility
        or (storedOrigin and storedOrigin.visibility)
    if originVisibility ~= nil then
        SetEntityVisible(playerPed, originVisibility, false)
    else
        SetEntityVisible(playerPed, true, false)
    end
    SetEntityCollision(playerPed, true, true)

    local originRagdoll = ctx and ctx.originalRagdoll
    if originRagdoll ~= nil then
        SetPedCanRagdoll(playerPed, originRagdoll)
    else
        SetPedCanRagdoll(playerPed, true)
    end

    previewShellBaseCoords = nil
    previewShellBaseHeading = 0.0
    previewShellRotation = 0.0
    previewShellOffset = vector3(0.0, 0.0, 0.0)
    previewContext = nil
    isPreviewingShell = false

    if shellPreviewBucketActive then
        TriggerServerEvent('tc_housing:server:shellPreview:stop')
        shellPreviewBucketActive = false
    end

    if state then
        state:set(stateKeyOrigin, nil, false)
        state:set(stateKeyNet, nil, false)
    end

    if opts.restoreFocus ~= false then
        SetNuiFocus(true, true)
    end
end

---Applies position and rotation transforms to the shell preview entity.
---@param previewEntity number Entity handle of the preview shell
local function applyShellTransform(previewEntity)
    if previewEntity == 0 or not previewShellBaseCoords then return end

    local targetCoords = vector3(
        previewShellBaseCoords.x + previewShellOffset.x,
        previewShellBaseCoords.y + previewShellOffset.y,
        previewShellBaseCoords.z + previewShellOffset.z
    )

    SetEntityCoordsNoOffset(previewEntity, targetCoords.x, targetCoords.y, targetCoords.z, false, false, false)
    SetEntityHeading(previewEntity, previewShellBaseHeading + previewShellRotation)
end

---Handles player input for adjusting shell preview position and rotation.
---@param previewEntity number Entity handle of the preview shell
local function handleShellAdjustment(previewEntity)
    if previewEntity == 0 then return end

    local dt = GetFrameTime()
    local moveDir = vector3(0.0, 0.0, 0.0)
    local camRot = GetGameplayCamRot(2)
    local camHeading = math.rad(camRot.z)

    local forward = vector3(-math.sin(camHeading), math.cos(camHeading), 0.0)
    local up = vector3(0.0, 0.0, 1.0)

    if IsDisabledControlPressed(0, 34) then
        previewShellRotation = previewShellRotation - shellRotationSpeed * dt
    end
    if IsDisabledControlPressed(0, 35) then
        previewShellRotation = previewShellRotation + shellRotationSpeed * dt
    end

    if previewShellRotation > 360.0 or previewShellRotation < -360.0 then
        previewShellRotation = previewShellRotation % 360.0
    end

    if IsDisabledControlPressed(0, 32) then
        moveDir = moveDir + forward
    end
    if IsDisabledControlPressed(0, 33) then
        moveDir = moveDir - forward
    end
    if IsDisabledControlPressed(0, 44) then
        moveDir = moveDir + up
    end
    if IsDisabledControlPressed(0, 38) then
        moveDir = moveDir - up
    end

    local magnitude = #(moveDir)
    if magnitude > 0.0 then
        moveDir = moveDir / magnitude
        previewShellOffset = previewShellOffset + (moveDir * shellMoveSpeed * dt)
    end

    if magnitude > 0.0 or IsDisabledControlPressed(0, 34) or IsDisabledControlPressed(0, 35) then
        applyShellTransform(previewEntity)
    end
end

---Disables player movement controls during shell preview.
local function disablePlayerMovementControls()
    local controls = { 30, 31, 32, 33, 34, 35, 21, 36, 22, 44, 38 }
    for i = 1, #controls do
        DisableControlAction(0, controls[i], true)
    end
end

RegisterNuiCallback("startShellSelection", function(_, cb)
    if isPreviewingShell then
        cb({ success = false, reason = "busy" })
        return
    end

    local shells = buildShellList()
    if #shells == 0 then
        cb({ success = false, reason = "no_shells" })
        return
    end

    isPreviewingShell = true
    TriggerServerEvent('tc_housing:server:shellPreview:start')
    shellPreviewBucketActive = true
    SetNuiFocus(false, false)

    local playerPed = PlayerPedId()
    local originalCoords = GetEntityCoords(playerPed)
    local originalHeading = GetEntityHeading(playerPed)
    local originalVisibility = IsEntityVisible(playerPed)
    local originalRagdoll = CanPedRagdoll(playerPed)

    previewContext = {
        playerPed = playerPed,
        originalCoords = originalCoords,
        originalHeading = originalHeading,
        originalVisibility = originalVisibility,
        originalRagdoll = originalRagdoll,
        previewEntity = 0,
        previewNetId = 0
    }
    if LocalPlayer and LocalPlayer.state then
        LocalPlayer.state:set(stateKeyOrigin, {
            coords = { x = originalCoords.x, y = originalCoords.y, z = originalCoords.z },
            heading = originalHeading,
            visibility = originalVisibility
        }, false)
        LocalPlayer.state:set(stateKeyNet, nil, false)
    end

    FreezeEntityPosition(playerPed, true)
    SetEntityCoordsNoOffset(playerPed, shellPreviewOrigin.x, shellPreviewOrigin.y, shellPreviewOrigin.z + 1.0, false,
        false, false)
    SetEntityHeading(playerPed, shellPreviewHeading)
    RequestCollisionAtCoord(shellPreviewOrigin.x, shellPreviewOrigin.y, shellPreviewOrigin.z)
    SetEntityCollision(playerPed, false, false)
    SetPedCanRagdoll(playerPed, false)
    SetEntityVisible(playerPed, false, false)

    local currentIndex = 1
    local previewEntity = 0
    local function spawnShell(index)
        if DoesEntityExist(previewEntity) then
            ResetEntityAlpha(previewEntity)
            DeleteEntity(previewEntity)
            previewEntity = 0
            if previewContext then
                previewContext.previewEntity = 0
            end
        end

        local entry = shells[index]
        if not entry or not entry.data then return end
        updateShellPreviewText(entry.name)
        local model = entry.data.hash or entry.data.model
        if not model then return end

        if type(model) == "string" then
            model = joaat(model)
        end

        if not HasModelLoaded(model) then
            RequestModel(model)
            local timeout = GetGameTimer() + 10000
            while not HasModelLoaded(model) and GetGameTimer() < timeout do
                Wait(0)
            end
        end

        if not HasModelLoaded(model) then return end

        local pedCoords = GetEntityCoords(playerPed)
        local pedForward = GetEntityForwardVector(playerPed)
        local spawnCoords = vector3(
            pedCoords.x + pedForward.x * shellPreviewDistance,
            pedCoords.y + pedForward.y * shellPreviewDistance,
            pedCoords.z + pedForward.z * shellPreviewDistance
        )
        previewEntity = CreateObject(model, spawnCoords.x, spawnCoords.y, spawnCoords.z, false, false, false)
        local baseHeading = entry.data.heading or 0.0
        SetEntityHeading(previewEntity, baseHeading)
        FreezeEntityPosition(previewEntity, true)
        SetEntityAlpha(previewEntity, 250, false)
        SetEntityAsMissionEntity(previewEntity, true, true)
        SetEntityNoCollisionEntity(playerPed, previewEntity, true)
        SetEntityNoCollisionEntity(previewEntity, playerPed, true)
        SetModelAsNoLongerNeeded(model)

        previewShellBaseCoords = spawnCoords
        previewShellBaseHeading = baseHeading
        previewShellRotation = 0.0
        previewShellOffset = vector3(0.0, 0.0, 0.0)
        previewContext.previewEntity = previewEntity
        local netId = NetworkGetNetworkIdFromEntity(previewEntity)
        previewContext.previewNetId = netId
        if LocalPlayer and LocalPlayer.state then
            LocalPlayer.state:set(stateKeyNet, netId, false)
        end
        applyShellTransform(previewEntity)
    end

    spawnShell(currentIndex)

    CreateThread(function()
        local chosenShell = nil
        local running = true

        while running do
            disablePlayerMovementControls()
            if IsControlJustReleased(0, 174) then
                currentIndex = currentIndex - 1
                if currentIndex < 1 then currentIndex = #shells end
                spawnShell(currentIndex)
            elseif IsControlJustReleased(0, 175) then
                currentIndex = currentIndex + 1
                if currentIndex > #shells then currentIndex = 1 end
                spawnShell(currentIndex)
            elseif IsControlJustReleased(0, 191) then
                chosenShell = shells[currentIndex].name
                running = false
            elseif IsControlJustReleased(0, 177) or IsControlJustReleased(0, 322) then
                running = false
            end

            handleShellAdjustment(previewEntity)

            Wait(0)
        end

        cleanupShellPreview()

        if chosenShell then
            cb({ success = true, shellName = chosenShell })
        else
            cb({ success = false })
        end
    end)
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    local state = LocalPlayer and LocalPlayer.state or nil
    if state and (state[stateKeyOrigin] or state[stateKeyNet]) then
        cleanupShellPreview({ restoreFocus = false })
    end
end)

