fx_version 'cerulean'
game 'gta5'
-- use_experimental_fxv2_oal "yes"
name "TC Housing"
description "Housing System"
author "Ticker"
version "1.0.0"
lua54 "yes"
ui_page 'ui/dist/index.html'

shared_scripts {
    '@ox_lib/init.lua', -- '@lation_ui/init.lua',
    "config.lua", "config_sv.lua", "shared/*.lua"
}
server_scripts {
    'server/*.lua'
}
client_scripts {
    'client/*.lua'
}

dependencies { "ox_lib", "tc_lib" }

files {
    'ui/dist/index.html', 'ui/dist/assets/*.js', 'ui/dist/assets/*.css',
    'ui/dist/assets/*.png', 'ui/dist/assets/*.jpg', 'ui/dist/assets/*.svg',
    'locales/*.json'
}

-- Do not touch!
-- Selling this resource without permission is against the license!
escrow_ignore {
    'config.lua',
    'config_sv.lua',
    'shared/*.lua',
    'server/*.lua',
    'client/*.lua',
}
