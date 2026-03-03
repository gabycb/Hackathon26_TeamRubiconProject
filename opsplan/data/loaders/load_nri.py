"""
Load FEMA National Risk Index (NRI) data into SQLite.

Download the CSV from:
  https://hazards.fema.gov/nri/data-resources
  → "Census Tracts" → CSV format
  → File: NRI_Table_CensusTracts.csv (~180MB)
  Also available: NRI_Table_Counties.csv (~5MB) for county-level data

Usage:
  python -m data.loaders.load_nri data/NRI_Table_CensusTracts.csv
  python -m data.loaders.load_nri data/NRI_Table_CensusTracts.csv --state Texas
  python -m data.loaders.load_nri data/NRI_Table_Counties.csv --state Texas
"""
import csv
import sqlite3
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config.settings import settings


# NRI CSV column → our schema column mapping
# NRI uses different prefixes: RISK_ for risk, EAL_ for expected annual loss,
# SOVI_ for social vulnerability, RESL_ for community resilience
# Hazard prefixes: HRCN_ (hurricane), TRND_ (tornado), RFLD_ (riverine flood),
# CFLD_ (coastal flood), ERQK_ (earthquake), WFIR_ (wildfire), WNTW_ (winter weather)
COLUMN_MAP = {
    "NRI_ID":         None,              # We use TRACTFIPS or STCOFIPS as key
    "TRACTFIPS":      "fips",            # 11-digit tract FIPS (tract-level file)
    "STCOFIPS":       "fips",            # 5-digit county FIPS (county-level file)
    "COUNTY":         "name",
    "STATE":          "state",
    # Overall risk
    "RISK_SCORE":     "risk_score",
    "RISK_RATNG":     "risk_rating",
    "EAL_VALT":       "expected_annual_loss",      # Total expected annual loss ($)
    "SOVI_SCORE":     "social_vulnerability_score",
    "RESL_SCORE":     "community_resilience_score",
    # Hurricane
    "HRCN_RISKR":     "hurricane_risk_score",      # Hurricane risk score (relative)
    "HRCN_EALB":      "hurricane_eal",             # Hurricane expected annual loss (building)
    # Tornado
    "TRND_RISKR":     "tornado_risk_score",
    "TRND_EALB":      "tornado_eal",
    # Riverine Flooding
    "RFLD_RISKR":     "flood_risk_score",
    "RFLD_EALB":      "flood_eal",
    # Earthquake
    "ERQK_RISKR":     "earthquake_risk_score",
    # Wildfire
    "WFIR_RISKR":     "wildfire_risk_score",
    # Winter Weather
    "WNTW_RISKR":     "winter_storm_risk_score",
}


def parse_value(val: str) -> float | str | None:
    """Convert NRI CSV value. Returns None for empty or -999."""
    if val is None or val.strip() == "" or val.strip() == "-999" or val.strip() == "-9999":
        return None
    try:
        return float(val)
    except ValueError:
        return val.strip()  # For text fields like risk_rating


def detect_file_type(fieldnames: list[str]) -> str:
    """Detect if this is a tract-level or county-level NRI file."""
    if "TRACTFIPS" in fieldnames:
        return "tract"
    elif "STCOFIPS" in fieldnames:
        return "county"
    else:
        raise ValueError("Cannot determine NRI file type. Expected TRACTFIPS or STCOFIPS column.")


def load_nri(csv_path: str, state_filter: str = None):
    """
    Load NRI CSV into SQLite database.

    Args:
        csv_path: Path to NRI_Table_CensusTracts.csv or NRI_Table_Counties.csv
        state_filter: Optional state name to filter (e.g., 'Texas')
    """
    csv_path = Path(csv_path)
    if not csv_path.exists():
        print(f"❌ File not found: {csv_path}")
        print(f"   Download from: https://hazards.fema.gov/nri/data-resources")
        sys.exit(1)

    db_path = settings.database.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print(f"📖 Reading NRI data from: {csv_path.name}")
    loaded = 0
    skipped = 0

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        file_type = detect_file_type(reader.fieldnames)
        fips_col = "TRACTFIPS" if file_type == "tract" else "STCOFIPS"
        print(f"   Detected file type: {file_type}-level")

        for row in reader:
            # State filter
            state = row.get("STATE", "").strip()
            if state_filter and state.lower() != state_filter.lower():
                skipped += 1
                continue

            fips = row.get(fips_col, "").strip()
            if not fips:
                skipped += 1
                continue

            values = {"fips": fips, "data_year": 2023}

            for csv_col, db_col in COLUMN_MAP.items():
                if db_col is None or csv_col == fips_col:
                    continue
                if csv_col == "TRACTFIPS" or csv_col == "STCOFIPS":
                    continue

                raw = row.get(csv_col, "")
                parsed = parse_value(raw)

                if db_col == "fips":
                    values[db_col] = fips
                elif db_col in ("name", "state", "risk_rating"):
                    values[db_col] = parsed if isinstance(parsed, str) else str(parsed) if parsed else None
                else:
                    values[db_col] = parsed if isinstance(parsed, (int, float)) else None

            # Skip if no risk score
            if values.get("risk_score") is None:
                skipped += 1
                continue

            cols = list(values.keys())
            placeholders = ", ".join(["?"] * len(cols))
            col_names = ", ".join(cols)
            cursor.execute(
                f"INSERT OR REPLACE INTO nri ({col_names}) VALUES ({placeholders})",
                [values[c] for c in cols],
            )
            loaded += 1

            if loaded % 10000 == 0:
                print(f"   ... loaded {loaded:,} records")
                conn.commit()

    conn.commit()
    conn.close()

    print(f"✅ NRI data loaded: {loaded:,} records ({skipped:,} skipped)")
    if state_filter:
        print(f"   Filtered to state: {state_filter}")


def main():
    parser = argparse.ArgumentParser(description="Load FEMA NRI data into OpsPlan database")
    parser.add_argument("csv_path", help="Path to NRI CSV file (tract or county level)")
    parser.add_argument("--state", help="Filter to state name (e.g., Texas)")
    args = parser.parse_args()

    load_nri(args.csv_path, state_filter=args.state)


if __name__ == "__main__":
    main()
