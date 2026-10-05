# Development town and country

Development properties are stored by builder slug and canonical development URL in `collections/development-places.json`.

A development-specific postal locality from the builder's structured address is preferred. Otherwise, its coordinates are matched to the nearest named UK settlement in GeoNames cities1000. Known constituent countries restrict matching across borders. Missing coordinates are extracted from cached or live development pages; advertised postcodes are resolved through Postcodes.io. Unresolved entries are marked `needs_location_review`, never assigned a guessed place.

GeoNames cities1000 and admin1CodesASCII were retrieved on 5 October 2026 from https://download.geonames.org/export/dump/. GeoNames data is licensed under Creative Commons Attribution 4.0. Data has been filtered to UK records and matched to development coordinates. Website attribution links appear in the footer.

Run `npx tsx src/cli/development-places.ts` for all configured builders, or add `--builder <slug>`. Existing resolved properties are retained. The GeoNames settlement cache is `results/.cache/uk-towns.json`.
