-- UUID defaults use core gen_random_uuid() on supported PostgreSQL versions.
create table public.builders (
 id uuid primary key default gen_random_uuid(), name text not null,
 slug text not null unique, website_url text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.developments (
 id uuid primary key default gen_random_uuid(), builder_id uuid not null references public.builders,
 external_id text, name text not null, slug text, url text not null,
 location_text text, postcode text, latitude double precision check (latitude between -90 and 90),
 longitude double precision check (longitude between -180 and 180), active boolean not null default true,
 first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 last_crawled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(builder_id, url), unique(builder_id, external_id)
);
create table public.house_types (
 id uuid primary key default gen_random_uuid(), builder_id uuid not null references public.builders,
 external_id text, name text not null, slug text not null, canonical_url text,
 bedrooms integer check(bedrooms > 0), property_type text, is_detached boolean,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(builder_id, slug), unique(builder_id, external_id)
);
create table public.property_listings (
 id uuid primary key default gen_random_uuid(), development_id uuid not null references public.developments,
 house_type_id uuid references public.house_types, external_id text not null, plot_number text,
 name text not null, url text not null, price numeric(12,2) check(price >= 0),
 bedrooms integer check(bedrooms > 0), property_type text, is_detached boolean,
 status text, available boolean,
 first_seen_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(development_id, external_id)
);
-- URL is not unique: several plots can share the same house-style URL.
create table public.galleries (
 id uuid primary key default gen_random_uuid(), builder_id uuid not null references public.builders,
 house_type_id uuid references public.house_types, fingerprint text not null,
 identity_version text not null default 'v1', first_image_sha256 text not null check(first_image_sha256 ~ '^[0-9a-f]{64}$'),
 first_image_phash text, image_count integer not null check(image_count > 0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(builder_id, identity_version, fingerprint)
);
create table public.property_galleries (
 property_listing_id uuid not null references public.property_listings on delete cascade,
 gallery_id uuid not null references public.galleries on delete cascade,
 created_at timestamptz not null default now(), primary key(property_listing_id, gallery_id)
);
-- Unique image binaries are global; presentation metadata lives in gallery_images.
create table public.images (
 id uuid primary key default gen_random_uuid(), source_url text not null,
 sha256 text not null unique check(sha256 ~ '^[0-9a-f]{64}$'), perceptual_hash text,
 width integer check(width > 0), height integer check(height > 0), mime_type text, storage_path text,
 room_type text, description text, tags text[], objects jsonb,
 ai_model text, ai_analysis_version text, ai_analysed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.gallery_images (
 gallery_id uuid not null references public.galleries on delete cascade,
 image_id uuid not null references public.images, position integer not null check(position >= 0),
 source_url text not null, alt_text text, caption text,
 created_at timestamptz not null default now(), primary key(gallery_id, position)
);
create table public.crawl_jobs (
 id uuid primary key default gen_random_uuid(), builder_id uuid not null references public.builders,
 started_at timestamptz, completed_at timestamptz,
 status text not null default 'queued' check(status in ('queued','running','completed','completed_with_errors','failed','cancelled')),
 filter_config jsonb not null default '{}',
 developments_discovered integer not null default 0 check(developments_discovered >= 0),
 properties_discovered integer not null default 0 check(properties_discovered >= 0),
 properties_matched integer not null default 0 check(properties_matched >= 0),
 new_galleries integer not null default 0 check(new_galleries >= 0),
 reused_galleries integer not null default 0 check(reused_galleries >= 0),
 new_images integer not null default 0 check(new_images >= 0),
 errors_count integer not null default 0 check(errors_count >= 0), created_at timestamptz not null default now()
);
create table public.crawl_items (
 id uuid primary key default gen_random_uuid(), crawl_job_id uuid not null references public.crawl_jobs on delete cascade,
 url text not null, item_type text not null check(item_type in ('development','property','gallery','image')),
 item_key text not null,
 status text not null default 'discovered' check(status in ('discovered','queued','processing','complete','failed','skipped')),
 retry_count integer not null default 0 check(retry_count >= 0), last_error text,
 payload jsonb not null default '{}', started_at timestamptz, completed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(crawl_job_id, item_type, item_key)
);
create index developments_active_idx on public.developments(builder_id, active);
create index properties_filter_idx on public.property_listings(bedrooms, price) where is_detached;
create index properties_house_type_idx on public.property_listings(house_type_id);
create index galleries_house_type_idx on public.galleries(house_type_id);
create index galleries_exact_idx on public.galleries(builder_id, first_image_sha256, image_count);
create index galleries_perceptual_idx on public.galleries(builder_id, image_count) where first_image_phash is not null;
create index property_galleries_gallery_idx on public.property_galleries(gallery_id);
create index gallery_images_image_idx on public.gallery_images(image_id);
create index images_pending_ai_idx on public.images(id) where ai_analysed_at is null;
create index crawl_jobs_builder_idx on public.crawl_jobs(builder_id, created_at desc);
create index crawl_items_queue_idx on public.crawl_items(crawl_job_id, status, created_at);
create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
do $$ declare tab text; begin
 foreach tab in array array['builders','developments','house_types','property_listings','galleries','images','crawl_items'] loop
 execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', tab);
 end loop;
end $$;
-- Server-side access only. No browser policies in this phase.
do $$ declare tab text; begin
 foreach tab in array array['builders','developments','house_types','property_listings','galleries','property_galleries','images','gallery_images','crawl_jobs','crawl_items'] loop
 execute format('alter table public.%I enable row level security', tab);
 end loop;
end $$;
insert into public.builders(name, slug, website_url) values ('Bellway','bellway','https://www.bellway.co.uk') on conflict(slug) do nothing;
