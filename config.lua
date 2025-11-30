Config = {}

Config.Locale = "en"
Config.Debug = true
Config.Market = {
    RentFactor = 0.0075, -- Rent per day = House price * RentFactor (recommended for all servers)
    -- optional discount for renting longer periods
    EnableRentDiscounts = true,
    RentDiscounts = {
        [3] = 0.95,  -- 5% off for 3 days
        [7] = 0.90,  -- 10% off for 7 days
        [14] = 0.85, -- 15% off for 14 days
        [30] = 0.80  -- 20% off for 30 days
    },
    -- calculate the rent price for a given price and days
    ---@param price number - the price of the property
    ---@param days number - the number of days to rent the property
    ---@return number - the rent price
    calculateRent = function(price, days)
        local rent = price * Config.Market.RentFactor * days
        if Config.Market.EnableRentDiscounts then
            for d, discount in pairs(Config.Market.RentDiscounts) do
                if days >= d then
                    rent = rent * discount
                    break
                end
            end
        end
        return math.floor(rent)
    end,
    DefaultFactor = 1.0, -- Default multiplier for new properties (1.0 = 100% of base price)
    Fluctuation = {
        Enabled = true,  -- Whether dynamic market prices are enabled
        -- Cron expression for market updates.
        -- Examples:
        -- "0 * * * *"   = Every hour on the hour
        -- "*/30 * * * *" = Every 30 minutes
        -- "0 0 * * *"   = Every day at midnight
        -- "0 */4 * * *" = Every 4 hours
        CronExpression = "0 */4 * * *",
        MinFactor = 0.8,  -- Minimum multiplier (80% of base price)
        MaxFactor = 1.5,  -- Maximum multiplier (150% of base price)
        Volatility = 0.05 -- Maximum change per update (+/- 5%)
    }
}

Config.Shells = {
    -- K4MB1 Starting Shells
    ["Modern Shell"] = {
        hash = `k4mb1_modern_shell`,
        entranceCoords = vector3(-108.1470, -96.2128, -98.4077),
        heading = 274.7926
    },
    ["Apartment Shell"] = {
        hash = `k4mb1_apartment_shell`,
        entranceCoords = vector3(-97.0463, -103.8628, -98.9091),
        heading = 75.3185
    },
    ["Farmhouse Shell"] = {
        hash = `k4mb1_farmhouse_shell`,
        entranceCoords = vector3(-88.6414, -93.4547, -92.7874),
        heading = 185.2660
    },
    ["Frankfurt Apartment Shell"] = {
        hash = `shell_frankaunt`,
        entranceCoords = vector3(-100.3198, -105.8263, -98.6979),
        heading = 5.5851
    },
    ["Michael Shell"] = {
        hash = `shell_michael`,
        entranceCoords = vector3(-109.5801, -94.1293, -98.7812),
        heading = 269.3741
    },
    ["Trevor Shell"] = {
        hash = `shell_trevor`,
        entranceCoords = vector3(-99.8381, -103.8490, -98.7480),
        heading = 4.0796
    },
    ["v16 Mid Shell"] = {
        hash = `shell_v16mid`,
        entranceCoords = vector3(-98.6575, -110.2213, -98.1902),
        heading = 356.9091
    },
    ["Standard Motel Shell"] = {
        hash = `standardmotel_shell`,
        entranceCoords = vector3(-100.4610, -102.5127, -98.7896),
        heading = 280.1483
    },
    -- K4MB1 All Shells Sub Pack
    ["High End Shell"] = {
        hash = `shell_highend`,
        entranceCoords = vector3(-122.3563, -100.5137, -92.6712),
        heading = 278.9793
    },
    ["High End Shell V2"] = {
        hash = `shell_highendv2`,
        entranceCoords = vector3(-122.3563, -100.5137, -92.6712),
        heading = 278.9793
    },
    ["K4 Hotel Shell"] = {
        hash = `k4_hotel1_shell`,
        entranceCoords = vector3(-94.9483, -95.6511, -98.8375),
        heading = 183.3570
    },
    ["K4 Motel Shell"] = {
        hash = `k4_motel1_shell`,
        entranceCoords = vector3(-100.4669, -102.2903, -98.8804),
        heading = 269.1913
    },
    ["Vinewood Housing"] = {
        hash = `vinewood_housing3_k4mb1`,
        entranceCoords = vector3(-96.5418, -92.9798, -98.4485),
        heading = 182.3186
    },
    ["K4 Luxary Housing"] = {
        hash = `luxury_housing1_k4mb1`,
        entranceCoords = vector3(-106.3740, -100.8154, -97.9835),
        heading = 271.7807
    },
    ["Manor Housing"] = {
        hash = `manor_housing1_k4mb1`,
        entranceCoords = vector3(-93.2380, -109.1121, -97.0940),
        heading = 7.2637
    },
    ["Empty House"] = {
        hash = `kambi_emptyhouse1`,
        entranceCoords = vector3(-100.7696, -102.4453, -98.4644),
        heading = 272.7835
    },
    ["Classic House"] = {
        hash = `classichouse_shell`,
        entranceCoords = vector3(-95.2199, -102.1151, -98.7840),
        heading = 90.1283
    },
    ["Beach House"] = {
        hash = `k4mb1_beachhouse2_shell`,
        entranceCoords = vector3(-111.3799, -98.2886, -95.3542),
        heading = 274.3755
    },
    ["Mansion Shell"] = {
        hash = `k4mb1_mansion2_shell`,
        entranceCoords = vector3(-85.0982, -110.4435, -98.0207),
        heading = 10.9007
    },
    ["Villa Shell"] = {
        hash = `k4mb1_villa1_shell`,
        entranceCoords = vector3(-97.3624, -95.9060, -98.6608),
        heading = 177.7652
    }
}
Config.ForSaleSignModel = `prop_forsale_lrg_06`

-- Functions

-- Makes sure the weather is stopped when the player enters a shell, so the shell doesn't get affected by the weather.
---@generic T
---@param player number - the player id
---@param sync boolean - whether to sync the weather
function Config.Weather(player, sync)
    if not IsDuplicityVersion() then return end
    if GetResourceState('Renewed-Weathersync') ~= 'missing' then
        Player(player).state:set('syncWeather', sync, true)
    elseif GetResourceState('qb-weathersync') ~= 'missing' then -- Covers cd_easytime too!
        if sync then
            TriggerClientEvent('qb-weathersync:client:EnableSync', player)
        else
            TriggerClientEvent('qb-weathersync:client:DisableSync', player)
        end
    end
end
