"""
Load CDC/ATSDR Social Vulnerability Index (SVI) 2022 data into SQLite.

Download the CSV from:
  https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html
  → Select "2022" → "United States" → CSV format
  → File: SVI_2022_US.csv (~85MB)

Usage:
  python -m data.loaders.load_svi data/SVI_2022_US.csv
  python -m data.loaders.load_svi data/SVI_2022_US.csv --state 48      # Texas only
  python -m data.loaders.load_svi data/SVI_2022_US.csv --state 48 --counties 007,391  # Aransas + Refugio
"""
import csv
import sqlite3
import sys
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config.settings import settings


# SVI 2022 CSV column → our schema column mapping
# SVI uses -999 for null values
COLUMN_MAP = {
    "FIPS":           "fips_tract",
    "ST":             "state_fips",
    "COUNTY":         "county_fips",       # 3-digit county FIPS within CSV
    "LOCATION":       "county_name",
    "STATE":          "state_name",        # Note: SVI 2022 uses "STATE" for state name
    # Overall SVI
    "RPL_THEMES":     "svi_score",
    # Theme 1: Socioeconomic Status
    "RPL_THEME1":     "t1_percentile",
    "EP_POV150":      "below_poverty_pct",  # 2022 uses 150% poverty level
    "EP_UNEMP":       "unemployed_pct",
    "EP_PCI":         "per_capita_income",
    "EP_NOHSDP":      "no_hs_diploma_pct",
    # Theme 2: Household Characteristics & Disability
    "RPL_THEME2":     "t2_percentile",
    "EP_AGE65":       "age_65_plus_pct",
    "EP_AGE17":       "age_17_minus_pct",
    "EP_DISABL":      "disability_pct",
    "EP_SNGPNT":      "single_parent_pct",
    # Theme 3: Racial & Ethnic Minority Status
    "RPL_THEME3":     "t3_percentile",
    "EP_MINRTY":      "minority_pct",
    "EP_LIMENG":      "limited_english_pct",
    # Theme 4: Housing Type & Transportation
    "RPL_THEME4":     "t4_percentile",
    "EP_MUNIT":       "multi_unit_pct",
    "EP_MOBILE":      "mobile_home_pct",
    "EP_CROWD":       "crowding_pct",
    "EP_NOVEH":       "no_vehicle_pct",
    "EP_GROUPQ":      "group_quarters_pct",
    # Population
    "E_TOTPOP":       "population",
}


def parse_value(val: str) -> float | None:
    """Convert SVI CSV value. Returns None for -999 (null marker)."""
    if val is None or val.strip() == "" or val.strip() == "-999":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def load_svi(csv_path: str, state_filter: str = None, county_filter: list[str] = None):
    """
    Load SVI CSV into SQLite database.

    Args:
        csv_path: Path to SVI_2022_US.csv
        state_filter: Optional 2-digit state FIPS to filter (e.g., '48' for Texas)
        county_filter: Optional list of 3-digit county FIPS codes to filter
    """
    csv_path = Path(csv_path)
    if not csv_path.exists():
        print(f"❌ File not found: {csv_path}")
        print(f"   Download from: https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html")
        sys.exit(1)

    db_path = settings.database.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Read the CSV
    print(f"📖 Reading SVI data from: {csv_path.name}")
    loaded = 0
    skipped = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        # Verify expected columns exist
        missing = [col for col in COLUMN_MAP.keys() if col not in reader.fieldnames]
        if missing:
            # Try alternate column names for 2022
            alt_names = {"STATE": "ST_ABBR", "COUNTY": "STCNTY"}
            for m in missing:
                if m in alt_names and alt_names[m] in reader.fieldnames:
                    COLUMN_MAP[alt_names[m]] = COLUMN_MAP.pop(m)
                else:
                    print(f"⚠️  Column '{m}' not found in CSV. Available: {reader.fieldnames[:20]}...")

        for row in reader:
            # Get FIPS and state for filtering
            fips = row.get("FIPS", "").strip()
            if len(fips) < 11:
                skipped += 1
                continue

            state_fips = fips[:2]
            county_fips = fips[2:5]

            # Apply filters
            if state_filter and state_fips != state_filter:
                skipped += 1
                continue
            if county_filter and county_fips not in county_filter:
                skipped += 1
                continue

            # Map columns
            values = {}
            for csv_col, db_col in COLUMN_MAP.items():
                raw = row.get(csv_col, "").strip()
                if db_col in ("fips_tract", "state_fips", "county_name", "state_name"):
                    values[db_col] = raw if raw and raw != "-999" else None
                elif db_col == "county_fips":
                    # Extract 3-digit county from FIPS
                    values[db_col] = fips[2:5]
                else:
                    values[db_col] = parse_value(raw)

            # Ensure fips_tract is set
            values["fips_tract"] = fips
            values["state_fips"] = state_fips
            values["data_year"] = 2022

            # Skip tracts with no SVI score
            if values.get("svi_score") is None:
                skipped += 1
                continue

            # Insert
            cols = list(values.keys())
            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols)
            cursor.execute(
                f"INSERT OR REPLACE INTO svi ({col_names}) VALUES ({placeholders})",
                [values[c] for c in cols],
            )
            loaded += 1

            if loaded % 10000 == 0:
                print(f"   ... loaded {loaded:,} tracts")
                conn.commit()

    conn.commit()
    conn.close()

    print(f"✅ SVI data loaded: {loaded:,} tracts ({skipped:,} skipped)")
    if state_filter:
        print(f"   Filtered to state FIPS: {state_filter}")
    if county_filter:
        print(f"   Filtered to counties: {', '.join(county_filter)}")


def main():
    parser = argparse.ArgumentParser(description="Load CDC SVI 2022 data into OpsPlan database")
    parser.add_argument("csv_path", help="Path to SVI_2022_US.csv")
    parser.add_argument("--state", help="Filter to 2-digit state FIPS (e.g., 48 for Texas)")
    parser.add_argument("--counties", help="Comma-separated 3-digit county FIPS codes (e.g., 007,391)")
    args = parser.parse_args()

    county_list = args.counties.split(",") if args.counties else None
    load_svi(args.csv_path, state_filter=args.state, county_filter=county_list)


if __name__ == "__main__":
    main()
