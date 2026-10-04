# Directory filters

Categorical filters use checkbox menus. Selecting several values matches any of those values within a filter; different filters must all match. Options are calculated from the other active filters, and lists with more than six options include option search. Selected options that no longer match remain visible so users can remove them. Sorting and numeric distance/price limits remain single-value controls.

Multiple selections are stored as JSON arrays in URL parameters. Existing single-value URLs are supported. Property and geography filters must refer to the same advertised home/development.

Region metadata is stored in `collections/location-geography.json`, keyed by builder and development URL. Run `npm run locations:geography` after updating collection location data. This resolves public development postcodes through Postcodes.io, using a nearby postcode for coordinates without a usable postcode. Records without either remain Unknown. Cached entries are only used while their source postcode and coordinates match the location record.

English regions use the postcode's region field; Scotland, Wales and Northern Ireland use the country when region is unavailable. Geography is loaded locally when rendering pages, without live external lookups in page requests.

Source: https://postcodes.io/docs/api/lookup-postcode/
