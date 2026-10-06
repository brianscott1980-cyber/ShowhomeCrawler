create table showhome_web.publication_revision (singleton boolean primary key default true check(singleton),revision bigint not null default 0);
insert into showhome_web.publication_revision(singleton) values(true);
create table showhome_web.query_cache (key text primary key,revision bigint not null,expires_at timestamptz not null,payload jsonb not null);
create index web_query_cache_expiry on showhome_web.query_cache(expires_at);
create table showhome_web.gallery_cards (
 uid text primary key,builder_slug text not null,image_id text not null,builder_name text not null,
 category text,room text,eligible boolean not null,verdict_matches boolean not null,
 search_text text not null,payload jsonb not null
);
create index web_gallery_cards_builder on showhome_web.gallery_cards(builder_slug,uid);
create index web_gallery_cards_category on showhome_web.gallery_cards(category,uid) where eligible;
create index web_gallery_cards_image_id on showhome_web.gallery_cards(image_id);
revoke all on all tables in schema showhome_web from anon,authenticated;
