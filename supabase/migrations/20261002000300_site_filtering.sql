-- Add site-level filtering fields and property house style
alter table public.developments
  add column if not exists country text,
  add column if not exists min_price numeric(12,2),
  add column if not exists max_price numeric(12,2),
  add column if not exists min_bedrooms integer,
  add column if not exists max_bedrooms integer,
  add column if not exists property_types text[] default '{}',
  add column if not exists house_styles text[] default '{}',
  add column if not exists property_names text[] default '{}',
  add column if not exists available_properties jsonb default '[]'::jsonb,
  add column if not exists properties_count integer not null default 0;

alter table public.property_listings
  add column if not exists house_style text;

create index if not exists developments_country_idx on public.developments(country);
create index if not exists developments_price_idx on public.developments(min_price, max_price);
create index if not exists developments_bedrooms_idx on public.developments(min_bedrooms, max_bedrooms);
create index if not exists developments_geo_idx on public.developments(latitude, longitude) where latitude is not null and longitude is not null;
create index if not exists developments_house_styles_idx on public.developments using gin(house_styles);
create index if not exists developments_property_types_idx on public.developments using gin(property_types);
create index if not exists property_listings_house_style_idx on public.property_listings(house_style);
