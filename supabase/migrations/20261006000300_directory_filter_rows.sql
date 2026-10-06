-- Small typed filter memberships keep pagination/facets away from large card JSON.
create table showhome_web.directory_filter_rows (
 id bigint generated always as identity primary key,
 kind text not null,card_key text not null,
 developer text,bedrooms integer,price numeric,style text,site text,site_id text,
 areas text[] not null default '{}',region text,latitude double precision,longitude double precision,
 image_ids text[] not null default '{}',building_types text[] not null default '{}',
 foreign key(kind,card_key) references showhome_web.directory_cards(kind,key) on delete cascade
);
create index web_filter_card on showhome_web.directory_filter_rows(kind,card_key);
create index web_filter_builder_beds on showhome_web.directory_filter_rows(kind,developer,bedrooms,card_key);
create index web_filter_site on showhome_web.directory_filter_rows(kind,site,card_key);
create index web_filter_price_beds on showhome_web.directory_filter_rows(kind,price,bedrooms,card_key);
create index web_filter_areas on showhome_web.directory_filter_rows using gin(areas);
create index web_filter_geo on showhome_web.directory_filter_rows(kind,latitude,longitude) where latitude is not null and longitude is not null;
revoke all on showhome_web.directory_filter_rows from anon,authenticated;
