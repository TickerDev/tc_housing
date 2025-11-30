ShellPreviewBuckets = ShellPreviewBuckets or {}
ShellPreviewBucketSeed = ShellPreviewBucketSeed or 9000

---Assigns a unique routing bucket to a player for shell preview isolation.
---@param source number Player server ID
local function assignShellPreviewBucket(source)
    ShellPreviewBucketSeed = ShellPreviewBucketSeed + 1
    local bucket = ShellPreviewBucketSeed
    ShellPreviewBuckets[source] = bucket
    SetPlayerRoutingBucket(source, bucket)
end

---Clears the shell preview routing bucket for a player, returning them to the default bucket.
---@param source number Player server ID
local function clearShellPreviewBucket(source)
    if not ShellPreviewBuckets[source] then return end
    ShellPreviewBuckets[source] = nil
    SetPlayerRoutingBucket(source, 0)
end

RegisterNetEvent("tc_housing:shellPreview:start", function()
    assignShellPreviewBucket(source)
end)

RegisterNetEvent("tc_housing:shellPreview:stop", function()
    clearShellPreviewBucket(source)
end)

AddEventHandler("playerDropped", function()
    clearShellPreviewBucket(source)
end)

AddEventHandler("onResourceStop", function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for src in pairs(ShellPreviewBuckets) do
        SetPlayerRoutingBucket(src, 0)
    end
    ShellPreviewBuckets = {}
end)

