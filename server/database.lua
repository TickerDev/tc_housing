local bridge = exports.tc_lib:use("bridge")
SQL = exports.tc_lib:sql(function(schema)
    schema.model("Property", {
        table = "tc_housing_properties",
        fields = {
            id = schema.field("int", {
                primaryKey = true,
                autoIncrement = true
            }),
            type = schema.field("enum", {
                values = { "house", "apartment" },
                nullable = false
            }),
            label = schema.field("varchar", {
                length = 100,
                nullable = false
            }),
            address = schema.field("varchar", {
                length = 255,
                nullable = true
            }),
            entrance_coords = schema.field("json", {
                nullable = false
            }),
            interior_type = schema.field("varchar", {
                length = 50,
                nullable = false,
                default = "Shell"
            }),
            shell_name = schema.field("varchar", {
                length = 100,
                nullable = true
            }),
            description = schema.field("text", {
                nullable = true
            }),
            created_at = schema.field("timestamp", {
                nullable = false
            })
        }
    })
    schema.model("PropertyUnit", {
        table = "tc_housing_property_units",
        fields = {
            id = schema.field("int", {
                primaryKey = true,
                autoIncrement = true
            }),
            property_id = schema.field("int", {
                nullable = false,
                references = "tc_housing_properties.id",
                onDelete = "CASCADE"
            }),
            unit_name = schema.field("varchar", {
                length = 100,
                nullable = false
            }),
            unit_address = schema.field("varchar", {
                length = 255,
                nullable = true
            }),
            interior_type = schema.field("varchar", {
                length = 50,
                nullable = false,
                default = "Shell"
            }),
            shell_name = schema.field("varchar", {
                length = 100,
                nullable = true
            }),
            description = schema.field("text", {
                nullable = true
            }),
            interior_coords = schema.field("json", {
                nullable = true
            }),
            mlo_doors = schema.field("json", {
                nullable = true
            }),
            mlo_forsale_sign = schema.field("json", {
                nullable = true
            }),
            stash_id = schema.field("varchar", {
                length = 60,
                nullable = true
            }),
            wardrobe_id = schema.field("varchar", {
                length = 60,
                nullable = true
            }),
            garage_id = schema.field("varchar", {
                length = 60,
                nullable = true
            }),
            is_rentable = schema.field("boolean", {
                default = true
            }),
            rent_price = schema.field("int", {
                nullable = true,
                default = nil
            }),
            purchase_price = schema.field("int", {
                nullable = true,
                default = nil
            }),
            base_price = schema.field("int", {
                nullable = false,
                default = 0
            }),
            market_factor = schema.field("decimal", {
                length = "5,4",
                default = 1.0000
            }),
            last_market_update = schema.field("timestamp", {
                nullable = true
            })
        },
        indexes = {
            idx_propertyid = schema.index("property_id")
        }
    })

    schema.model("PropertyOwner", {
        table = "tc_housing_property_owners",
        fields = {
            id = schema.field("int", {
                primaryKey = true,
                autoIncrement = true
            }),
            unit_id = schema.field("int", {
                nullable = false,
                references = "tc_housing_property_units.id",
                onDelete = "CASCADE"
            }),
            owner_identifier = schema.field("varchar", {
                length = 80,
                nullable = false
            }),
            ownership_type = schema.field("enum", {
                values = { "owner", "renter" },
                default = "owner"
            }),
            rent_expires = schema.field("datetime", {
                nullable = true,
                default = nil
            }),
            created_at = schema.field("timestamp", {
                nullable = false
            })
        },
        indexes = {
            idx_unit_owner = schema.index({ "unit_id", "owner_identifier" })
        }
    })

    schema.model("PropertyKey", {
        table = "tc_housing_property_keys",
        fields = {
            id = schema.field("int", {
                primaryKey = true,
                autoIncrement = true
            }),
            unit_id = schema.field("int", {
                nullable = false,
                references = "tc_housing_property_units.id",
                onDelete = "CASCADE"
            }),
            key_holder = schema.field("varchar", {
                length = 80,
                nullable = false
            }),
            given_by = schema.field("varchar", {
                length = 80,
                nullable = true
            }),
            created_at = schema.field("timestamp", {
                nullable = false
            })
        },
        indexes = {
            idx_unit_keys = schema.index({ "unit_id", "key_holder" })
        }
    })
end, { runMigrations = true })

