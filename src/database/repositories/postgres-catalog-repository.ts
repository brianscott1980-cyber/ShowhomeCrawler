import type postgres from 'postgres';
import { createHash } from 'node:crypto';
import type { CatalogRepository } from './catalog-repository.js';
import { propertyStyle } from '../../web/site-filters.js';
export class PostgresCatalogRepository implements CatalogRepository {
 constructor(private readonly sql: postgres.Sql, private readonly builder: { name: string; slug: string; websiteUrl: string }) {}
 async saveDevelopment(development: Parameters<CatalogRepository['saveDevelopment']>[0], properties: Parameters<CatalogRepository['saveDevelopment']>[1]) {
  return this.sql.begin(async tx => {
   const found = await tx`select id from builders where slug = ${this.builder.slug}`;
   const builder = found[0] ?? (await tx`insert into builders(name,slug,website_url) values (${this.builder.name},${this.builder.slug},${this.builder.websiteUrl}) on conflict(slug) do update set name=excluded.name returning id`)[0];
   const availableListings = properties.filter(p => p.available !== false);
   const prices = availableListings.map(p => p.price).filter((p): p is number => p !== null && p !== undefined && Number.isFinite(p));
   const minPrice = prices.length ? Math.min(...prices) : null;
   const maxPrice = prices.length ? Math.max(...prices) : null;
   const beds = availableListings.map(p => p.bedrooms).filter((b): b is number => b !== null && b !== undefined && Number.isFinite(b));
   const minBedrooms = beds.length ? Math.min(...beds) : null;
   const maxBedrooms = beds.length ? Math.max(...beds) : null;
   const propertyTypes = [...new Set(availableListings.map(p => p.propertyType).filter((t): t is string => Boolean(t)))];
   const houseStyles = [...new Set(availableListings.map(p => propertyStyle(p.propertyType, p.isDetached, p.name)).filter((s): s is string => Boolean(s)))];
   const propertyNames = [...new Set(availableListings.map(p => p.name).filter(Boolean))];
   const availableProps = availableListings.map(p => ({
    name: p.name,
    price: p.price,
    bedrooms: p.bedrooms,
    propertyType: p.propertyType,
    houseStyle: propertyStyle(p.propertyType, p.isDetached, p.name),
    plotNumber: p.plotNumber ?? null,
    url: p.url,
   }));

   const [dev] = await tx`insert into developments(builder_id,name,url,postcode,location_text,latitude,longitude,country,min_price,max_price,min_bedrooms,max_bedrooms,property_types,house_styles,property_names,available_properties,properties_count,last_crawled_at)
    values (${builder!.id},${development.name},${development.url},${development.postcode??null},${development.locationText??null},${development.latitude??null},${development.longitude??null},${development.country??null},${minPrice},${maxPrice},${minBedrooms},${maxBedrooms},${propertyTypes},${houseStyles},${propertyNames},${this.sql.json(availableProps)},${availableListings.length},now())
    on conflict(builder_id,url) do update set
      name=excluded.name,
      postcode=coalesce(excluded.postcode, developments.postcode),
      location_text=coalesce(excluded.location_text, developments.location_text),
      latitude=coalesce(excluded.latitude, developments.latitude),
      longitude=coalesce(excluded.longitude, developments.longitude),
      country=coalesce(excluded.country, developments.country),
      min_price=excluded.min_price,
      max_price=excluded.max_price,
      min_bedrooms=excluded.min_bedrooms,
      max_bedrooms=excluded.max_bedrooms,
      property_types=excluded.property_types,
      house_styles=excluded.house_styles,
      property_names=excluded.property_names,
      available_properties=excluded.available_properties,
      properties_count=excluded.properties_count,
      last_seen_at=now(),
      last_crawled_at=now()
    returning id`;
   const slug = (p: typeof properties[number]) => p.houseTypeExternalId ?? 'url-' + createHash('sha256').update(p.url).digest('hex');
   if (!properties.length) return { developmentId: String(dev!.id), propertiesSaved: 0 };
   const houses = [...new Map(properties.map(p => [slug(p), { builder_id: builder!.id, external_id: p.houseTypeExternalId??null, name:p.name,slug:slug(p),bedrooms:p.bedrooms,property_type:p.propertyType,is_detached:p.isDetached }])).values()].sort((a,b)=>a.slug.localeCompare(b.slug));
   const types = await tx.unsafe<{ id: string; slug: string }[]>(`
    insert into house_types(builder_id,external_id,name,slug,bedrooms,property_type,is_detached)
    select builder_id,external_id,name,slug,bedrooms,property_type,is_detached
    from jsonb_to_recordset($1::jsonb) as item(builder_id uuid,external_id text,name text,slug text,bedrooms integer,property_type text,is_detached boolean)
    order by slug
    on conflict(builder_id,slug) do update set name=excluded.name,bedrooms=excluded.bedrooms,property_type=excluded.property_type,is_detached=excluded.is_detached
    returning id,slug`, [this.sql.json(houses)]);
   const ids = new Map(types.map(row=>[row.slug,row.id]));
   const listings = [...new Map(properties.map(p => [p.externalId, {
    development_id:dev!.id,
    house_type_id:ids.get(slug(p)),
    external_id:p.externalId,
    plot_number:p.plotNumber??null,
    name:p.name,
    url:p.url,
    price:p.price,
    bedrooms:p.bedrooms,
    property_type:p.propertyType,
    is_detached:p.isDetached,
    house_style:propertyStyle(p.propertyType, p.isDetached, p.name),
    available:p.available,
    status:p.status??null
   }])).values()];
   await tx.unsafe(`
    insert into property_listings(development_id,house_type_id,external_id,plot_number,name,url,price,bedrooms,property_type,is_detached,house_style,available,status)
    select development_id,house_type_id,external_id,plot_number,name,url,price,bedrooms,property_type,is_detached,house_style,available,status
    from jsonb_to_recordset($1::jsonb) as item(development_id uuid,house_type_id uuid,external_id text,plot_number text,name text,url text,price numeric,bedrooms integer,property_type text,is_detached boolean,house_style text,available boolean,status text)
    on conflict(development_id,external_id) do update set
      house_type_id=coalesce(excluded.house_type_id, property_listings.house_type_id),
      plot_number=excluded.plot_number,
      name=excluded.name,
      url=excluded.url,
      price=excluded.price,
      bedrooms=excluded.bedrooms,
      property_type=excluded.property_type,
      is_detached=excluded.is_detached,
      house_style=excluded.house_style,
      available=excluded.available,
      status=excluded.status,
      last_seen_at=now()`, [this.sql.json(listings)]);
   return { developmentId:String(dev!.id),propertiesSaved:listings.length };
  });
 }
}
