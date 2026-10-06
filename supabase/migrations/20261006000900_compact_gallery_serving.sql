-- Keep rich image JSON once. Public serving interfaces remain compatibility views.
create table showhome_web.gallery_card_index (
 uid text primary key references showhome_web.images(key) on delete cascade,
 builder_slug text not null,image_id text not null,builder_name text not null,
 category text,room text,eligible boolean not null,verdict_matches boolean not null,
 search_text text not null,building_names text[] not null default '{}'
);
do $$ begin if exists(select 1 from showhome_web.gallery_cards c left join showhome_web.images i on i.key=c.uid where i.key is null) then raise exception 'Gallery cards contain unresolved image keys';end if;end $$;
insert into showhome_web.gallery_card_index
select c.uid,c.builder_slug,c.image_id,c.builder_name,c.category,c.room,c.eligible,c.verdict_matches,c.search_text,c.building_names
from showhome_web.gallery_cards c join showhome_web.images i on i.key=c.uid;
drop table showhome_web.gallery_memberships;
drop table showhome_web.gallery_cards;
create index web_card_index_category on showhome_web.gallery_card_index(category,uid) where eligible;
create index web_card_index_builder on showhome_web.gallery_card_index(builder_slug,uid);
create index web_card_index_image on showhome_web.gallery_card_index(image_id);
create index web_card_index_building on showhome_web.gallery_card_index using gin(building_names) where eligible;
create view showhome_web.gallery_memberships as
select c.uid,g.key as gallery_key,g.builder_slug,g.source_url as url,g.bedrooms,g.price,
 d.source_url as development_url,d.name as development,b.name as building_name,
 array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'') as areas
from showhome_web.gallery_card_index c
join showhome_web.gallery_images gi on gi.image_key=c.uid
join showhome_web.galleries g on g.key=gi.gallery_key
join showhome_web.developments d on d.key=g.development_key
join showhome_web.buildings b on b.key=g.building_key;
create view showhome_web.gallery_cards as
select c.uid,c.builder_slug,c.image_id,c.builder_name,c.category,c.room,c.eligible,c.verdict_matches,c.search_text,
 i.metadata||jsonb_build_object('slug',c.builder_slug,'developer',c.builder_name,'uid',c.uid,'homes',
 coalesce((select jsonb_agg(jsonb_build_object('name',g.name,'url',g.source_url,'bedrooms',g.bedrooms,'price',g.price,'plots','[]'::jsonb,'imageIds','[]'::jsonb,'development',d.name,'developmentUrl',d.source_url,'buildingName',b.name,'areas',array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'')))
 from showhome_web.gallery_images gi join showhome_web.galleries g on g.key=gi.gallery_key join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key where gi.image_key=c.uid),'[]'::jsonb)) as payload,
 c.building_names
from showhome_web.gallery_card_index c join showhome_web.images i on i.key=c.uid;
-- Existing publication code can insert/delete using the same view schema.
create function showhome_web.write_gallery_card() returns trigger language plpgsql as $$
begin
 if TG_OP='DELETE' then delete from showhome_web.gallery_card_index where uid=OLD.uid;return OLD;end if;
 if TG_OP='UPDATE' then delete from showhome_web.gallery_card_index where uid=OLD.uid;end if;
 insert into showhome_web.gallery_card_index values(NEW.uid,NEW.builder_slug,NEW.image_id,NEW.builder_name,NEW.category,NEW.room,NEW.eligible,NEW.verdict_matches,NEW.search_text,NEW.building_names);
 return NEW;
end $$;
create trigger gallery_cards_write instead of insert or update or delete on showhome_web.gallery_cards for each row execute function showhome_web.write_gallery_card();
-- Memberships now derive from the catalogue; legacy publisher inserts are redundant.
create function showhome_web.ignore_derived_membership_write() returns trigger language plpgsql as $$ begin return NEW;end $$;
create trigger gallery_memberships_write instead of insert on showhome_web.gallery_memberships for each row execute function showhome_web.ignore_derived_membership_write();
revoke all on showhome_web.gallery_card_index,showhome_web.gallery_cards,showhome_web.gallery_memberships from anon,authenticated;
revoke all on function showhome_web.write_gallery_card(),showhome_web.ignore_derived_membership_write() from public;
update showhome_web.publication_revision set revision=revision+1 where singleton=true;
truncate showhome_web.query_cache;
