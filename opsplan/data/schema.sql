-- OpsPlan Database Schema
-- Stores pre-loaded open-source data for agent skill queries.

-- CDC Social Vulnerability Index (by census tract)
CREATE TABLE IF NOT EXISTS svi (
    fips_tract TEXT PRIMARY KEY,           -- 11-digit FIPS code
    state_fips TEXT NOT NULL,
    county_fips TEXT NOT NULL,
    county_name TEXT,
    state_name TEXT,
    -- Overall SVI
    svi_score REAL,                        -- 0-1 percentile ranking
    -- Theme 1: Socioeconomic Status
    t1_percentile REAL,
    below_poverty_pct REAL,
    unemployed_pct REAL,
    per_capita_income REAL,
    no_hs_diploma_pct REAL,
    -- Theme 2: Household Characteristics & Disability
    t2_percentile REAL,
    age_65_plus_pct REAL,
    age_17_minus_pct REAL,
    disability_pct REAL,
    single_parent_pct REAL,
    -- Theme 3: Racial & Ethnic Minority Status
    t3_percentile REAL,
    minority_pct REAL,
    limited_english_pct REAL,
    -- Theme 4: Housing Type & Transportation
    t4_percentile REAL,
    multi_unit_pct REAL,
    mobile_home_pct REAL,
    crowding_pct REAL,
    no_vehicle_pct REAL,
    group_quarters_pct REAL,
    -- Metadata
    population REAL,
    data_year INTEGER DEFAULT 2022
);

-- FEMA National Risk Index (by county and census tract)
CREATE TABLE IF NOT EXISTS nri (
    fips TEXT PRIMARY KEY,                  -- County (5-digit) or tract (11-digit)
    name TEXT,
    state TEXT,
    -- Overall risk
    risk_score REAL,
    risk_rating TEXT,                       -- Very High, Relatively High, etc.
    expected_annual_loss REAL,              -- Dollars
    social_vulnerability_score REAL,
    community_resilience_score REAL,
    -- Hazard-specific scores (top hazards for disaster response)
    hurricane_risk_score REAL,
    hurricane_eal REAL,
    tornado_risk_score REAL,
    tornado_eal REAL,
    flood_risk_score REAL,
    flood_eal REAL,
    earthquake_risk_score REAL,
    wildfire_risk_score REAL,
    winter_storm_risk_score REAL,
    -- Metadata
    data_year INTEGER DEFAULT 2023
);

-- Census ACS Housing Data (by census tract)
CREATE TABLE IF NOT EXISTS census_housing (
    fips_tract TEXT PRIMARY KEY,
    state_fips TEXT NOT NULL,
    county_fips TEXT NOT NULL,
    -- Population
    total_population INTEGER,
    total_households INTEGER,
    total_housing_units INTEGER,
    -- Housing type (B25024)
    sf_detached INTEGER,
    sf_attached INTEGER,
    units_2to4 INTEGER,
    units_5to9 INTEGER,
    units_10plus INTEGER,
    mobile_home INTEGER,
    -- Year built distribution (B25034)
    built_2020_later INTEGER,
    built_2010_2019 INTEGER,
    built_2000_2009 INTEGER,
    built_1990_1999 INTEGER,
    built_1980_1989 INTEGER,
    built_1970_1979 INTEGER,
    built_1960_1969 INTEGER,
    built_1950_1959 INTEGER,
    built_1940_1949 INTEGER,
    built_1939_earlier INTEGER,
    -- Occupancy
    owner_occupied INTEGER,
    renter_occupied INTEGER,
    vacant_units INTEGER,
    -- Financial (B25077, B25064)
    median_home_value REAL,
    median_gross_rent REAL,
    median_monthly_housing_cost REAL,
    -- Demographics (supplementary)
    median_age REAL,
    median_household_income REAL,
    -- Heating fuel (B25040)
    heat_utility_gas INTEGER,
    heat_electric INTEGER,
    heat_propane INTEGER,
    heat_other INTEGER,
    -- Metadata
    acs_year INTEGER DEFAULT 2022
);

-- Hazus General Building Stock (by census tract)
CREATE TABLE IF NOT EXISTS hazus_gbs (
    fips_tract TEXT PRIMARY KEY,
    -- Building counts by occupancy
    res_single_family INTEGER,
    res_manufactured INTEGER,
    res_multi_family INTEGER,
    commercial INTEGER,
    industrial INTEGER,
    -- Structural characteristics (aggregated)
    stories_1_pct REAL,
    stories_2_pct REAL,
    stories_3plus_pct REAL,
    -- Foundation types
    foundation_slab_pct REAL,
    foundation_crawl_pct REAL,
    foundation_basement_pct REAL,
    foundation_pier_pct REAL,
    -- First floor height
    first_floor_height_avg REAL,           -- feet above grade
    -- Building quality / design level
    pre_code_pct REAL,
    low_code_pct REAL,
    moderate_code_pct REAL,
    high_code_pct REAL,
    -- Square footage
    total_sqft REAL,
    median_sqft_residential REAL,
    -- Replacement value
    building_value_total REAL,
    contents_value_total REAL,
    -- Metadata
    hazus_version TEXT DEFAULT '7.0'
);

-- Hazus Hurricane Model Building Types (by census tract)
CREATE TABLE IF NOT EXISTS hazus_hurricane (
    fips_tract TEXT NOT NULL,
    building_type TEXT NOT NULL,            -- e.g., WSF1 (wood single family 1-story)
    -- Roof
    roof_shape TEXT,                        -- gable, hip, flat
    roof_cover TEXT,                        -- asphalt, metal, tile, built-up
    roof_deck_attachment TEXT,              -- 6d/12, 8d/6, etc.
    roof_wall_connection TEXT,              -- toe-nail, clip, strap
    -- Walls
    exterior_wall_type TEXT,               -- wood, masonry, vinyl, fiber cement
    -- Windows
    window_type TEXT,                       -- single-pane, double-pane, impact
    -- Counts
    structure_count INTEGER,
    PRIMARY KEY (fips_tract, building_type)
);

-- FEMA NFHL Flood Zone (by census tract — aggregated)
CREATE TABLE IF NOT EXISTS flood_zones (
    fips_tract TEXT NOT NULL,
    flood_zone TEXT NOT NULL,               -- VE, AE, AH, AO, A, X500, X
    structure_count_in_zone INTEGER,
    pct_of_tract_structures REAL,
    PRIMARY KEY (fips_tract, flood_zone)
);

-- Materials lookup (reference table)
CREATE TABLE IF NOT EXISTS materials_lookup (
    building_type TEXT NOT NULL,            -- SF_wood, MFG, Multi_concrete, etc.
    era TEXT NOT NULL,                      -- pre_1950, 1950_1979, 1980_1999, 2000_plus
    region TEXT NOT NULL,                   -- gulf_coast, southeast, northeast, etc.
    -- Typical materials
    roofing TEXT,
    framing TEXT,
    exterior_wall TEXT,
    foundation TEXT,
    window_type TEXT,
    insulation TEXT,
    -- Cost factors
    cost_per_sqft_low REAL,
    cost_per_sqft_mid REAL,
    cost_per_sqft_high REAL,
    PRIMARY KEY (building_type, era, region)
);

-- Field assessments (Part 2 — populated during operations)
CREATE TABLE IF NOT EXISTS field_assessments (
    assessment_id TEXT PRIMARY KEY,
    structure_id TEXT,
    fips_tract TEXT NOT NULL,
    -- Photo metadata
    latitude REAL,
    longitude REAL,
    timestamp TEXT,
    bearing REAL,
    photo_count INTEGER,
    -- User tags
    tags_hazards TEXT,                      -- JSON array
    tags_damage TEXT,                       -- JSON array
    tags_situational TEXT,                  -- JSON array
    notes TEXT,
    -- AI classification
    overall_damage_pct REAL,
    damage_classification TEXT,             -- destroyed, major, moderate, minor, none
    damage_by_component TEXT,               -- JSON object
    -- Repair estimate
    estimated_repair_cost REAL,
    materials_required TEXT,                -- JSON array
    -- Metadata
    assessed_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Inbound communications inbox (SMS + Email)
CREATE TABLE IF NOT EXISTS inbound_messages (
    id TEXT PRIMARY KEY,
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
    provider TEXT NOT NULL CHECK (provider IN ('acs', 'graph')),
    provider_event_id TEXT NOT NULL UNIQUE,
    received_at TEXT,
    from_address TEXT,
    to_address TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    attachments_json TEXT,
    raw_payload_json TEXT NOT NULL,
    parse_status TEXT DEFAULT 'raw_only',
    parse_error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_svi_county ON svi(county_fips);
CREATE INDEX IF NOT EXISTS idx_svi_state ON svi(state_fips);
CREATE INDEX IF NOT EXISTS idx_census_county ON census_housing(county_fips);
CREATE INDEX IF NOT EXISTS idx_hazus_tract ON hazus_gbs(fips_tract);
CREATE INDEX IF NOT EXISTS idx_field_tract ON field_assessments(fips_tract);
CREATE INDEX IF NOT EXISTS idx_field_timestamp ON field_assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_inbound_channel ON inbound_messages(channel);
CREATE INDEX IF NOT EXISTS idx_inbound_received_at ON inbound_messages(received_at);
