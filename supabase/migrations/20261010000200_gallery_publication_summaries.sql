-- Publication-owned summaries survive page-cache invalidation.
create table showhome_web.gallery_publication_summaries (
 key text primary key,
 scope jsonb not null,
 builders text[] not null,
 fingerprint text not null,
 payload jsonb not null,
 updated_at timestamptz not null default now()
);
create table showhome_web.gallery_summary_refresh_queue (
 builder_slug text primary key,
 queued_at timestamptz not null default now()
);
revoke all on showhome_web.gallery_publication_summaries,showhome_web.gallery_summary_refresh_queue from anon,authenticated;
