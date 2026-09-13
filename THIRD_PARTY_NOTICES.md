# Third-party notices

## OpenStreetMap coordinates

© OpenStreetMap contributors. All 81 roastery coordinates were obtained through Nominatim, according to the project owner's source record. The OSM-derived coordinate database in `dist/data/catalog.json` is made available under the [Open Database Licence 1.0](https://opendatacommons.org/licenses/odbl/1-0/). See [OpenStreetMap copyright and attribution](https://www.openstreetmap.org/copyright). Keep the visible map credit and this notice when redistributing it.

## County shapes

The 21 county shapes come from [okfse/sweden-geojson](https://github.com/okfse/sweden-geojson), `swedish_regions.geojson`. Checked 13 September 2026: the repository has **no formal LICENSE file or named licence**; its README says “Feel free to reuse.” It describes simplification with Mapshaper. The app stores converted SVG paths in `dist/data/catalog.json`.

Its linked [upstream repository](https://github.com/jnordgren/swedish_data_map_geojson) attributes council data to OpenStreetMap under ODbL and province data to Natural Earth. [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/) describe its data as public domain. The precise chain for the regional file needs clarification; this project does not claim that okfse's output is MIT-licensed or CC0. Retain these source notices and seek clarification before relying on a specific shape licence for redistribution.

Machine-readable provenance is shipped in `dist/data/map-attribution.json`.

## Roastery images and names

All 80 included photographs or roastery images were supplied by the project owner. Permission for public reuse has not been obtained; their inclusion does not grant a licence to others. They are excluded from the application code's MIT licence. Names, logos and trademarks remain associated with their respective owners. A hobby-project statement does not grant image rights. See `docs/ASSETS.md` for asset records.

Not affiliated with or endorsed by the roasteries listed.
