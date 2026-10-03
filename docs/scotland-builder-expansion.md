# Scotland builder expansion

Process builders sequentially, publishing genuine visual classification of all nonduplicate development and property gallery images. Commit and push each completed builder before proceeding. Downloaded image binaries remain ignored; published catalogue records retain HTTPS source URLs.

## Remaining original list, prioritised for Scotland

| Builder | Source | Progress |
| --- | --- | --- |
| Lovell Homes | https://newhomes.lovell.co.uk/find-your-new-lovell-home/lovell-homes-in-scotland/ | Published 3 Scottish developments, 29 property/development galleries and 192 unique classified images; 135 room/exterior/garden matches. All three sites have verified coordinates and Scottish country metadata. Remaining UK developments are deferred. |
| Dandara | https://www.dandara.com/scotland/ | Published 2 current Scottish developments, 20 property/development galleries, 42 unique classified images and 20 room/exterior matches. Both sites have Scottish country metadata and coordinates. Audited 9 sitemap entries: 6 retired URLs and 1 redirect alias are recorded and excluded. |
| Bancon Homes | https://banconhomes.com/our-developments/ | Published 7 Scottish developments, 76 property/development galleries and 290 unique classified images; 206 room/exterior/garden matches. All sites have coordinates. Coverage gaps explicitly retained: 5 oversized original photos (16 repeated source references) and 1 property URL returning HTTP 404. |
| AJC Homes | https://ajcscotland.com/developments | Published 4 current Scottish developments, 38 property/development galleries, 123 unique classified images and 82 room/exterior/garden matches. All four sites have coordinates; no crawl errors. Current directory used because the XML sitemap lists obsolete developments. |
| Hayhill | https://www.hayhilldevelopments.co.uk/ | Pending |
| Ogilvie Homes | https://ogilviehomes.co.uk/locations/ | Pending |
| Mactaggart & Mickel | https://www.macmic.co.uk/homes-for-sale | Pending |

Maguires Developments remains in the original queue; its current official park listing at https://www.m-d.co.uk/ lists sites in England and Wales, so it is not part of the Scotland priority pass. Other remaining builders without confirmed Scottish developments stay deferred.

## Additional Scottish builders

Current official websites expose Scottish developments; add after the priority builders above.

1. Dawn Homes — https://www.dawn-homes.co.uk/homes-for-sale
2. Cruden Homes — https://www.cruden.co.uk/homes/developments
3. Allanwater Homes — https://allanwaterhomes.co.uk/locations
4. Campion Homes — https://www.campionhomes.com/developments/

## Analysis integrity

Removed the old classification retry fallback that fabricated descriptions from image filenames. Its generated description signature is rejected by analysis provenance checks. API failures leave images pending instead of manufacturing a successful classification.
