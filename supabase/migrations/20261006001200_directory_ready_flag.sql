alter table showhome_web.directory_cards add column if not exists is_ready boolean not null default true;
create index if not exists web_directory_ready on showhome_web.directory_cards(kind, is_ready) where is_ready;
create index if not exists web_directory_ready_name on showhome_web.directory_cards(kind, name, key) where is_ready;

alter table showhome_web.developments add column if not exists areas text[] not null default '{}';
update showhome_web.developments set areas=array(select distinct value from jsonb_each_text(geography) where value is not null and value<>'') where areas='{}'::text[];

do $$ begin
 if to_regclass('showhome_web.gallery_image_links') is not null then
  create or replace view showhome_web.gallery_memberships as
  select i.key as uid,g.key as gallery_key,g.builder_slug,g.source_url as url,g.bedrooms,g.price,d.source_url as development_url,d.name as development,b.name as building_name,d.areas
  from showhome_web.images i join showhome_web.gallery_image_links gi on gi.image_id=i.internal_id join showhome_web.galleries g on g.internal_id=gi.gallery_id join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key;
 end if;
end $$;

update showhome_web.publication_revision set revision=revision+1 where singleton=true;
truncate showhome_web.query_cache;
