# Bellway: single-development source investigation

Observed 2 October 2026. Sample: https://www.bellway.co.uk/new-homes/scotland-west/dargavel-village

Two HTTP requests were made: robots.txt and this development HTML. No house-detail pages, images, or estate-wide discovery were requested. The sample is a snapshot, not a guarantee of current stock.

## Deterministic sources

The page uses Alpine and Laravel Livewire. It contains sufficient structured plot data to begin extraction without rendering a browser. No public JSON API was established in this investigation; browser network behaviour remains to be inspected before selecting an API for broader discovery. Do not guess endpoints or execute page JavaScript to parse the data.

| Field | Observed source |
| --- | --- |
| Development name and URL | JSON-LD `@graph`, `Place` |
| Location and postcode | `Place.address` |
| Plot ID | `#siteplan[x-data="developmentSiteplan"]` decoded `x-init` JSON, `id` |
| House-style ID and name | Same object: `houseStyleId`, `houseStyleName` |
| Property URL | Development path plus `houseStyleSlug` |
| Plot number | `number` |
| Price | `price`, currency string; exact plot price, not development range |
| Detached/property type | `unitType`; exact comparison avoids treating semi-detached as detached |
| Availability | `available` |
| Bedrooms | Linked house-style card `.result-description`; unknown stays null |
| Gallery | Not yet established; card images are exterior thumbnails, not an interior gallery |

The decoded `x-init` starts with `init('the-burgess', { ...plot groups... }, [ ...siteplans... ], '/new-homes/...')`. A balanced JSON scanner extracts the plot groups without evaluating JavaScript. Each group contains an array of plots. Schema validation fails visibly on incompatible data.

The fixture retains a minimal JSON-LD Place, siteplan initialization, and simplified observed house-style cards. It removes third-party scripts, session/CSRF data, and unrelated marketing content. The sample contains three plots across two house-style identifiers: Burgess plots 245 and 242, and Sunningdale plot 201. The Sunningdale was listed at £539,995 with five bedrooms and Detached unit type.

## Limits and next steps

- No development-list API or pagination has been verified. A sitemap is advertised by robots.txt but was not fetched.
- robots.txt disallows `/new-homes/results*` and `/your-nest/search-results*`. Avoid these search routes.
- Several plots share a house-style URL; URL alone must not be the listing natural key.
- The scope/stability of house-style UUIDs across developments is not yet known. Preserve them rather than merge house types solely by name.
- Siteplan data may omit sold/reserved/off-market plots. Do not infer completeness or mark unseen listings unavailable.
- Empty JSON-LD aggregate prices are not reliable price sources.
- Browser network inspection, individual house details, gallery extraction and known gallery reuse evidence remain for the next increment.

## First-run additions

The public `https://www.bellway.co.uk/developments-sitemap.xml` contained 252 canonical development URLs in the first-run snapshot. Discovery uses that sitemap, not restricted results/search routes. House-style cards supplement plot data, including advertised designs with no exposed available plot. Bedroom counts are taken from card descriptions or explicit `N-bedroom` house URL slugs; unknown values remain unknown.

On the Sunningdale house page, `.multi-image-carousel` contains an Alpine `multiImageCarousel({ images: JSON.parse('...') })` attribute. Its escaped JSON image list has 20 ordered URLs on `cms.bellway.co.uk`. Two JSON decoding steps recover the list without evaluating code. Other page images, customer stories and floorplan sections are excluded. Gallery markup does not consistently expose alt/caption metadata, so those fields may remain absent.

Some developments lack parseable structured plot data (for example empty or coming-soon pages). Their advertised house-style cards are retained and the report shows coverage warnings. No sold/hidden stock is inferred. The full run is limited to development URLs exposed by this public sitemap; unlisted sites cannot be claimed as covered.
