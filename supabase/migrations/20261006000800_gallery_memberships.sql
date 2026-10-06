-- Compact serving relationships keep facets away from image metadata and plot blobs.
create table showhome_web.gallery_memberships (
 uid text not null references showhome_web.gallery_cards on delete cascade,
 gallery_key text not null,builder_slug text not null,url text not null,
 bedrooms integer,price numeric,development_url text not null,development text not null,
 building_name text not null,areas text[] not null default '{}',primary key(uid,gallery_key)
);
create index web_gallery_memberships_building on showhome_web.gallery_memberships(building_name,uid);
create index web_gallery_memberships_beds on showhome_web.gallery_memberships(bedrooms,uid);
create index web_gallery_memberships_areas on showhome_web.gallery_memberships using gin(areas);
insert into showhome_web.gallery_memberships
select c.uid,g.key,g.builder_slug,g.source_url,g.bedrooms,g.price,d.source_url,d.name,b.name,
 array(select distinct value from jsonb_each_text(d.geography) where value is not null and value<>'')
from showhome_web.gallery_cards c join showhome_web.images i on i.builder_slug=c.builder_slug and i.catalogue_id=c.image_id
join showhome_web.gallery_images gi on gi.image_key=i.key join showhome_web.galleries g on g.key=gi.gallery_key
join showhome_web.developments d on d.key=g.development_key join showhome_web.buildings b on b.key=g.building_key;
analyze showhome_web.gallery_memberships;
revoke all on showhome_web.gallery_memberships from anon,authenticated;
