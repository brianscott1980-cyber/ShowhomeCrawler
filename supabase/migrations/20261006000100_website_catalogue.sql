-- Published website catalogue. Crawl logs/history remain in the existing public schema.
-- This schema is backend-only; no anon/authenticated grants or client credentials.
create schema if not exists showhome_web;
create table showhome_web.builders (
 slug text primary key, name text not null, website_url text not null,
 report_metadata jsonb not null default '{}', facts jsonb not null default '{}',
 logo_url text, logo_background text, office jsonb,
 imported_at timestamptz not null default now()
);
create table showhome_web.developments (
 key text primary key, builder_slug text not null references showhome_web.builders on delete cascade,
 source_url text not null, name text not null, display_name text not null,
 town text, country text, postcode text, latitude double precision, longitude double precision,
 geography jsonb not null default '{}', contact jsonb not null default '{}',
 crawl_metadata jsonb not null default '{}', property_scope text,
 unique(builder_slug,source_url)
);
create table showhome_web.buildings (
 key text primary key, builder_slug text not null references showhome_web.builders on delete cascade,
 name text not null, unique(builder_slug,name)
);
create table showhome_web.images (
 key text primary key, builder_slug text not null references showhome_web.builders on delete cascade,
 catalogue_id text not null, content_sha256 text, path text not null, source_url text not null,
 main_category text, is_room boolean not null default false, eligible boolean not null default false,
 metadata jsonb not null default '{}', unique(builder_slug,catalogue_id)
);
create table showhome_web.galleries (
 key text primary key, builder_slug text not null references showhome_web.builders on delete cascade,
 development_key text not null references showhome_web.developments on delete cascade,
 building_key text not null references showhome_web.buildings on delete cascade,
 name text not null, source_url text not null, bedrooms integer, price numeric(12,2), plots jsonb not null default '[]'
);
create table showhome_web.gallery_images (
 gallery_key text not null references showhome_web.galleries on delete cascade,
 image_key text not null references showhome_web.images on delete cascade,
 position integer not null, primary key(gallery_key,image_key)
);
create table showhome_web.offers (
 id bigint generated always as identity primary key,
 development_key text not null references showhome_web.developments on delete cascade,
 bedrooms integer, price numeric(12,2), style text
);
-- Derived serving projections, rebuilt from the normalized tables on publication.
-- JSONB here is a response cache, not an imported full-report blob.
create table showhome_web.directory_cards (
 kind text not null, key text not null, name text not null, href text,
 builder_slug text, development_url text, building_name text, category text,
 min_price numeric, max_price numeric, payload jsonb not null,
 primary key(kind,key)
);
create table showhome_web.presentations (key text primary key,payload jsonb not null,updated_at timestamptz not null default now());
create index web_developments_builder_name on showhome_web.developments(builder_slug,display_name,key);
create index web_developments_geo on showhome_web.developments(latitude,longitude) where latitude is not null and longitude is not null;
create index web_buildings_builder_name on showhome_web.buildings(builder_slug,name,key);
create index web_images_builder_category on showhome_web.images(builder_slug,main_category,key);
create index web_images_room_category on showhome_web.images(main_category,builder_slug,key) where is_room;
create index web_galleries_development_beds on showhome_web.galleries(development_key,bedrooms,key);
create index web_galleries_building on showhome_web.galleries(building_key,development_key,key);
create index web_gallery_images_reverse on showhome_web.gallery_images(image_key,gallery_key);
create index web_offers_beds_price on showhome_web.offers(development_key,bedrooms,price);
create index web_offers_price_beds on showhome_web.offers(price,bedrooms,development_key);
create index web_directory_name on showhome_web.directory_cards(kind,name,key);
create index web_directory_builder on showhome_web.directory_cards(kind,builder_slug,name,key);
create index web_directory_price_asc on showhome_web.directory_cards(kind,min_price,key) where min_price is not null;
create index web_directory_price_desc on showhome_web.directory_cards(kind,max_price desc,key) where max_price is not null;
revoke all on schema showhome_web from anon,authenticated;
revoke all on all tables in schema showhome_web from anon,authenticated;
