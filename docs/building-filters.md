# Buildings: Location and Site

Location filters geographical areas: postcode-derived districts, counties, regions and countries. Site filters the homebuilder development names. When both are selected, they must match the same development associated with the building type.

Geography lives in `collections/*/locations.json` under `geography`, keyed by the development URL. It is derived from the postcodes.io postcode API; unknown areas are omitted rather than guessed from development names. Run `node scripts/enrich-location-geography.mjs` after refreshing collection location files. The public directory reads these saved fields and makes no geographical API requests.
