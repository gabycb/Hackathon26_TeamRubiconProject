"""Geocoding Skill — Resolve locations to FIPS census tract codes."""
import json
import httpx
from semantic_kernel.functions import kernel_function


CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder"


class GeocodingSkill:

    @kernel_function(name="address_to_fips", description="Convert a street address to FIPS census tract code using Census Geocoder.")
    async def address_to_fips(self, address: str) -> str:
        """Returns FIPS state, county, and tract codes for an address."""
        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.get(
                    f"{CENSUS_GEOCODER_URL}/geographies/onelineaddress",
                    params={"address": address, "benchmark": "Public_AR_Current", "vintage": "Current_Current", "format": "json"},
                )
                data = resp.json()
                matches = data.get("result", {}).get("addressMatches", [])
                if not matches:
                    return json.dumps({"error": f"No geocoding match for: {address}"})
                geo = matches[0].get("geographies", {}).get("Census Tracts", [{}])[0]
                return json.dumps({
                    "state_fips": geo.get("STATE", ""),
                    "county_fips": geo.get("COUNTY", ""),
                    "tract": geo.get("TRACT", ""),
                    "fips_tract": geo.get("GEOID", ""),
                    "matched_address": matches[0].get("matchedAddress", ""),
                })
            except Exception as e:
                return json.dumps({"error": f"Geocoding failed: {str(e)}"})

    @kernel_function(name="county_to_tracts", description="Get all census tract FIPS codes for a given county name and state.")
    async def county_to_tracts(self, county_name: str, state_name: str) -> str:
        """Looks up tracts from the local SVI database since all tracts are pre-loaded."""
        from data.db import query as db_query
        rows = await db_query(
            "SELECT DISTINCT fips_tract, county_name FROM svi WHERE county_name LIKE ? AND state_name LIKE ?",
            (f"%{county_name}%", f"%{state_name}%"),
        )
        if not rows:
            return json.dumps({"error": f"No tracts found for {county_name}, {state_name}"})
        return json.dumps({"county": county_name, "state": state_name, "tracts": [r["fips_tract"] for r in rows], "count": len(rows)})
