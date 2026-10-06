-- Compact numeric relationship indexes; external hashes and URLs remain unchanged.
alter table showhome_web.images add column internal_id integer generated always as identity;
alter table showhome_web.images add constraint web_images_internal_id unique(internal_id);
alter table showhome_web.galleries add column internal_id integer generated always as identity;
alter table showhome_web.galleries add constraint web_galleries_internal_id unique(internal_id);
create table showhome_web.gallery_image_links (
 gallery_id integer not null references showhome_web.galleries(internal_id) on delete cascade,
 image_id integer not null references showhome_web.images(internal_id) on delete cascade,
 position integer not null,primary key(gallery_id,image_id)
);
insert into showhome_web.gallery_image_links select g.internal_id,i.internal_id,gi.position from showhome_web.gallery_images gi join showhome_web.galleries g on g.key=gi.gallery_key join showhome_web.images i on i.key=gi.image_key;
create index web_numeric_image_gallery on showhome_web.gallery_image_links(image_id,gallery_id);
alter table showhome_web.gallery_images rename to gallery_images_legacy;
create view showhome_web.gallery_images as select g.key as gallery_key,i.key as image_key,l.position from showhome_web.gallery_image_links l join showhome_web.galleries g on g.internal_id=l.gallery_id join showhome_web.images i on i.internal_id=l.image_id;
-- Rebind dependent serving views to the compact relationship view.
create or replace view showhome_web.gallery_memberships as
select c.uid,g.key as gallery_key,g.builder_slug,g.source_url as url,g.bedrooms,g.price,d.source_url as development_url,d.name as development,b.name as building_name,array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'') as areas
from showhome_web.gallery_card_index c join showhome_web.images i on i.key=c.uid join showhome_web.gallery_image_links gi on gi.image_id=i.internal_id join showhome_web.galleries g on g.internal_id=gi.gallery_id join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key;
create or replace view showhome_web.gallery_cards as
select c.uid,c.builder_slug,c.image_id,c.builder_name,c.category,c.room,c.eligible,c.verdict_matches,c.search_text,
 i.metadata||jsonb_build_object('slug',c.builder_slug,'developer',c.builder_name,'uid',c.uid,'homes',coalesce((select jsonb_agg(jsonb_build_object('name',g.name,'url',g.source_url,'bedrooms',g.bedrooms,'price',g.price,'plots','[]'::jsonb,'imageIds','[]'::jsonb,'development',d.name,'developmentUrl',d.source_url,'buildingName',b.name,'areas',array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>''))) from showhome_web.gallery_image_links gi join showhome_web.galleries g on g.internal_id=gi.gallery_id join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key where gi.image_id=i.internal_id),'[]'::jsonb)) as payload,c.building_names
from showhome_web.gallery_card_index c join showhome_web.images i on i.key=c.uid;
drop table showhome_web.gallery_images_legacy;
create function showhome_web.write_gallery_image_link() returns trigger language plpgsql as $$
declare image_number integer;gallery_number integer;
begin
 if TG_OP='DELETE' then delete from showhome_web.gallery_image_links where image_id=(select internal_id from showhome_web.images where key=OLD.image_key) and gallery_id=(select internal_id from showhome_web.galleries where key=OLD.gallery_key);return OLD;end if;
 select internal_id into strict image_number from showhome_web.images where key=NEW.image_key;
 select internal_id into strict gallery_number from showhome_web.galleries where key=NEW.gallery_key;
 insert into showhome_web.gallery_image_links values(gallery_number,image_number,NEW.position);
 return NEW;
end $$;
create trigger gallery_images_write instead of insert or delete on showhome_web.gallery_images for each row execute function showhome_web.write_gallery_image_link();
revoke all on showhome_web.gallery_images,showhome_web.gallery_image_links from anon,authenticated;
revoke all on function showhome_web.write_gallery_image_link() from public;
update showhome_web.publication_revision set revision=revision+1 where singleton=true;
truncate showhome_web.query_cache;
