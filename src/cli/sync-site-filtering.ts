import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { createDatabase } from '../database/postgres.js';
import { builderSite } from '../adapters/sites.js';
import { sha256 } from '../galleries/image-hasher.js';
import { propertyStyle } from '../web/site-filters.js';
import { RequestClient, mapLimit } from '../crawler/request-client.js';

const fullPostcodePattern = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

function cleanPostcode(pc: string): string {
  const clean = pc.toUpperCase().trim().replace(/\s+/g, ' ');
  if (!clean.includes(' ') && clean.length > 3) {
    return clean.slice(0, -3) + ' ' + clean.slice(-3);
  }
  return clean;
}

function extractLocationFromHtml(html: string, url: string) {
  const $ = cheerio.load(html);
  const nodes: any[] = [];
  function walk(value: any) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    nodes.push(value);
    Object.values(value).forEach(walk);
  }

  $('script[type="application/ld+json"]').each((_, e) => {
    try {
      walk(JSON.parse($(e).text()));
    } catch {}
  });

  let latitude: number | undefined;
  let longitude: number | undefined;
  let postcode: string | undefined;
  let locationText: string | undefined;

  // 1. JSON-LD Place / Business with geo
  const place = nodes.find(
    (n) => n.geo && (n.address || n.geo.latitude) && !JSON.stringify(n['@type'] ?? '').includes('Organization')
  );
  if (place?.geo) {
    const lat = Number(place.geo.latitude);
    const lon = Number(place.geo.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= 49 && lat <= 61 && lon >= -9 && lon <= 3) {
      latitude = lat;
      longitude = lon;
    }
  }
  if (place?.address?.postalCode) {
    postcode = cleanPostcode(String(place.address.postalCode));
  }
  if (place?.address?.addressLocality) {
    locationText = String(place.address.addressLocality).trim();
  }

  // 2. Google Maps iframe
  if (!latitude || !longitude) {
    for (const iframe of $('iframe[src]').toArray()) {
      try {
        const src = $(iframe).attr('src');
        if (!src) continue;
        const map = new URL(src);
        if (!['www.google.com', 'maps.google.com'].includes(map.hostname)) continue;
        const q = map.searchParams.get('center') ?? map.searchParams.get('q');
        const parts = q?.split(',').map(Number);
        if (
          parts?.length === 2 &&
          parts[0]! >= 49 &&
          parts[0]! <= 61 &&
          parts[1]! >= -9 &&
          parts[1]! <= 3
        ) {
          latitude = parts[0]!;
          longitude = parts[1]!;
          break;
        }
      } catch {}
    }
  }

  // 3. Address in ld+json without geo
  if (!postcode) {
    const addr = nodes.find((n) => n.address?.postalCode);
    if (addr?.address?.postalCode) {
      postcode = cleanPostcode(String(addr.address.postalCode));
      if (!locationText && addr.address.addressLocality) {
        locationText = String(addr.address.addressLocality).trim();
      }
    }
  }

  // 4. Custom JSON in script tags (e.g. hgpSearch)
  if (!postcode) {
    for (const e of $('script[type="application/json"]').toArray()) {
      try {
        const json = JSON.parse($(e).text());
        const dev = json.hgpSearch?.developments?.find(
          (d: any) => new URL(d.url, url).pathname === new URL(url).pathname
        );
        if (dev?.postcode) {
          postcode = cleanPostcode(String(dev.postcode));
          if (!latitude && dev.latitude) latitude = Number(dev.latitude);
          if (!longitude && dev.longitude) longitude = Number(dev.longitude);
          break;
        }
      } catch {}
    }
  }

  // 5. Body / main text postcode match
  if (!postcode) {
    const bodyClone = $('body').clone();
    bodyClone.find('header,footer,nav,script,style').remove();
    const match = (bodyClone.find('main').text() || bodyClone.text()).match(fullPostcodePattern);
    if (match?.[1]) {
      postcode = cleanPostcode(match[1]);
    }
  }

  return { latitude, longitude, postcode, locationText };
}

function inferCountry(text: string): string | null {
  const t = text.toLowerCase();
  if (/scotland|edinburgh|glasgow|falkirk|fife|inverness|aberdeen|dundee|perth|stirling|lanark|renfrew|ayrshire|lothian/.test(t)) {
    return 'Scotland';
  }
  if (/wales|cardiff|swansea|newport|wrexham|conwy|gwent|glamorgan|powys/.test(t)) {
    return 'Wales';
  }
  if (/northern ireland|belfast|derry|antrim|armagh|down|fermanagh|tyrone/.test(t)) {
    return 'Northern Ireland';
  }
  if (/england|london|manchester|birmingham|leeds|bristol|newcastle|sheffield|liverpool|nottingham|leicester|oxford|cambridge|hampshire|surrey|kent|essex|sussex|devon|cornwall|somerset|yorkshire|cheshire|lancashire|durham|norfolk|suffolk/.test(t)) {
    return 'England';
  }
  return null;
}

async function main() {
  console.log('Starting site filtering data lookup and Supabase synchronization...');
  const sql = createDatabase();
  const client = new RequestClient({ delay: 200, retries: 2, timeout: 12000, maxRequests: 500 });

  try {
    // 1. Fetch all developments and builders from Supabase
    const developments = await sql<
      {
        id: string;
        builder_id: string;
        name: string;
        url: string;
        location_text: string | null;
        postcode: string | null;
        latitude: number | null;
        longitude: number | null;
        country: string | null;
        builder_slug: string;
        builder_name: string;
      }[]
    >`
      select
        d.id,
        d.builder_id,
        d.name,
        d.url,
        d.location_text,
        d.postcode,
        d.latitude,
        d.longitude,
        d.country,
        b.slug as builder_slug,
        b.name as builder_name
      from developments d
      join builders b on b.id = d.builder_id
      order by b.name, d.name
    `;

    console.log(`Loaded ${developments.length} developments across all builders from Supabase.`);

    // 2. Load existing locations from collections
    const knownLocations = new Map<string, { latitude?: number; longitude?: number; postcode?: string }>();
    try {
      const folders = await readdir('collections');
      for (const f of folders) {
        try {
          const locs = JSON.parse(await readFile(`collections/${f}/locations.json`, 'utf8'));
          for (const loc of locs) {
            if (loc.url) knownLocations.set(loc.url, loc);
          }
        } catch {}
      }
    } catch {}

    // 3. Extract locations from cached HTML & known locations
    const devLocations = new Map<
      string,
      {
        postcode?: string;
        latitude?: number;
        longitude?: number;
        locationText?: string;
        country?: string;
      }
    >();

    const missingLocationDevs: (typeof developments)[number][] = [];

    for (const dev of developments) {
      const known = knownLocations.get(dev.url);
      let pc = known?.postcode ? cleanPostcode(known.postcode) : (dev.postcode ? cleanPostcode(dev.postcode) : undefined);
      let lat = known?.latitude ?? (dev.latitude ?? undefined);
      let lon = known?.longitude ?? (dev.longitude ?? undefined);
      let locText = dev.location_text ?? undefined;
      let country = dev.country ?? undefined;

      try {
        const html = await readFile(`results/.cache/pages/${sha256(dev.url)}.html`, 'utf8');
        const ext = extractLocationFromHtml(html, dev.url);
        if (!pc && ext.postcode) pc = ext.postcode;
        if (!lat && ext.latitude) lat = ext.latitude;
        if (!lon && ext.longitude) lon = ext.longitude;
        if (!locText && ext.locationText) locText = ext.locationText;
      } catch {}

      if (pc || (lat && lon)) {
        devLocations.set(dev.id, { postcode: pc, latitude: lat, longitude: lon, locationText: locText, country });
      } else {
        missingLocationDevs.push(dev);
      }
    }

    console.log(
      `Direct extracted locations: ${devLocations.size} / ${developments.length}. Missing locations to fetch live: ${missingLocationDevs.length}.`
    );

    // 4. Live fetch for missing locations (e.g. DWH / Crest)
    if (missingLocationDevs.length > 0) {
      console.log(`Fetching live pages for ${missingLocationDevs.length} developments with missing location...`);
      await mapLimit(missingLocationDevs, 6, async (dev) => {
        try {
          const html = await client.text(dev.url);
          const ext = extractLocationFromHtml(html, dev.url);
          let pc = ext.postcode;
          let lat = ext.latitude;
          let lon = ext.longitude;
          let locText = ext.locationText;
          if (pc || (lat && lon)) {
            devLocations.set(dev.id, { postcode: pc, latitude: lat, longitude: lon, locationText: locText });
          }
        } catch {}
      });
      console.log(`Location coverage after live fetch: ${devLocations.size} / ${developments.length}`);
    }

    // 5. Geocode and Country lookup with postcodes.io
    const postcodesToLookup = new Set<string>();
    for (const [, loc] of devLocations) {
      if (loc.postcode) {
        postcodesToLookup.add(loc.postcode.replace(/\s+/g, '').toUpperCase());
      }
    }

    console.log(`Looking up ${postcodesToLookup.size} unique postcodes via api.postcodes.io...`);
    const postcodeData = new Map<
      string,
      {
        postcode: string;
        latitude: number;
        longitude: number;
        country: string;
        region?: string;
        admin_district?: string;
      }
    >();

    const pcList = [...postcodesToLookup];
    for (let i = 0; i < pcList.length; i += 100) {
      const batch = pcList.slice(i, i + 100);
      try {
        const response = await fetch('https://api.postcodes.io/postcodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ postcodes: batch }),
          signal: AbortSignal.timeout(15000),
        });
        if (response.ok) {
          const data = await response.json();
          for (const item of data.result ?? []) {
            if (item.result) {
              const res = item.result;
              postcodeData.set(item.query.toUpperCase(), {
                postcode: res.postcode,
                latitude: res.latitude,
                longitude: res.longitude,
                country: res.country,
                region: res.region,
                admin_district: res.admin_district,
              });
            }
          }
        }
      } catch (err: any) {
        console.warn(`Postcode batch lookup error: ${err.message}`);
      }
    }

    console.log(`Successfully resolved ${postcodeData.size} postcodes via postcodes.io.`);

    // Reverse geocode for sites that have coordinates but no postcode or country
    const coordsToReverseGeocode = developments.filter((d) => {
      const loc = devLocations.get(d.id);
      return loc && loc.latitude && loc.longitude && (!loc.country || !loc.postcode);
    });

    if (coordsToReverseGeocode.length > 0) {
      console.log(`Reverse geocoding ${coordsToReverseGeocode.length} sites with coordinates...`);
      await mapLimit(coordsToReverseGeocode.slice(0, 150), 5, async (d) => {
        const loc = devLocations.get(d.id)!;
        try {
          const res = await fetch(`https://api.postcodes.io/postcodes?lat=${loc.latitude}&lon=${loc.longitude}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data = await res.json();
            const first = data.result?.[0];
            if (first) {
              if (!loc.postcode) loc.postcode = first.postcode;
              if (!loc.country) loc.country = first.country;
              if (!loc.locationText && first.admin_district) loc.locationText = first.admin_district;
            }
          }
        } catch {}
      });
    }

    // Apply resolved postcode data
    for (const [id, loc] of devLocations) {
      if (loc.postcode) {
        const clean = loc.postcode.replace(/\s+/g, '').toUpperCase();
        const info = postcodeData.get(clean);
        if (info) {
          loc.postcode = info.postcode;
          if (!loc.latitude) loc.latitude = info.latitude;
          if (!loc.longitude) loc.longitude = info.longitude;
          if (!loc.country) loc.country = info.country;
          if (!loc.locationText && info.admin_district) loc.locationText = info.admin_district;
        }
      }
    }

    // 6. Parse Properties and Costs for each site without limiting to 5 beds or £420k
    console.log('Parsing property types, house styles, costs, and property names across all sites...');

    interface ProcessedSite {
      id: string;
      builder_id: string;
      name: string;
      url: string;
      country: string | null;
      location_text: string | null;
      postcode: string | null;
      latitude: number | null;
      longitude: number | null;
      min_price: number | null;
      max_price: number | null;
      min_bedrooms: number | null;
      max_bedrooms: number | null;
      property_types: string[];
      house_styles: string[];
      property_names: string[];
      available_properties: Array<{
        name: string;
        price: number | null;
        bedrooms: number | null;
        propertyType: string | null;
        houseStyle: string | null;
        plotNumber: string | null;
        url: string;
      }>;
      properties_count: number;
      all_listings: Array<{
        externalId: string;
        houseTypeExternalId?: string;
        name: string;
        url: string;
        plotNumber?: string;
        bedrooms: number | null;
        price: number | null;
        propertyType: string | null;
        isDetached: boolean | null;
        houseStyle: string | null;
        available: boolean;
        status?: string;
      }>;
    }

    const processedSites: ProcessedSite[] = [];

    for (const dev of developments) {
      const loc = devLocations.get(dev.id);
      let country = loc?.country ?? dev.country ?? inferCountry(`${dev.name} ${dev.url} ${loc?.locationText ?? ''}`);
      if (!country && (loc?.postcode || loc?.latitude)) country = 'England';

      let listings: ProcessedSite['all_listings'] = [];

      try {
        const site = builderSite(dev.builder_slug);
        let html: string;
        try {
          html = await readFile(`results/.cache/pages/${sha256(dev.url)}.html`, 'utf8');
        } catch {
          html = await client.text(dev.url);
        }

        const data = site.discoverHomes(html, dev.url);
        const combined = [...data.plots, ...data.homes.filter((h) => !data.plots.some((p) => p.url === h.url))];

        listings = combined.map((p) => ({
          externalId: p.externalId,
          houseTypeExternalId: p.houseTypeExternalId,
          name: p.name,
          url: p.url,
          plotNumber: p.plotNumber,
          bedrooms: p.bedrooms,
          price: p.price,
          propertyType: p.propertyType,
          isDetached: p.isDetached,
          houseStyle: propertyStyle(p.propertyType, p.isDetached, p.name),
          available: p.available !== false,
          status: p.status,
        }));
      } catch (err: any) {
        // If discoverHomes fails, fallback to existing listings from DB if any
      }

      // If no listings discovered from HTML, check if existing listings exist in DB
      if (listings.length === 0) {
        const existing = await sql<
          {
            external_id: string;
            name: string;
            url: string;
            plot_number: string | null;
            bedrooms: number | null;
            price: string | null;
            property_type: string | null;
            is_detached: boolean | null;
            available: boolean | null;
            status: string | null;
          }[]
        >`
          select external_id, name, url, plot_number, bedrooms, price, property_type, is_detached, available, status
          from property_listings
          where development_id = ${dev.id}
        `;

        if (existing.length > 0) {
          listings = existing.map((p) => ({
            externalId: p.external_id,
            name: p.name,
            url: p.url,
            plotNumber: p.plot_number ?? undefined,
            bedrooms: p.bedrooms,
            price: p.price ? Number(p.price) : null,
            propertyType: p.property_type,
            isDetached: p.is_detached,
            houseStyle: propertyStyle(p.property_type, p.is_detached, p.name),
            available: p.available !== false,
            status: p.status ?? undefined,
          }));
        }
      }

      const availableListings = listings.filter((p) => p.available !== false);
      const prices = availableListings
        .map((p) => p.price)
        .filter((p): p is number => p !== null && p !== undefined && Number.isFinite(p));
      const minPrice = prices.length ? Math.min(...prices) : null;
      const maxPrice = prices.length ? Math.max(...prices) : null;

      const beds = availableListings
        .map((p) => p.bedrooms)
        .filter((b): b is number => b !== null && b !== undefined && Number.isFinite(b));
      const minBedrooms = beds.length ? Math.min(...beds) : null;
      const maxBedrooms = beds.length ? Math.max(...beds) : null;

      const propertyTypes = [...new Set(availableListings.map((p) => p.propertyType).filter(Boolean) as string[])];
      const houseStyles = [...new Set(availableListings.map((p) => p.houseStyle).filter(Boolean) as string[])];
      const propertyNames = [...new Set(availableListings.map((p) => p.name).filter(Boolean) as string[])];

      const availableProperties = availableListings.map((p) => ({
        name: p.name,
        price: p.price,
        bedrooms: p.bedrooms,
        propertyType: p.propertyType,
        houseStyle: p.houseStyle,
        plotNumber: p.plotNumber ?? null,
        url: p.url,
      }));

      processedSites.push({
        id: dev.id,
        builder_id: dev.builder_id,
        name: dev.name,
        url: dev.url,
        country: country ?? null,
        location_text: loc?.locationText ?? dev.location_text ?? null,
        postcode: loc?.postcode ?? dev.postcode ?? null,
        latitude: loc?.latitude ?? dev.latitude ?? null,
        longitude: loc?.longitude ?? dev.longitude ?? null,
        min_price: minPrice,
        max_price: maxPrice,
        min_bedrooms: minBedrooms,
        max_bedrooms: maxBedrooms,
        property_types: propertyTypes,
        house_styles: houseStyles,
        property_names: propertyNames,
        available_properties: availableProperties,
        properties_count: availableProperties.length,
        all_listings: listings,
      });
    }

    console.log(
      `Processed all ${processedSites.length} sites. Sites with available properties: ${
        processedSites.filter((s) => s.properties_count > 0).length
      }. Sites with country: ${processedSites.filter((s) => s.country).length}. Sites with coordinates: ${
        processedSites.filter((s) => s.latitude && s.longitude).length
      }.`
    );

    // 7. Save to Supabase
    console.log('Updating developments and property listings in Supabase...');

    // Update developments in chunks of 50
    for (let i = 0; i < processedSites.length; i += 50) {
      const chunk = processedSites.slice(i, i + 50);
      await sql.begin(async (tx) => {
        for (const s of chunk) {
          await tx`
            update developments
            set
              country = ${s.country},
              location_text = coalesce(${s.location_text}, location_text),
              postcode = coalesce(${s.postcode}, postcode),
              latitude = coalesce(${s.latitude}, latitude),
              longitude = coalesce(${s.longitude}, longitude),
              min_price = ${s.min_price},
              max_price = ${s.max_price},
              min_bedrooms = ${s.min_bedrooms},
              max_bedrooms = ${s.max_bedrooms},
              property_types = ${s.property_types},
              house_styles = ${s.house_styles},
              property_names = ${s.property_names},
              available_properties = ${sql.json(s.available_properties)},
              properties_count = ${s.properties_count},
              last_crawled_at = now()
            where id = ${s.id}
          `;

          // If there are listings, update their house_style and listings
          if (s.all_listings.length > 0) {
            const slug = (p: (typeof s.all_listings)[0]) =>
              p.houseTypeExternalId ?? 'url-' + createHash('sha256').update(p.url).digest('hex');

            const houses = [
              ...new Map(
                s.all_listings.map((p) => [
                  slug(p),
                  {
                    builder_id: s.builder_id,
                    external_id: p.houseTypeExternalId ?? null,
                    name: p.name,
                    slug: slug(p),
                    bedrooms: p.bedrooms,
                    property_type: p.propertyType,
                    is_detached: p.isDetached,
                  },
                ])
              ).values(),
            ].sort((a, b) => a.slug.localeCompare(b.slug));

            const types = await tx.unsafe<{ id: string; slug: string }[]>(
              `
              insert into house_types(builder_id, external_id, name, slug, bedrooms, property_type, is_detached)
              select builder_id, external_id, name, slug, bedrooms, property_type, is_detached
              from jsonb_to_recordset($1::jsonb) as item(builder_id uuid, external_id text, name text, slug text, bedrooms integer, property_type text, is_detached boolean)
              order by slug
              on conflict(builder_id, slug) do update set
                name = excluded.name,
                bedrooms = excluded.bedrooms,
                property_type = excluded.property_type,
                is_detached = excluded.is_detached
              returning id, slug`,
              [sql.json(houses)]
            );

            const typeIds = new Map(types.map((row) => [row.slug, row.id]));

            const listingsData = [
              ...new Map(
                s.all_listings.map((p) => [
                  p.externalId,
                  {
                    development_id: s.id,
                    house_type_id: typeIds.get(slug(p)) ?? null,
                    external_id: p.externalId,
                    plot_number: p.plotNumber ?? null,
                    name: p.name,
                    url: p.url,
                    price: p.price,
                    bedrooms: p.bedrooms,
                    property_type: p.propertyType,
                    is_detached: p.isDetached,
                    house_style: p.houseStyle,
                    available: p.available,
                    status: p.status ?? null,
                  },
                ])
              ).values(),
            ];

            await tx.unsafe(
              `
              insert into property_listings(development_id, house_type_id, external_id, plot_number, name, url, price, bedrooms, property_type, is_detached, house_style, available, status)
              select development_id, house_type_id, external_id, plot_number, name, url, price, bedrooms, property_type, is_detached, house_style, available, status
              from jsonb_to_recordset($1::jsonb) as item(development_id uuid, house_type_id uuid, external_id text, plot_number text, name text, url text, price numeric, bedrooms integer, property_type text, is_detached boolean, house_style text, available boolean, status text)
              on conflict(development_id, external_id) do update set
                house_type_id = coalesce(excluded.house_type_id, property_listings.house_type_id),
                plot_number = excluded.plot_number,
                name = excluded.name,
                url = excluded.url,
                price = excluded.price,
                bedrooms = excluded.bedrooms,
                property_type = excluded.property_type,
                is_detached = excluded.is_detached,
                house_style = excluded.house_style,
                available = excluded.available,
                status = excluded.status,
                last_seen_at = now()`,
              [sql.json(listingsData)]
            );
          }
        }
      });
      process.stdout.write(`Updated ${Math.min(i + 50, processedSites.length)} / ${processedSites.length} sites in Supabase...\r`);
    }

    console.log('\nSupabase developments and property listings successfully updated!');

    // 8. Synchronize collection files
    console.log('Synchronizing collections files (site-details.json and locations.json)...');
    const folders = await readdir('collections');
    for (const folder of folders) {
      const devSlug = folder.replace(/-home-offices$/, '');
      const folderSites = processedSites.filter((s) => {
        const matchingDev = developments.find((d) => d.id === s.id);
        return matchingDev?.builder_slug === devSlug;
      });

      if (folderSites.length > 0) {
        // Read existing report to preserve order of collection sites
        try {
          const report = JSON.parse(await readFile(`collections/${folder}/results.json`, 'utf8'));
          const collectionUrls = [
            ...new Set(
              (report.properties ?? [])
                .filter((p: any) => p.imageIds?.length)
                .map((p: any) => p.developmentUrl)
            ),
          ] as string[];

          const targetUrls = collectionUrls.length > 0 ? collectionUrls : folderSites.map((s) => s.url);

          const siteDetails = targetUrls.map((url) => {
            const site = folderSites.find((s) => s.url === url) ?? processedSites.find((s) => s.url === url);
            const props = (site?.available_properties ?? []).map((p) => ({
              price: p.price,
              bedrooms: p.bedrooms,
              style: p.houseStyle,
            }));

            return {
              url,
              country: site?.country ?? null,
              scope: props.length > 0 ? 'Advertised homes' : 'Collection homes',
              properties: props,
            };
          });

          await writeFile(`collections/${folder}/site-details.json`, JSON.stringify(siteDetails, null, 2) + '\n');

          const locationDetails = targetUrls.map((url) => {
            const site = folderSites.find((s) => s.url === url) ?? processedSites.find((s) => s.url === url);
            return {
              name: site?.name ?? '',
              url,
              postcode: site?.postcode ?? undefined,
              latitude: site?.latitude ?? undefined,
              longitude: site?.longitude ?? undefined,
            };
          });

          await writeFile(`collections/${folder}/locations.json`, JSON.stringify(locationDetails, null, 2) + '\n');
        } catch {}
      }
    }

    console.log('Collection files successfully synchronized.');

    // 9. Summary report
    const stats = await sql`
      select
        count(*) as total_sites,
        count(country) as with_country,
        count(latitude) as with_coords,
        count(min_price) as with_price,
        count(case when array_length(house_styles, 1) > 0 then 1 end) as with_styles,
        count(case when properties_count > 0 then 1 end) as with_properties,
        sum(properties_count) as total_available_properties
      from developments
    `;
    console.log('Sync complete! Final Supabase site stats:', stats[0]);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exitCode = 1;
});
