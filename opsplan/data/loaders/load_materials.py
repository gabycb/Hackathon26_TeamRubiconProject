"""
Seed the materials_lookup reference table with construction material profiles.

This is a static reference table mapping building type + era + region
to typical construction materials and cost factors.

Usage:
  python -m data.loaders.load_materials
"""
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from config.settings import settings


# Reference data: building type × era × region → materials + costs
# Sources: RS Means, Hazus Technical Manual, FEMA P-804
MATERIALS = [
    # Gulf Coast — Single Family Wood Frame
    ("SF_wood", "pre_1950", "gulf_coast", "asphalt_shingle", "wood_frame_2x4", "wood_clapboard", "pier_beam", "single_pane", "none", 85, 110, 140),
    ("SF_wood", "1950_1979", "gulf_coast", "asphalt_shingle", "wood_frame_2x4", "wood_or_vinyl", "slab_on_grade", "single_pane", "fiberglass_r11", 95, 125, 155),
    ("SF_wood", "1980_1999", "gulf_coast", "asphalt_shingle", "wood_frame_2x4", "vinyl_siding", "slab_on_grade", "single_pane", "fiberglass_r13", 105, 135, 170),
    ("SF_wood", "2000_plus", "gulf_coast", "asphalt_shingle", "wood_frame_2x6", "vinyl_or_fiber_cement", "slab_on_grade", "double_pane", "fiberglass_r19", 120, 155, 195),

    # Gulf Coast — Single Family Masonry
    ("SF_masonry", "pre_1950", "gulf_coast", "asphalt_shingle", "cmu_unreinforced", "brick_veneer", "slab_on_grade", "single_pane", "none", 90, 120, 150),
    ("SF_masonry", "1950_1979", "gulf_coast", "asphalt_shingle", "cmu_reinforced", "brick_veneer", "slab_on_grade", "single_pane", "fiberglass_r11", 100, 130, 165),
    ("SF_masonry", "1980_1999", "gulf_coast", "asphalt_shingle", "cmu_reinforced", "brick_veneer", "slab_on_grade", "single_pane", "fiberglass_r13", 110, 145, 180),
    ("SF_masonry", "2000_plus", "gulf_coast", "asphalt_shingle", "cmu_reinforced", "brick_veneer", "slab_on_grade", "double_pane", "fiberglass_r19", 125, 160, 200),

    # Gulf Coast — Manufactured Housing
    ("MFG", "pre_1950", "gulf_coast", "metal", "steel_frame", "metal_panel", "pier_block", "single_pane", "none", 30, 45, 60),
    ("MFG", "1950_1979", "gulf_coast", "metal", "steel_frame", "metal_panel", "pier_block", "single_pane", "fiberglass_r7", 35, 50, 70),
    ("MFG", "1980_1999", "gulf_coast", "asphalt_or_metal", "steel_frame", "vinyl_metal", "pier_block", "single_pane", "fiberglass_r11", 40, 55, 75),
    ("MFG", "2000_plus", "gulf_coast", "asphalt_shingle", "steel_frame", "vinyl_siding", "pier_concrete", "double_pane", "fiberglass_r13", 50, 70, 90),

    # Gulf Coast — Multi Family
    ("MF_wood", "pre_1950", "gulf_coast", "built_up", "wood_frame", "wood_or_brick", "slab_on_grade", "single_pane", "none", 80, 105, 135),
    ("MF_wood", "1950_1979", "gulf_coast", "built_up", "wood_frame", "brick_veneer", "slab_on_grade", "single_pane", "fiberglass_r11", 90, 115, 145),
    ("MF_wood", "1980_1999", "gulf_coast", "built_up", "wood_frame", "stucco_or_vinyl", "slab_on_grade", "single_pane", "fiberglass_r13", 100, 130, 160),
    ("MF_wood", "2000_plus", "gulf_coast", "membrane", "wood_frame", "fiber_cement", "slab_on_grade", "double_pane", "fiberglass_r19", 115, 150, 185),

    # Southeast — Single Family Wood Frame
    ("SF_wood", "pre_1950", "southeast", "asphalt_shingle", "wood_frame_2x4", "wood_clapboard", "crawl_space", "single_pane", "none", 80, 105, 130),
    ("SF_wood", "1950_1979", "southeast", "asphalt_shingle", "wood_frame_2x4", "wood_or_vinyl", "crawl_space", "single_pane", "fiberglass_r11", 90, 118, 145),
    ("SF_wood", "1980_1999", "southeast", "asphalt_shingle", "wood_frame_2x4", "vinyl_siding", "crawl_space", "single_pane", "fiberglass_r13", 100, 130, 160),
    ("SF_wood", "2000_plus", "southeast", "asphalt_shingle", "wood_frame_2x6", "vinyl_or_fiber_cement", "slab_or_crawl", "double_pane", "fiberglass_r19", 115, 148, 185),

    # Northeast — Single Family Wood Frame
    ("SF_wood", "pre_1950", "northeast", "asphalt_shingle", "wood_frame_2x4", "wood_clapboard", "basement", "single_pane", "none", 95, 125, 160),
    ("SF_wood", "1950_1979", "northeast", "asphalt_shingle", "wood_frame_2x4", "wood_or_vinyl", "basement", "single_pane", "fiberglass_r11", 105, 138, 175),
    ("SF_wood", "1980_1999", "northeast", "asphalt_shingle", "wood_frame_2x6", "vinyl_siding", "basement", "double_pane", "fiberglass_r19", 115, 150, 190),
    ("SF_wood", "2000_plus", "northeast", "asphalt_shingle", "wood_frame_2x6", "vinyl_or_fiber_cement", "basement", "double_pane", "spray_foam_r21", 130, 170, 215),

    # Midwest — Single Family Wood Frame
    ("SF_wood", "pre_1950", "midwest", "asphalt_shingle", "wood_frame_2x4", "wood_clapboard", "basement", "single_pane", "none", 85, 112, 140),
    ("SF_wood", "1950_1979", "midwest", "asphalt_shingle", "wood_frame_2x4", "wood_or_aluminum", "basement", "single_pane", "fiberglass_r11", 95, 125, 155),
    ("SF_wood", "1980_1999", "midwest", "asphalt_shingle", "wood_frame_2x6", "vinyl_siding", "basement", "double_pane", "fiberglass_r19", 105, 138, 172),
    ("SF_wood", "2000_plus", "midwest", "asphalt_shingle", "wood_frame_2x6", "vinyl_or_fiber_cement", "basement", "double_pane", "fiberglass_r21", 120, 155, 195),

    # West — Single Family Wood Frame
    ("SF_wood", "pre_1950", "west", "composition_or_tile", "wood_frame_2x4", "stucco", "slab_on_grade", "single_pane", "none", 100, 135, 175),
    ("SF_wood", "1950_1979", "west", "composition", "wood_frame_2x4", "stucco", "slab_on_grade", "single_pane", "fiberglass_r11", 110, 145, 185),
    ("SF_wood", "1980_1999", "west", "composition", "wood_frame_2x4", "stucco", "slab_on_grade", "double_pane", "fiberglass_r13", 125, 162, 205),
    ("SF_wood", "2000_plus", "west", "composition_or_tile", "wood_frame_2x6", "stucco_or_fiber_cement", "slab_on_grade", "double_pane", "fiberglass_r21", 140, 182, 230),
]


def load_materials():
    db_path = settings.database.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🔧 Loading materials reference data...")

    for row in MATERIALS:
        cursor.execute(
            """INSERT OR REPLACE INTO materials_lookup
               (building_type, era, region, roofing, framing, exterior_wall,
                foundation, window_type, insulation,
                cost_per_sqft_low, cost_per_sqft_mid, cost_per_sqft_high)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            row,
        )

    conn.commit()
    conn.close()
    print(f"✅ Materials reference data loaded: {len(MATERIALS)} profiles")


def main():
    load_materials()


if __name__ == "__main__":
    main()
