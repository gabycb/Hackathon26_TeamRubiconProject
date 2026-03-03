"""
Load Census ACS 5-Year housing and demographic data via Census API.

Requires a free Census API key:
  https://api.census.gov/data/key_signup.html

This loader fetches data from the Census ACS 5-Year API for specific
states and counties, then inserts into the census_housing table.

Usage:
  python -m data.loaders.load_census --state 48 --counties 007,391,057,469,409
  python -m data.loaders.load_census --state 48  # All Texas counties

Tables fetched:
  B25024 - Units in Structure (housing type)
  B25034 - Year Structure Built
  B25003 - Tenure (owner vs renter)
  B25002 - Occupancy Status
  B25077 - Median Home Value
  B25064 - Median Gross Rent
  B25105 - Median Monthly Housing Costs
  B01002 - Median Age
  B19013 - Median Household Income
  B01003 - Total Population
  B25040 - Heating Fuel
  B11001 - Households
"""
import json
import sqlite3
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config.settings import settings

try:
    import httpx
except ImportError:
    print("❌ httpx is required. Run: pip install httpx")
    sys.exit(1)


# Census ACS variable codes we need
# Format: "TABLE_VARIABLE": description
VARIABLES = {
    # Total population (B01003)
    "B01003_001E": "total_population",
    # Total households (B11001)
    "B11001_001E": "total_households",
    # Total housing units (B25002)
    "B25002_001E": "total_housing_units",
    # Units in Structure (B25024)
    "B25024_002E": "sf_detached",        # 1, detached
    "B25024_003E": "sf_attached",        # 1, attached
    "B25024_004E": "units_2to4",         # 2 + 3 or 4
    "B25024_005E": "units_2to4_b",       # (will combine with 004)
    "B25024_006E": "units_5to9",         # 5 to 9
    "B25024_007E": "units_10plus",       # 10 to 19 (will combine with 008, 009)
    "B25024_008E": "units_10plus_b",     # 20 to 49
    "B25024_009E": "units_10plus_c",     # 50 or more
    "B25024_010E": "mobile_home",        # Mobile home
    # Year Built (B25034)
    "B25034_002E": "built_2020_later",   # 2020 or later
    "B25034_003E": "built_2010_2019",
    "B25034_004E": "built_2000_2009",
    "B25034_005E": "built_1990_1999",
    "B25034_006E": "built_1980_1989",
    "B25034_007E": "built_1970_1979",
    "B25034_008E": "built_1960_1969",
    "B25034_009E": "built_1950_1959",
    "B25034_010E": "built_1940_1949",
    "B25034_011E": "built_1939_earlier",
    # Tenure (B25003)
    "B25003_002E": "owner_occupied",
    "B25003_003E": "renter_occupied",
    # Vacancy
    "B25002_003E": "vacant_units",
    # Financial
    "B25077_001E": "median_home_value",
    "B25064_001E": "median_gross_rent",
    "B25105_001E": "median_monthly_housing_cost",
    # Demographics
    "B01002_001E": "median_age",
    "B19013_001E": "median_household_income",
    # Heating fuel (B25040)
    "B25040_002E": "heat_utility_gas",
    "B25040_003E": "heat_electric",      # Actually "bottled, tank, or LP gas" — we'll remap
    "B25040_004E": "heat_propane",       # Electricity
    "B25040_005E": "heat_other",         # Fuel oil + other combined later
}

# Variables that need to be combined after fetching
COMBINE_RULES = {
    "units_2to4": ["B25024_004E", "B25024_005E"],
    "units_10plus": ["B25024_007E", "B25024_008E", "B25024_009E"],
}

# Remap heating fuel to correct assignments
# B25040: 002=Utility gas, 003=Bottled/LP gas, 004=Electricity, 005+=Other
HEAT_REMAP = {
    "heat_utility_gas": "B25040_002E",
    "heat_propane": "B25040_003E",       # Bottled gas = propane
    "heat_electric": "B25040_004E",      # Electricity
    "heat_other": "B25040_005E",         # Fuel oil etc.
}


def fetch_census_data(state_fips: str, county_fips: str = None) -> list[dict]:
    """
    Fetch Census ACS 5-Year data from API.

    Args:
        state_fips: 2-digit state FIPS
        county_fips: 3-digit county FIPS (optional, fetches all counties if None)

    Returns:
        List of dicts, one per census tract
    """
    api_key = settings.census.api_key
    if not api_key:
        print("❌ Census API key not set. Get a free key at:")
        print("   https://api.census.gov/data/key_signup.html")
        print("   Then set CENSUS_API_KEY in config/.env")
        sys.exit(1)

    year = settings.census.acs_year
    base_url = f"{settings.census.base_url}/{year}/{settings.census.acs_dataset}"

    # Build variable list (Census API accepts up to 50 variables per call)
    var_codes = list(set(VARIABLES.keys()))

    # We may need multiple calls if > 50 variables
    chunk_size = 48
    all_data = {}  # fips_tract → {var: value}

    for i in range(0, len(var_codes), chunk_size):
        chunk = var_codes[i:i + chunk_size]
        var_str = ",".join(["NAME"] + chunk)

        geo = f"tract:*&in=state:{state_fips}"
        if county_fips:
            geo += f"&in=county:{county_fips}"

        url = f"{base_url}?get={var_str}&for={geo}&key={api_key}"
        print(f"   Fetching {len(chunk)} variables from Census API...")

        try:
            resp = httpx.get(url, timeout=60.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"❌ Census API error: {e}")
            print(f"   URL: {url[:200]}...")
            return []

        if not data or len(data) < 2:
            print(f"⚠️  No data returned for state {state_fips}, county {county_fips}")
            continue

        headers = data[0]
        for row in data[1:]:
            row_dict = dict(zip(headers, row))
            state = row_dict.get("state", "")
            county = row_dict.get("county", "")
            tract = row_dict.get("tract", "")
            fips_tract = f"{state}{county}{tract}"

            if fips_tract not in all_data:
                all_data[fips_tract] = {
                    "fips_tract": fips_tract,
                    "state_fips": state,
                    "county_fips": county,
                }

            for var_code in chunk:
                val = row_dict.get(var_code)
                if val is not None and val != "" and val != "-666666666":
                    try:
                        all_data[fips_tract][var_code] = float(val)
                    except ValueError:
                        all_data[fips_tract][var_code] = None

    return list(all_data.values())


def process_tract(raw: dict) -> dict:
    """Convert raw Census API response into our schema format."""
    result = {
        "fips_tract": raw["fips_tract"],
        "state_fips": raw["state_fips"],
        "county_fips": raw["county_fips"],
        "acs_year": settings.census.acs_year,
    }

    # Direct mappings
    for var_code, db_col in VARIABLES.items():
        if db_col.endswith("_b") or db_col.endswith("_c"):
            continue  # These get combined
        val = raw.get(var_code)
        if val is not None:
            result[db_col] = int(val) if db_col not in (
                "median_home_value", "median_gross_rent",
                "median_monthly_housing_cost", "median_age",
                "median_household_income"
            ) else val

    # Combine split variables
    for db_col, var_codes in COMBINE_RULES.items():
        total = 0
        for vc in var_codes:
            v = raw.get(vc)
            if v is not None:
                total += int(v)
        result[db_col] = total

    # Fix heating fuel remapping
    result["heat_utility_gas"] = int(raw.get("B25040_002E", 0) or 0)
    result["heat_propane"] = int(raw.get("B25040_003E", 0) or 0)
    result["heat_electric"] = int(raw.get("B25040_004E", 0) or 0)
    result["heat_other"] = int(raw.get("B25040_005E", 0) or 0)

    return result


def load_census(state_fips: str, county_codes: list[str] = None):
    """
    Fetch Census ACS data and load into SQLite.

    Args:
        state_fips: 2-digit state FIPS (e.g., '48' for Texas)
        county_codes: Optional list of 3-digit county FIPS codes.
                     If None, fetches all counties in the state.
    """
    db_path = settings.database.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Zero-pad county codes to 3 digits (Census API requires leading zeros)
    counties = [c.zfill(3) for c in county_codes] if county_codes else [None]
    state_fips = state_fips.zfill(2)
    total_loaded = 0

    for county in counties:
        label = f"state {state_fips}" + (f", county {county}" if county else " (all counties)")
        print(f"📊 Fetching Census ACS data for {label}...")

        tracts = fetch_census_data(state_fips, county)
        if not tracts:
            print(f"   ⚠️  No data returned")
            continue

        loaded = 0
        for raw_tract in tracts:
            processed = process_tract(raw_tract)

            cols = list(processed.keys())
            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols)
            cursor.execute(
                f"INSERT OR REPLACE INTO census_housing ({col_names}) VALUES ({placeholders})",
                [processed.get(c) for c in cols],
            )
            loaded += 1

        conn.commit()
        total_loaded += loaded
        print(f"   ✅ Loaded {loaded} tracts")

    conn.close()
    print(f"\n✅ Census data loaded: {total_loaded:,} total tracts")


def main():
    parser = argparse.ArgumentParser(description="Load Census ACS data into OpsPlan database")
    parser.add_argument("--state", required=True, help="2-digit state FIPS (e.g., 48 for Texas)")
    parser.add_argument("--counties", help="Comma-separated 3-digit county FIPS (e.g., 007,391)")
    args = parser.parse_args()

    county_list = args.counties.split(",") if args.counties else None
    load_census(args.state, county_list)


if __name__ == "__main__":
    main()
