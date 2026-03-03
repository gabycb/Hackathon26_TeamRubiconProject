"""
Setup script — Initialize the OpsPlan database and load data.

Usage:
    python scripts/setup_db.py
"""
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from data.db import init_db
from config.settings import settings


def main():
    print("=" * 60)
    print("OpsPlan Database Setup")
    print("=" * 60)

    # Check config
    issues = settings.validate()
    if issues:
        print("\n⚠️  Configuration warnings:")
        for issue in issues:
            print(f"   - {issue}")
        print("\n   You can still initialize the DB, but agents won't work")
        print("   until config/.env is properly filled in.\n")

    # Initialize database
    print(f"📦 Initializing database at: {settings.database.path}")
    init_db()
    print("✅ Database schema created.\n")

    # Data loading instructions
    print("📊 Next: Load data into the database.")
    print("   Download these datasets and run the loaders:\n")

    datasets = [
        {
            "name": "CDC Social Vulnerability Index (SVI 2022)",
            "url": "https://www.atsdr.cdc.gov/place-health/php/svi/svi-data-documentation-download.html",
            "file": "SVI_2022_US.csv (~85MB)",
            "loader": "python -m data.loaders.load_svi data/SVI_2022_US.csv --state 48",
            "note": "Select 2022 → United States → CSV. Use --state 48 for Texas only.",
        },
        {
            "name": "FEMA National Risk Index (NRI)",
            "url": "https://hazards.fema.gov/nri/data-resources",
            "file": "NRI_Table_CensusTracts.csv (~180MB)",
            "loader": "python -m data.loaders.load_nri data/NRI_Table_CensusTracts.csv --state Texas",
            "note": "Download Census Tracts CSV. Use --state Texas to filter.",
        },
        {
            "name": "Census ACS 5-Year (via API — no download needed)",
            "url": "https://api.census.gov/data/key_signup.html",
            "file": "Fetched via Census API (requires free API key in .env)",
            "loader": "python -m data.loaders.load_census --state 48 --counties 007,391,057,469,409",
            "note": "Counties: Aransas(007), Refugio(391), Calhoun(057), Victoria(469), San Patricio(409)",
        },
        {
            "name": "Materials Reference Data (no download needed)",
            "url": "Built-in reference table",
            "file": "Seeded from data/loaders/load_materials.py",
            "loader": "python -m data.loaders.load_materials",
            "note": "Static data — run this first, no external data needed.",
        },
    ]

    for i, ds in enumerate(datasets, 1):
        print(f"   {i}. {ds['name']}")
        print(f"      Source:  {ds['url']}")
        print(f"      File:    {ds['file']}")
        print(f"      Load:    {ds['loader']}")
        if ds.get("note"):
            print(f"      Note:    {ds['note']}")
        print()

    print("=" * 60)
    print("After loading data, test the pipeline:")
    print("   python scripts/validate_harvey.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
